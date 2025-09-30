"""Utility to load *.txt prompt files from backend/promts into database."""
from pathlib import Path
from sqlalchemy.orm import Session

from .models import Prompt

PROMTS_DIR = Path(__file__).resolve().parents[1] / "promts"


def migrate_prompts(db: Session) -> None:
    """Insert prompt files into DB if not already present."""
    if not PROMTS_DIR.exists():
        return

    for file in PROMTS_DIR.glob("*.txt"):
        name = file.stem
        exists = db.query(Prompt).filter_by(name=name).first()
        if exists:
            continue
        text_lines = [ln.strip() for ln in file.read_text(encoding="utf-8").splitlines() if ln.strip()]
        if not text_lines:
            continue
        joined = " ".join(text_lines)
        prompt = Prompt(name=name, current_text=joined, default_text=joined)
        db.add(prompt)
    db.commit()
