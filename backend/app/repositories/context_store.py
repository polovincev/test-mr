from __future__ import annotations

from typing import Any, Dict, Optional


_context_by_chat_id: Dict[int, Dict[str, Any]] = {}


def upsert_goal(chat_id: int, goal_text: str) -> None:
    ctx = _context_by_chat_id.setdefault(chat_id, {})
    ctx["goal"] = str(goal_text).strip()


def upsert_profile(chat_id: int, profile: dict) -> None:
    ctx = _context_by_chat_id.setdefault(chat_id, {})
    ctx["profile"] = profile


def get_context(chat_id: int) -> Dict[str, Any]:
    return _context_by_chat_id.get(chat_id, {})


# Trajectory helpers
def get_trajectory(chat_id: int):
    return _context_by_chat_id.get(chat_id, {}).get("trajectory")


def set_trajectory(chat_id: int, trajectory):
    ctx = _context_by_chat_id.setdefault(chat_id, {})
    ctx["trajectory"] = trajectory


