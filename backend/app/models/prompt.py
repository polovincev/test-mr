from sqlalchemy import Column, Integer, String, Text

from ..database import Base


class Prompt(Base):
    """DB model storing long system/user prompts text."""

    __tablename__ = "prompts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), unique=True, nullable=False)
    current_text = Column(Text, nullable=False)
    default_text = Column(Text, nullable=False)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Prompt {self.name[:20]}...>"
