from dataclasses import dataclass


@dataclass
class Message:
    """
    Сущность «Сообщение».
    """
    content: str
