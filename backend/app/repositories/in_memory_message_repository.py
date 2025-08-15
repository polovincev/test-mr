from ..entities.message import Message
from .message_repository import MessageRepository


class InMemoryMessageRepository(MessageRepository):
    """
    Простейшая реализация репозитория, возвращающая фиксированное сообщение.
    """

    async def get_message(self) -> Message:
        return Message(content="Привет от бэкенда!")
