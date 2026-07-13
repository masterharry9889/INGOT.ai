import asyncio
import json
import os
from typing import Dict, Any
from .schemas import AgentSpec, AgentOutput
from ..services.pubsub import publish_event
from ..core.security import decrypt_api_key

# Built-in agents
BUILTIN_AGENTS = {
    "research-agent": AgentSpec(
        id="research-agent",
        name="Research Agent",
        description="Gathers information on a given topic.",
        system_prompt="You are a research agent.",
        input_schema={"topic": "string"},
        output_schema={"summary": "string", "entities": "array", "relations": "array"}
    ),
    "legal-doc-reviewer": AgentSpec(
        id="legal-doc-reviewer",
        name="Legal Doc Reviewer",
        description="Reviews contracts and flags risky clauses",
        system_prompt="You are a legal doc reviewer.",
        input_schema={"document": "string"},
        output_schema={"entities": "array", "relations": "array", "summary": "string"}
    )
}

class Orchestrator:
    def __init__(self):
        self.agents = BUILTIN_AGENTS.copy()

    def get_agents(self) -> Dict[str, AgentSpec]:
        return self.agents

    async def run_agent_async(self, run_id: str, agent_spec: AgentSpec, input_data: Dict[str, Any], context: Dict[str, Any], user_setting: Any = None):
        channel = f"runs:{run_id}"
        
        try:
            await publish_event(channel, "run.started", {"agent_id": agent_spec.id})
            
            if not user_setting:
                raise ValueError("No API key configured.")

            api_key = decrypt_api_key(user_setting.api_key_encrypted)
            provider = user_setting.provider
            model = user_setting.model_name
            
            from litellm import acompletion
            
            if provider == "groq":
                litellm_model = f"groq/{model}"
                os.environ["GROQ_API_KEY"] = api_key
            elif provider == "anthropic":
                # litellm requires anthropic/ prefix for some standard models if not recognized, 
                # but usually handles "claude-3-..." natively. To be safe:
                litellm_model = model if model.startswith("claude") else f"anthropic/{model}"
                os.environ["ANTHROPIC_API_KEY"] = api_key
            else:
                litellm_model = model
                os.environ["OPENAI_API_KEY"] = api_key

            schema_instruction = f"""
First, provide your conversational response to the user. You may use markdown formatting and links.
After your response, you MUST append a RAW JSON block enclosed in ```json ... ``` containing the entities and relations extracted from your response. YOU MUST INCLUDE THIS JSON BLOCK EVEN IF NO ENTITIES WERE FOUND.

The JSON MUST conform exactly to this schema:
{json.dumps(agent_spec.output_schema)}

IMPORTANT RULES:
1. You must ALWAYS append the ```json ... ``` block at the very end of your response.
2. If there are no entities, output ```json\n{{"summary": "...", "entities": [], "relations": []}}\n```
3. 'entities' MUST be an array of objects, each with 'id', 'label', and 'type'.
4. 'relations' MUST be an array of objects, each with 'source', 'target', and 'type'.
"""

            messages = [
                {"role": "system", "content": agent_spec.system_prompt},
                {"role": "user", "content": f"Input: {json.dumps(input_data)}\n\n{schema_instruction}"}
            ]

            response = await acompletion(
                model=litellm_model,
                messages=messages,
                stream=True
            )

            full_response = ""
            async for chunk in response:
                content = chunk.choices[0].delta.content or ""
                if content:
                    full_response += content
                    await publish_event(channel, "run.token", {"token": content})
                    
            try:
                # Try to parse the JSON block. Be forgiving if the LLM forgets the 'json' tag.
                import re
                json_str = None
                json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', full_response, re.DOTALL)
                if json_match:
                    json_str = json_match.group(1).strip()
                else:
                    # Fallback to finding the last `{...}` block. We find the last `{` and then expand backwards until json.loads succeeds
                    start_idx = full_response.rfind('{')
                    end_idx = full_response.rfind('}')
                    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                        # Try to find a valid JSON object by moving start_idx backwards to previous '{'
                        temp_start = start_idx
                        while temp_start >= 0:
                            try:
                                candidate = full_response[temp_start:end_idx+1]
                                json.loads(candidate)
                                json_str = candidate
                                break
                            except:
                                temp_start = full_response.rfind('{', 0, temp_start)

                if json_str:
                    parsed = json.loads(json_str)
                    summary = full_response[:full_response.rfind(json_str)].strip()
                    # clean up any trailing ``` if they exist
                    summary = summary.replace("```json", "").replace("```", "").strip()
                else:
                    print("WARNING: LLM did not output a JSON block", flush=True)
                    parsed = {"entities": [], "relations": []}
                    summary = full_response
            except Exception as e:
                print(f"ERROR parsing LLM JSON output: {e}", flush=True)
                parsed = {"entities": [], "relations": []}
                summary = full_response
                
            output = AgentOutput(
                summary=summary,
                entities=parsed.get("entities", []),
                relations=parsed.get("relations", []),
                raw={"original_response": full_response}
            )
            
            await publish_event(channel, "run.finished", {
                "output": output.model_dump(),
                "context": context
            })
            
        except Exception as e:
            await publish_event(channel, "run.error", {"error": str(e)})

orchestrator = Orchestrator()
