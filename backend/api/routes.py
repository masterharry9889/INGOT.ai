import uuid
from fastapi import APIRouter, BackgroundTasks, WebSocket, WebSocketDisconnect, Depends, HTTPException, UploadFile, File
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ..core.schemas import AgentSpec, RunInput, RunResponse, SettingsInput, SettingsOutput, NodeUpdateInput, NodeMergeInput, EdgeCreateInput
from ..core.orchestrator import orchestrator
from ..services.pubsub import subscribe_events
from ..database import get_db
from ..models import UserSettings, CustomAgent
from ..core.security import encrypt_api_key, mask_api_key

router = APIRouter()
DEFAULT_USER_ID = "default_user"

# --- AGENT ROUTES ---

@router.get("/agents", response_model=List[AgentSpec])
async def list_agents(db: AsyncSession = Depends(get_db)):
    builtins = list(orchestrator.get_agents().values())
    
    # Fetch custom agents
    result = await db.execute(select(CustomAgent))
    customs_db = result.scalars().all()
    customs = [
        AgentSpec(
            id=c.id,
            name=c.name,
            description=c.description,
            system_prompt=c.system_prompt,
            tools=c.tools,
            input_schema=c.input_schema,
            output_schema=c.output_schema
        ) for c in customs_db
    ]
    
    return builtins + customs

@router.post("/agents/custom", response_model=AgentSpec)
async def create_custom_agent(spec: AgentSpec, db: AsyncSession = Depends(get_db)):
    if spec.id in orchestrator.get_agents():
        raise HTTPException(status_code=400, detail="Cannot overwrite a built-in agent.")
        
    result = await db.execute(select(CustomAgent).where(CustomAgent.id == spec.id))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Custom agent with this ID already exists.")
        
    db_agent = CustomAgent(
        id=spec.id,
        name=spec.name,
        description=spec.description,
        system_prompt=spec.system_prompt,
        tools=spec.tools,
        input_schema=spec.input_schema,
        output_schema=spec.output_schema
    )
    db.add(db_agent)
    await db.commit()
    return spec

@router.put("/agents/custom/{agent_id}", response_model=AgentSpec)
async def update_custom_agent(agent_id: str, spec: AgentSpec, db: AsyncSession = Depends(get_db)):
    if agent_id != spec.id:
        raise HTTPException(status_code=400, detail="Path ID and payload ID must match.")
        
    result = await db.execute(select(CustomAgent).where(CustomAgent.id == agent_id))
    db_agent = result.scalars().first()
    if not db_agent:
        raise HTTPException(status_code=404, detail="Custom agent not found.")
        
    db_agent.name = spec.name
    db_agent.description = spec.description
    db_agent.system_prompt = spec.system_prompt
    db_agent.tools = spec.tools
    db_agent.input_schema = spec.input_schema
    db_agent.output_schema = spec.output_schema
    
    await db.commit()
    return spec

@router.delete("/agents/custom/{agent_id}")
async def delete_custom_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CustomAgent).where(CustomAgent.id == agent_id))
    db_agent = result.scalars().first()
    if not db_agent:
        raise HTTPException(status_code=404, detail="Custom agent not found.")
        
    await db.delete(db_agent)
    await db.commit()
    return {"status": "success"}

# --- RUN ROUTES ---

