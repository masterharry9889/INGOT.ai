import asyncio
import os
import sys

# Ensure we can import from backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.database import engine, async_session, init_db
from backend.models import Node, Edge, CustomAgent
from sqlalchemy import delete
from sqlalchemy.future import select

async def rebuild():
    await init_db()
    
    nodes_file = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../nodes_dump.txt'))
    
    if not os.path.exists(nodes_file):
        print(f"Error: {nodes_file} not found.")
        return

    print("Clearing existing graph...")
    async with async_session() as session:
        await session.execute(delete(Edge))
        await session.execute(delete(Node))
        await session.commit()
        print("Graph cleared.")
    
    print(f"Reading {nodes_file}...")
    nodes_to_insert = []
    with open(nodes_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            
            # Example format:
            # Node ID: 1704b0fd | Project: 1783545818587 | Label: 'Software Development' | Type: Domain
            parts = line.split(" | ")
            if len(parts) >= 4:
                node_id = parts[0].replace("Node ID: ", "").strip()
                project_id = parts[1].replace("Project: ", "").strip()
                label = parts[2].replace("Label: ", "").strip().strip("'")
                type_ = parts[3].replace("Type: ", "").strip()
                
                nodes_to_insert.append(Node(
                    id=node_id,
                    project_id=project_id,
                    label=label,
                    type=type_,
                    mention_count=1
                ))
    
    async with async_session() as session:
        session.add_all(nodes_to_insert)
        await session.commit()
        print(f"Inserted {len(nodes_to_insert)} nodes.")

    print("Creating Graph Manager agent...")
    async with async_session() as session:
        agent_id = "graph-manager"
        result = await session.execute(select(CustomAgent).where(CustomAgent.id == agent_id))
        agent = result.scalars().first()
        
        system_prompt = (
            "You are a Graph Manager agent. Your primary role is to organize concepts "
            "into a clean taxonomy, maintaining graph hygiene. You carefully extract entities "
            "and their relationships from user inputs or texts, ensuring consistent labeling "
            "and avoiding duplicates. Output exact JSON adhering to the provided schema."
        )
        
        if agent:
            agent.name = "Graph Manager"
            agent.description = "Manages and organizes the knowledge graph by extracting clean entities and relationships."
            agent.system_prompt = system_prompt
            print("Graph Manager agent updated.")
        else:
            new_agent = CustomAgent(
                id=agent_id,
                name="Graph Manager",
                description="Manages and organizes the knowledge graph by extracting clean entities and relationships.",
                system_prompt=system_prompt,
                input_schema={"text": "string"},
                output_schema={"entities": "array", "relations": "array", "summary": "string"}
            )
            session.add(new_agent)
            print("Graph Manager agent created.")
            
        await session.commit()

    print("Rebuild complete.")

if __name__ == "__main__":
    asyncio.run(rebuild())
