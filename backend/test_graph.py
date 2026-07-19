import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from database import init_db
from services.graph_writer import process_event
from sqlalchemy.future import select
from models import Node, Edge
from database import async_session

async def test_writer():
    await init_db()
    event = {
        "type": "run.finished",
        "data": {
            "output": {
                "entities": [
                    {"id": "agent_e1", "label": "BrainWeb", "type": "Concept"},
                    {"id": "agent_e2", "label": "Graph", "type": "Concept"}
                ],
                "relations": [
                    {"source": "agent_e1", "target": "agent_e2", "type": "uses"}
                ]
            },
            "context": {
                "project_id": "test_proj"
            }
        }
    }
    await process_event(event)
    
    async with async_session() as db:
        nodes = (await db.execute(select(Node).where(Node.project_id == "test_proj"))).scalars().all()
        edges = (await db.execute(select(Edge).where(Edge.project_id == "test_proj"))).scalars().all()
        print(f"Nodes: {len(nodes)}")
        for n in nodes:
            print(f" - {n.label} ({n.id})")
        print(f"Edges: {len(edges)}")
        for e in edges:
            print(f" - {e.source_id} -> {e.target_id}")

if __name__ == "__main__":
    asyncio.run(test_writer())
