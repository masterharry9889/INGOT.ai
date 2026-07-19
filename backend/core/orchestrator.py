import asyncio
import json
import os
from typing import Dict, Any
from core.schemas import AgentSpec, AgentOutput
from services.pubsub import publish_event
from core.security import decrypt_api_key

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
    ),
    "orchestrator-agent": AgentSpec(
        id="orchestrator-agent",
        name="Orchestrator",
        description="The default agent that chats with you and distributes tasks to other active agents.",
        system_prompt="You are the Orchestrator, the primary conversational agent. You have consulted sub-agents based on the user's query. Provide a cohesive, unified response to the user summarizing their findings.",
        input_schema={"user_query": "string", "sub_agent_findings": "object"},
        output_schema={"summary": "string", "entities": "array", "relations": "array"}
    )
}

class Orchestrator:
    def __init__(self):
        self.agents = BUILTIN_AGENTS.copy()

    def get_agents(self) -> Dict[str, AgentSpec]:
        return self.agents

    async def _execute_agent_logic(self, agent_spec: AgentSpec, input_data: Dict[str, Any], user_setting: Any, channel: str = None) -> AgentOutput:
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
                if channel:
                    await publish_event(channel, "run.token", {"token": content})
                
        try:
            import re
            json_str = None
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', full_response, re.DOTALL)
            if json_match:
                json_str = json_match.group(1).strip()
            else:
                start_idx = full_response.rfind('{')
                end_idx = full_response.rfind('}')
                if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
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
                summary = summary.replace("```json", "").replace("```", "").strip()
            else:
                if channel: print("WARNING: LLM did not output a JSON block", flush=True)
                parsed = {"entities": [], "relations": []}
                summary = full_response
        except Exception as e:
            if channel: print(f"ERROR parsing LLM JSON output: {e}", flush=True)
            parsed = {"entities": [], "relations": []}
            summary = full_response
            
        return AgentOutput(
            summary=summary,
            entities=parsed.get("entities", []),
            relations=parsed.get("relations", []),
            raw={"original_response": full_response}
        )

    async def run_agent_async(self, run_id: str, agent_spec: AgentSpec, input_data: Dict[str, Any], context: Dict[str, Any], user_setting: Any = None):
        channel = f"runs:{run_id}"
        
        try:
            await publish_event(channel, "run.started", {"agent_id": agent_spec.id})
            
            if agent_spec.id == "orchestrator-agent":
                sub_agents_ids = input_data.get("sub_agents", [])
                sub_results = {}
                accumulated_entities = []
                accumulated_relations = []
                
                # Execute sub-agents
                for sid in sub_agents_ids:
                    s_spec = self.agents.get(sid)
                    if s_spec and s_spec.id != "orchestrator-agent":
                        await publish_event(channel, "run.token", {"token": f"\n\n*[Consulting {s_spec.name}...]*\n\n"})
                        out = await self._execute_agent_logic(s_spec, input_data, user_setting, channel)
                        sub_results[s_spec.name] = out.summary
                        if out.entities:
                            for e in out.entities:
                                e["id"] = f"{s_spec.id}_{e.get('id')}"
                            accumulated_entities.extend(out.entities)
                        if out.relations:
                            for r in out.relations:
                                r["source"] = f"{s_spec.id}_{r.get('source')}"
                                r["target"] = f"{s_spec.id}_{r.get('target')}"
                            accumulated_relations.extend(out.relations)
                        
                orch_input = {
                    "user_query": input_data.get("query"),
                    "sub_agent_findings": sub_results
                }
                output = await self._execute_agent_logic(agent_spec, orch_input, user_setting, channel)
                
                if accumulated_entities:
                    output.entities.extend(accumulated_entities)
                if accumulated_relations:
                    output.relations.extend(accumulated_relations)
            else:
                output = await self._execute_agent_logic(agent_spec, input_data, user_setting, channel)
            
            await publish_event(channel, "run.finished", {
                "output": output.model_dump(),
                "context": context
            })
            
        except Exception as e:
            await publish_event(channel, "run.error", {"error": str(e)})

orchestrator = Orchestrator()
