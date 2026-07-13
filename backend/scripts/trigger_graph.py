import urllib.request
import json

url = "http://127.0.0.1:8000/graph/edge"
data = {"project_id": "default", "source_id": "abc", "target_id": "def", "relation_type": "test"}
req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={"Content-Type": "application/json"})
with urllib.request.urlopen(req) as response:
    print(response.read().decode())