@router.post("/agents/run", response_model=RunResponse)
async def run_agent(run_input: RunInput, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    # Gate: Check if API key is configured
    # Order by updated_at to get the most recently configured provider
    result = await db.execute(
        select(UserSettings)
        .where(UserSettings.user_id == DEFAULT_USER_ID)
        .order_by(UserSettings.updated_at.desc())
    )
    user_setting = result.scalars().first()
    if not user_setting:
        raise HTTPException(status_code=403, detail="api_key_required")

    # Resolve agent
    agent_spec = orchestrator.get_agents().get(run_input.agent_id)
    if not agent_spec:
        # Check custom agents
        agent_result = await db.execute(select(CustomAgent).where(CustomAgent.id == run_input.agent_id))
        db_agent = agent_result.scalars().first()
        if not db_agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        agent_spec = AgentSpec(
            id=db_agent.id,
            name=db_agent.name,
            description=db_agent.description,
            system_prompt=db_agent.system_prompt,
            tools=db_agent.tools,
            input_schema=db_agent.input_schema,
            output_schema=db_agent.output_schema
        )
        
    run_id = str(uuid.uuid4())
    
    context = run_input.context or {}
    context["project_id"] = run_input.project_id

    # Kick off the agent asynchronously
    background_tasks.add_task(
        orchestrator.run_agent_async,
        run_id=run_id,
        agent_spec=agent_spec,
        input_data=run_input.input,
        context=context,
        user_setting=user_setting
    )
    
    from datetime import datetime, timezone
    return RunResponse(
        run_id=run_id,
        agent_id=run_input.agent_id,
        status="started",
        created_at=datetime.now(timezone.utc)
    )

@router.websocket("/runs/{run_id}")
async def websocket_endpoint(websocket: WebSocket, run_id: str):
    await websocket.accept()
    channel = f"runs:{run_id}"
    try:
        async for event in subscribe_events(channel):
            await websocket.send_json(event)
            if event['type'] in ['run.finished', 'run.error']:
                break
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

# --- SETTINGS ROUTES ---

@router.post("/settings", response_model=SettingsOutput)
async def update_settings(settings: SettingsInput, db: AsyncSession = Depends(get_db)):
    if len(settings.api_key) < 10:
        raise HTTPException(status_code=400, detail="Invalid API Key format")

    result = await db.execute(
        select(UserSettings).where(
            (UserSettings.user_id == DEFAULT_USER_ID) & 
            (UserSettings.provider == settings.provider)
        )
    )
    user_setting = result.scalars().first()
    encrypted_key = encrypt_api_key(settings.api_key)

    if user_setting:
        user_setting.provider = settings.provider
        user_setting.api_key_encrypted = encrypted_key
        user_setting.model_name = settings.model_name
    else:
        user_setting = UserSettings(
            user_id=DEFAULT_USER_ID,
            provider=settings.provider,
            api_key_encrypted=encrypted_key,
            model_name=settings.model_name
        )
        db.add(user_setting)
        
    await db.commit()
    return SettingsOutput(
        provider=user_setting.provider,
        api_key_masked=mask_api_key(settings.api_key),
        model_name=user_setting.model_name
    )

@router.get("/settings", response_model=List[SettingsOutput])
async def get_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == DEFAULT_USER_ID))
    user_settings = result.scalars().all()
    
    from ..core.security import decrypt_api_key
    outputs = []
    for s in user_settings:
        raw_key = decrypt_api_key(s.api_key_encrypted)
        outputs.append(
            SettingsOutput(
                provider=s.provider,
                api_key_masked=mask_api_key(raw_key),
                model_name=s.model_name
            )
        )
    return outputs

@router.delete("/settings/{provider}")
async def delete_settings(provider: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserSettings).where(
            (UserSettings.user_id == DEFAULT_USER_ID) & 
            (UserSettings.provider == provider)
        )
    )
    user_setting = result.scalars().first()
    if user_setting:
        await db.delete(user_setting)
        await db.commit()
    return {"status": "success"}

# --- GRAPH ROUTES ---
from ..models import Node, Edge

@router.get("/graph/{project_id}")
async def get_graph(project_id: str, db: AsyncSession = Depends(get_db)):
    nodes_result = await db.execute(select(Node).where(Node.project_id == project_id))
    edges_result = await db.execute(select(Edge).where(Edge.project_id == project_id))
    
    nodes = nodes_result.scalars().all()
    edges = edges_result.scalars().all()
    
    return {
        "nodes": [
            {"id": n.id, "label": n.label, "type": n.type, "mention_count": n.mention_count} 
            for n in nodes
        ],
        "edges": [
            {"id": e.id, "source": e.source_id, "target": e.target_id, "weight": e.weight, "type": e.relation_type}
            for e in edges
        ]
    }

@router.delete("/graph/{project_id}")
async def delete_graph(project_id: str, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import delete
    await db.execute(delete(Edge).where(Edge.project_id == project_id))
    await db.execute(delete(Node).where(Node.project_id == project_id))
    await db.commit()
    return {"status": "success"}

@router.get("/graph/node/{node_id}")
async def get_node(node_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Node).where(Node.id == node_id))
    node = result.scalars().first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
        
    edges_result = await db.execute(
        select(Edge).where((Edge.source_id == node_id) | (Edge.target_id == node_id))
    )
    edges = edges_result.scalars().all()
    
    return {
        "node": {"id": node.id, "label": node.label, "type": node.type, "mention_count": node.mention_count},
        "edges": [
            {"id": e.id, "source": e.source_id, "target": e.target_id, "weight": e.weight, "type": e.relation_type}
            for e in edges
        ]
    }

