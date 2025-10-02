from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password: Mapped[str] = mapped_column(String(1024), nullable=False)  # increased to handle long bcrypt hashes
