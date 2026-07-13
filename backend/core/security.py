import os
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

# In a real app, this MUST come from an environment variable and never be committed.
SECRET_KEY = os.environ.get("INGOT_SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("INGOT_SECRET_KEY environment variable is missing. Please set it securely.")
fernet = Fernet(SECRET_KEY.encode('utf-8'))

def encrypt_api_key(api_key: str) -> str:
    return fernet.encrypt(api_key.encode('utf-8')).decode('utf-8')

def decrypt_api_key(encrypted_key: str) -> str:
    return fernet.decrypt(encrypted_key.encode('utf-8')).decode('utf-8')

def mask_api_key(api_key: str) -> str:
    if len(api_key) <= 8:
        return "***"
    return f"{api_key[:3]}...{api_key[-4:]}"