@router.put("/graph/node/{node_id}")
async def update_node(node_id: str, input: NodeUpdateInput, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Node).where(Node.id == node_id))
    node = result.scalars().first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    node.label = input.label
    node.type = input.type
    await db.commit()
    
    from ..services.pubsub import publish_event
    await publish_event("graph:live", "graph.update", {
        "project_id": node.project_id,
        "nodes": [{"id": node.id, "label": node.label, "type": node.type, "action": "updated"}],
        "edges": []
    })
    return {"status": "success"}

@router.delete("/graph/node/{node_id}")
async def delete_node_route(node_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Node).where(Node.id == node_id))
    node = result.scalars().first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
        
    project_id = node.project_id
    from sqlalchemy import delete
    await db.execute(delete(Edge).where((Edge.source_id == node_id) | (Edge.target_id == node_id)))
    await db.execute(delete(Node).where(Node.id == node_id))
    await db.commit()
    
    from ..services.pubsub import publish_event
    await publish_event("graph:live", "graph.update", {
        "project_id": project_id,
        "nodes": [{"id": node_id, "action": "deleted"}],
        "edges": []
    })
    return {"status": "success"}

@router.post("/graph/node/{node_id}/merge")
async def merge_node(node_id: str, input: NodeMergeInput, db: AsyncSession = Depends(get_db)):
    if node_id == input.target_id:
        raise HTTPException(status_code=400, detail="Cannot merge a node into itself")
        
    result_src = await db.execute(select(Node).where(Node.id == node_id))
    src_node = result_src.scalars().first()
    if not src_node:
        raise HTTPException(status_code=404, detail="Source node not found")
        
    result_tgt = await db.execute(select(Node).where(Node.id == input.target_id))
    tgt_node = result_tgt.scalars().first()
    if not tgt_node:
        raise HTTPException(status_code=404, detail="Target node not found")
        
    # Reassign all edges
    edges_src_result = await db.execute(select(Edge).where((Edge.source_id == node_id) | (Edge.target_id == node_id)))
    edges_src = edges_src_result.scalars().all()
    for edge in edges_src:
        if edge.source_id == node_id:
            edge.source_id = input.target_id
        if edge.target_id == node_id:
            edge.target_id = input.target_id
            
    # Add mention counts
    tgt_node.mention_count += src_node.mention_count
    
    from sqlalchemy import delete
    await db.execute(delete(Node).where(Node.id == node_id))
    await db.commit()
    
    from ..services.pubsub import publish_event
    await publish_event("graph:live", "graph.update", {
        "project_id": src_node.project_id,
        "nodes": [
            {"id": tgt_node.id, "label": tgt_node.label, "type": tgt_node.type, "mention_count": tgt_node.mention_count, "action": "updated"},
            {"id": src_node.id, "action": "deleted"}
        ],
        "edges": []
    })
    return {"status": "success"}

@router.post("/graph/edge")
async def create_edge(input: EdgeCreateInput, db: AsyncSession = Depends(get_db)):
    new_edge_id = str(uuid.uuid4())
    new_edge = Edge(
        id=new_edge_id,
        project_id=input.project_id,
        source_id=input.source_id,
        target_id=input.target_id,
        relation_type=input.relation_type,
        weight=1.0,
        created_by_agent="user"
    )
    db.add(new_edge)
    await db.commit()
    
    from ..services.pubsub import publish_event
    await publish_event("graph:live", "graph.update", {
        "project_id": input.project_id,
        "nodes": [],
        "edges": [{"id": new_edge.id, "source": new_edge.source_id, "target": new_edge.target_id, "type": new_edge.relation_type, "weight": 1.0, "action": "created"}]
    })
    return {"status": "success", "id": new_edge_id}

@router.websocket("/graph/live")
async def graph_live_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        async for event in subscribe_events("graph:live"):
            await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

@router.post("/project/upload")
async def upload_project(files: List[UploadFile] = File(...)):
    extracted_text = []
    for file in files:
        try:
            content = await file.read()
            text = content.decode('utf-8')
            extracted_text.append(f"--- File: {file.filename} ---\n{text}\n")
        except UnicodeDecodeError:
            extracted_text.append(f"--- File: {file.filename} ---\n[Binary or non-UTF8 file skipped]\n")
        except Exception as e:
            extracted_text.append(f"--- File: {file.filename} ---\n[Error reading file: {e}]\n")
            
    return {"text": "\n".join(extracted_text)}
