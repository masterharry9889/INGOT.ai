# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_data_files, collect_all

datas = []
datas += collect_data_files('litellm')
datas += collect_data_files('tiktoken')
binaries = []
hiddenimports = ['uvicorn', 'uvicorn.logging', 'uvicorn.loops', 'uvicorn.loops.auto', 'uvicorn.loops.asyncio', 'uvicorn.protocols', 'uvicorn.protocols.http', 'uvicorn.protocols.http.auto', 'uvicorn.protocols.http.h11_impl', 'uvicorn.protocols.http.httptools_impl', 'uvicorn.protocols.websockets', 'uvicorn.protocols.websockets.auto', 'uvicorn.protocols.websockets.websockets_impl', 'uvicorn.lifespan', 'uvicorn.lifespan.on', 'uvicorn.lifespan.off', 'fastapi', 'aiosqlite', 'sqlalchemy.sql.default_comparator', 'websockets', 'pydantic', 'litellm', 'tiktoken_ext', 'tiktoken_ext.openai_public']

tmp_ret = collect_all('pydantic_core')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]

# Explicitly add the python 3.11 .pyd file because global Pyinstaller (3.14) collect_all misses it
binaries.append(('D:\\BrainWeb.ai\\venv\\Lib\\site-packages\\pydantic_core\\_pydantic_core.cp311-win_amd64.pyd', 'pydantic_core'))

a = Analysis(
    ['D:\\BrainWeb.ai\\backend\\main.py'],
    pathex=['D:\\BrainWeb.ai\\venv\\Lib\\site-packages'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['torch', 'tensorflow', 'scipy', 'numpy', 'pandas', 'matplotlib', 'sklearn', 'torchvision', 'torchaudio', 'transformers'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='brainweb-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
