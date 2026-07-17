import sys
import os
import multiprocessing

# Add parent directory to sys.path so 'backend' is recognized as a package
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

import uvicorn
from backend.main import app

if __name__ == '__main__':
    multiprocessing.freeze_support()
    uvicorn.run(app, host="0.0.0.0", port=8000)
