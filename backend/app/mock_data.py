"""Centralised mock responses for all API routes.
These structures match response models used in the project so that the frontend continues
working when the backend is started in mock-mode (APP_MOCK=1) or with ?mock=1.
"""
from __future__ import annotations

from typing import List, Dict, Any

# --- Trajectory ---
TRAJECTORY_MOCK: Dict[str, Any] = {
    "goal": "Освоить основы клеточной биологии и биохимии за 3 месяца",
    "items": [
        {
            "title": "Клетка и ее органоиды",
            "description": "Структура клетки, функции органоидов",
            "skills": {
                "name": "Клеточная биология",
                "recommended_level": 3,
                "user_level": 1,
                "goal_level": 3,
                "levels": [
                    {"level": 2, "level_name": "Базовый", "tasks": []},
                    {"level": 3, "level_name": "Уверенный", "tasks": []},
                ],
            },
            "image_url": None,
            "passedCount": 0,
        }
    ],
}

# --- Generated tasks ---
GENERATED_TASKS_MOCK: Dict[str, Any] = {
    "chat_id": 1,
    "topic": "Клетка и ее органоиды",
    "tasks": [
        {
            "title": "Разбор базовых понятий",
            "level": 2,
            "content_md": "**Мембрана** – это ...",
            "questions_to_consider": [
                {"question": "Чем отличается ядро от нуклеоида?", "answer": "Ядро …"}
            ],
            "tests": [
                {
                    "question": "Что делает митохондрия?",
                    "options": ["Синтезирует белок", "Служит энергостанцией"],
                    "correct": [1],
                    "hint": "Вспомни про ATP",
                    "explanation": "Митохондрия вырабатывает ATP …",
                }
            ],
            "passed": False,
        }
    ],
}

# --- Meta-expand ---
META_EXPAND_MOCK: Dict[str, Any] = {
    "chat_id": 1,
    "items": [
        {"title": "Клетка и ее органоиды", "expansions": ["Мембрана", "Ядро"]},
    ],
}

# --- Extended trajectory ---
EXTENDED_TRAJECTORY_MOCK: Dict[str, Any] = {
    "chat_id": 1,
    "topic": "Клетка и ее органоиды",
    "modules": [
        {"title": "История открытия клетки", "description": "Как открыли клетку"},
    ],
}

# --- Skills ---
SKILLS_MOCK: Dict[str, Any] = {
    "items": [
        {"name": "Клеточная биология", "level": 2, "description": "Базовое понимание"},
        {"name": "Биохимия", "level": 1},
    ]
}

# --- Fact ---
FACT_MOCK: Dict[str, str] = {"content": "Клетки были открыты Робертом Гуком в 1665 году."}

# --- Chat ---
CHAT_MOCK_LIST: List[Dict[str, Any]] = [
    {"id": 1, "title": "Моя первая цель"},
]

CHAT_MOCK_DETAIL: Dict[str, Any] = {
    "id": 1,
    "title": "Моя первая цель",
    "messages": [
        {
            "role": "assistant",
            "content": "Привет! Чем я могу помочь?",
            "suggestions": [],
        }
    ],
}
