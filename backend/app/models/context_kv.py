from sqlalchemy import Column, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base

class ChatContextKV(Base):
    __tablename__ = "chat_context_kv"
    __table_args__ = (UniqueConstraint("chat_id", "key", name="uq_chat_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chat_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    key: Mapped[str] = mapped_column(String(64), nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
