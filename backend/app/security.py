import os, datetime, jwt
from passlib.context import CryptContext

# Use Argon2 as primary, keep bcrypt for verifying old hashes
pwd_ctx = CryptContext(schemes=["argon2", "bcrypt"], default="argon2", deprecated="auto")

SECRET = os.getenv("JWT_SECRET", "change-me")
ALGO = "HS256"
TTL_MIN = 60 * 24  # 1 day

def hash_pwd(p: str) -> str:
    """Hash password using Argon2."""
    return pwd_ctx.hash(p)

def verify_pwd(p: str, h: str) -> bool:
    """Verify password against hash supporting Argon2 and legacy bcrypt."""
    return pwd_ctx.verify(p, h)

def issue_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=TTL_MIN),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGO)

def decode_token(tok: str) -> int:
    return int(jwt.decode(tok, SECRET, algorithms=[ALGO])["sub"])
