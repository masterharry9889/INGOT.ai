import PyInstaller.__main__
import os

backend_dir = os.path.dirname(os.path.abspath(__file__))

PyInstaller.__main__.run([
    os.path.join(backend_dir, 'run_backend.py'),
    '--name=brainweb-backend',
    '--onefile',
    '--hidden-import=uvicorn',
    '--hidden-import=fastapi',
    '--hidden-import=aiosqlite',
    '--hidden-import=sqlalchemy.sql.default_comparator',
    '--hidden-import=websockets',
    '--hidden-import=pydantic',
    '--distpath=' + os.path.join(backend_dir, 'dist'),
    '--workpath=' + os.path.join(backend_dir, 'build'),
    '--clean'
])
