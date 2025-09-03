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


def get_tasks(chat_id: int, topic: str) -> Any:
    ctx = _context_by_chat_id.get(chat_id, {})
    tasks_by_topic = ctx.get("tasks") or {}
    if isinstance(tasks_by_topic, dict):
        return tasks_by_topic.get(str(topic).strip())
    return None


def set_tasks(chat_id: int, topic: str, tasks: Any) -> None:
    ctx = _context_by_chat_id.setdefault(chat_id, {})
    tasks_by_topic = ctx.setdefault("tasks", {})
    if isinstance(tasks_by_topic, dict):
        tasks_by_topic[str(topic).strip()] = tasks


# --- Summary chat storage -------------------------------------------------

def get_summary_messages(chat_id: int) -> list[dict]:
    ctx = _context_by_chat_id.get(chat_id, {})
    msgs = ctx.get("summary_chat_messages")
    if isinstance(msgs, list):
        return msgs  # type: ignore[return-value]
    return []


def append_summary_message(chat_id: int, role: str, content: str) -> None:
    ctx = _context_by_chat_id.setdefault(chat_id, {})
    msgs = ctx.setdefault("summary_chat_messages", [])
    if isinstance(msgs, list):
        msgs.append({"role": str(role), "content": str(content)})


def clear_summary_messages(chat_id: int) -> None:
    ctx = _context_by_chat_id.setdefault(chat_id, {})
    ctx["summary_chat_messages"] = []

