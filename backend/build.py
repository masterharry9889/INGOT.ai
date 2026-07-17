import PyInstaller.__main__
import os

backend_dir = os.path.dirname(os.path.abspath(__file__))

PyInstaller.__main__.run([
    os.path.join(backend_dir, 'run_backend.py'),
    '--name=brainweb-backend',
    '--onefile',
    '--hidden-import=uvicorn',
    '--hidden-import=uvicorn.logging',
    '--hidden-import=uvicorn.loops',
    '--hidden-import=uvicorn.loops.auto',
    '--hidden-import=uvicorn.loops.asyncio',
    '--hidden-import=uvicorn.protocols',
    '--hidden-import=uvicorn.protocols.http',
    '--hidden-import=uvicorn.protocols.http.auto',
    '--hidden-import=uvicorn.protocols.http.h11_impl',
    '--hidden-import=uvicorn.protocols.http.httptools_impl',
    '--hidden-import=uvicorn.protocols.websockets',
    '--hidden-import=uvicorn.protocols.websockets.auto',
    '--hidden-import=uvicorn.protocols.websockets.websockets_impl',
    '--hidden-import=uvicorn.lifespan',
    '--hidden-import=uvicorn.lifespan.on',
    '--hidden-import=uvicorn.lifespan.off',
    '--hidden-import=fastapi',
    '--hidden-import=aiosqlite',
    '--hidden-import=sqlalchemy.sql.default_comparator',
    '--hidden-import=websockets',
    '--hidden-import=pydantic',
    '--distpath=' + os.path.join(backend_dir, 'dist'),
    '--workpath=' + os.path.join(backend_dir, 'build'),
    '--clean'
])
