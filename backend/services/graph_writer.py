import asyncio
import hashlib
import json
import uuid
from typing import List, Dict, Any
from sqlalchemy.future import select
from sqlalchemy import text
from ..database import async_session
from ..models import Node, Edge
from .pubsub import psubscribe_events, publish_event

def generate_mock_embedding(text: str) -> List[float]:
    """
    Generates a deterministic 1536-dimensional vector for a given string
    to simulate an OpenAI embedding for v1 local testing.
    """
    h = hashlib.sha256(text.encode('utf-8')).digest()
    # Create a vector by repeating and slightly modifying the hash values
    vector = [float(b) / 255.0 for b in h]
    # Repeat to fill 1536
    extended_vector = (vector * 48)
    # Normalize (optional, but good for cosine distance)
    length = sum(x**2 for x in extended_vector) ** 0.5
    if length == 0:
        return [0.0] * 1536
    return [x / length for x in extended_vector]

async def process_event(event: dict):
    if event.get("type") != "run.finished":
        return
        
    data = event.get("data", {})
    output = data.get("output", {})
    context = data.get("context", {})
    project_id = context.get("project_id", "default")
    
    entities = output.get("entities", [])
    relations = output.get("relations", [])
    
    print(f"Graph Writer processing project_id={project_id} | Entities: {len(entities)}, Relations: {len(relations)}", flush=True)
    
    if not entities and not relations:
        print("Skipping graph update (empty entities/relations)", flush=True)
        return
        
    nodes_added = []
    edges_added = []
    
    async with async_session() as db:
        node_id_map = {} # Maps incoming entity ID to actual DB node ID
        
        for entity in entities:
            label = entity.get("label", "").strip()
            if not label:
                continue
            type_ = entity.get("type", "Entity")
            embedding = generate_mock_embedding(label)
            
            # Exact label match or Cosine Distance < 0.1 (Similarity > 0.9)
            # pgvector cosine distance operator is <=>
            query = select(Node).where(
                (Node.project_id == project_id) &
                (Node.label == label)
            ).limit(1)
            
            result = await db.execute(query)
            existing_node = result.scalars().first()
            
            if existing_node:
                existing_node.mention_count += 1
                # In a real app we might merge metadata here
                node_id_map[entity.get("id")] = existing_node.id
                nodes_added.append({
                    "id": existing_node.id, 
                    "label": existing_node.label, 
                    "mention_count": existing_node.mention_count,
                    "type": existing_node.type,
                    "action": "updated"
                })
            else:
                new_id = str(uuid.uuid4())
                new_node = Node(
                    id=new_id,
                    project_id=project_id,
                    label=label,
                    type=type_,
                    embedding=embedding,
                    mention_count=1
                )
                db.add(new_node)
                node_id_map[entity.get("id")] = new_id
                nodes_added.append({
                    "id": new_node.id, 
                    "label": new_node.label, 
                    "mention_count": 1,
                    "type": new_node.type,
                    "action": "created"
                })
                
        # Helper to get or create stub node
        async def get_or_create_stub(ref_id):
            if not ref_id: return None
            if ref_id in node_id_map: return node_id_map[ref_id]
            # Create stub node with the ref_id as the label
            new_id = str(uuid.uuid4())
            stub_node = Node(id=new_id, project_id=project_id, label=ref_id, type="Entity", embedding=generate_mock_embedding(ref_id), mention_count=1)
            db.add(stub_node)
            node_id_map[ref_id] = new_id
            nodes_added.append({"id": new_id, "label": ref_id, "mention_count": 1, "type": "Entity", "action": "created"})
            return new_id

        # Handle relations (edges)
        for relation in relations:
            source_id = await get_or_create_stub(relation.get("source"))
            target_id = await get_or_create_stub(relation.get("target"))
            relation_type = relation.get("type", "related_to")
            
            if source_id and target_id:
                # Check for existing edge
                query = select(Edge).where(
                    (Edge.project_id == project_id) &
                    (Edge.source_id == source_id) & 
                    (Edge.target_id == target_id) & 
                    (Edge.relation_type == relation_type)
                )
                result = await db.execute(query)
                existing_edge = result.scalars().first()
                
                if existing_edge:
                    existing_edge.weight += 1.0
                    edges_added.append({
                        "id": existing_edge.id,
                        "source": existing_edge.source_id,
                        "target": existing_edge.target_id,
                        "weight": existing_edge.weight,
                        "type": existing_edge.relation_type,
                        "action": "updated"
                    })
                else:
                    new_edge_id = str(uuid.uuid4())
                    new_edge = Edge(
                        id=new_edge_id,
                        project_id=project_id,
                        source_id=source_id,
                        target_id=target_id,
                        relation_type=relation_type,
                        weight=1.0,
                        created_by_agent="system"
                    )
                    db.add(new_edge)
                    edges_added.append({
                        "id": new_edge.id,
                        "source": new_edge.source_id,
                        "target": new_edge.target_id,
                        "weight": 1.0,
                        "type": new_edge.relation_type,
                        "action": "created"
                    })
                    
        await db.commit()
        
    # Broadcast updates to graph/live
    if nodes_added or edges_added:
        await publish_event("graph:live", "graph.update", {
            "project_id": project_id,
            "nodes": nodes_added,
            "edges": edges_added
        })

async def run_graph_writer():
    print("Graph Writer started. Listening for run events...", flush=True)
    async for event in psubscribe_events("runs:*"):
        print(f"Graph Writer received event: {event.get('type')}", flush=True)
        try:
            await process_event(event)
        except Exception as e:
            print(f"Graph Writer error processing event: {e}", flush=True)

if __name__ == "__main__":
    asyncio.run(run_graph_writer())
