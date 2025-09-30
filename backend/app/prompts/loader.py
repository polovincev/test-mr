from __future__ import annotations

"""Utility for loading prompt files with caching.

Prompt text files reside in the ``backend/promts`` directory (one level above
``backend/app``).  Each prompt file should contain at least one non-empty line:
- If the file contains more than one line, the **last** non-empty line is
  treated as the *user* prompt, while all preceding non-empty lines joined with
  spaces make up the *system* prompt.
- If the file contains exactly one non-empty line, it is interpreted as the
  system prompt and the user prompt defaults to an empty string (or a caller
  provided default).

The function :func:`load_prompt` returns a tuple ``(system_prompt, user_prompt)``
that can be passed directly to an OpenAI chat completion call.
"""

# Lazy import to avoid circular deps at startup
from functools import lru_cache
from pathlib import Path

# Try to import DB session & model lazily to avoid circular deps at import time
try:
    from ..database import SessionLocal  # type: ignore
    from ..models import Prompt  # type: ignore
except Exception:  # pragma: no cover
    SessionLocal = None  # type: ignore
    Prompt = None  # type: ignore


def load_prompt(name: str) -> str:
    """Return prompt text by *name* stored in database (column ``current_text``).

    Raises FileNotFoundError if record is missing so callers can handle absent
    prompts explicitly.
    """

    with SessionLocal() as db:  # type: ignore
        row = db.query(Prompt).filter_by(name=name).first()
        if not row:
            raise FileNotFoundError(f"Prompt '{name}' not found in database")
        return row.current_text  # type: ignore[attr-defined]
