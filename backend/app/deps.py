from typing import Optional
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session

from .database import get_db
from .models.user import User
from .security import decode_token

def current_user(token: Optional[str] = Header(None, alias="Authorization"), db: Session = Depends(get_db)) -> User:  # type: ignore
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    if token.lower().startswith("bearer "):
        token = token.split()[1]
    try:
        uid = decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.get(User, uid)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    return user
