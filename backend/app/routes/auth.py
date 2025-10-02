from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..security import hash_pwd, verify_pwd, issue_token

router = APIRouter(prefix="/auth", tags=["auth"])

class Creds(BaseModel):
    email: str
    password: str

@router.post("/register")
def register(creds: Creds, db: Session = Depends(get_db)):
    if db.query(User).filter_by(email=creds.email).first():
        raise HTTPException(status_code=400, detail="User exists")
    u = User(email=creds.email, password=hash_pwd(creds.password))
    db.add(u); db.commit(); db.refresh(u)
    return {"token": issue_token(u.id)}

@router.post("/login")
def login(creds: Creds, db: Session = Depends(get_db)):
    u = db.query(User).filter_by(email=creds.email).first()
    if not u or not verify_pwd(creds.password, u.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"token": issue_token(u.id)}
