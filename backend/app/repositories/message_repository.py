from abc import ABC, abstractmethod

from ..entities.message import Message


class MessageRepository(ABC):
    """
    Абстрактный репозиторий получения сообщений.
    """

    @abstractmethod
    async def get_message(self) -> Message:  # noqa: D401
        """Возвращает сообщение."""
        raise NotImplementedError
