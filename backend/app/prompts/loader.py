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

from functools import lru_cache
from pathlib import Path

# Compute project root (…/backend) then append ``promts`` directory
_BASE_DIR = Path(__file__).resolve().parents[2]
_PROMTS_DIR = _BASE_DIR / "promts"


@lru_cache(maxsize=None)
def load_prompt(name: str) -> str:
    """Return *system* prompt text stored in ``promts/{name}.txt``.

    The text file must contain one or more non-empty lines comprising the
    *system* prompt.  No *user* prompt is stored in these files any longer.
    """
    path = (_PROMTS_DIR / f"{name}.txt").resolve()
    if not path.exists():
        raise FileNotFoundError(f"Prompt file not found: {path}")

    with path.open(encoding="utf-8") as fp:
        # Strip whitespace and skip blank lines
        lines = [ln.strip() for ln in fp if ln.strip()]

    if not lines:
        raise ValueError(f"Prompt file {path} is empty")

    # Join multiple non-empty lines with spaces to form a single prompt string
    system_prompt = " ".join(lines)
    return system_prompt
