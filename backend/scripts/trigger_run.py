import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.services.pubsub import publish_event

async def trigger_run():
    # Publish a fake run.finished event
    await publish_event("runs:fake-run-123", "run.finished", {
        "output": {
            "entities": [
                {"id": "e1", "label": "Live Test Entity", "type": "Test"}
            ],
            "relations": []
        },
        "context": {
            "project_id": "default"
        }
    })
    print("Published run.finished")

if __name__ == "__main__":
    asyncio.run(trigger_run())
