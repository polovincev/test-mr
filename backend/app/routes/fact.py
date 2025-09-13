import os
from fastapi import APIRouter  # type: ignore
from pydantic import BaseModel  # type: ignore
from datetime import datetime, timedelta

try:
    # Optional in dev: load .env if present
    from dotenv import load_dotenv  # type: ignore

    load_dotenv()  # no-op if file not found
except Exception:
    pass

router = APIRouter(tags=["fact"])


class FactResponse(BaseModel):
    content: str


# ---- internal helpers ----
# Generate fresh fact via OpenAI (may take a few seconds)
def _generate_fact_via_openai() -> str:
    """Generate a short 'fact of the day' using OpenAI (Russian).

    Falls back to a static string if the API key is missing or request fails.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return "Пчёлы способны узнавать человеческие лица по узорам."

    try:
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=api_key)
        # Get system & user prompts via shared loader (caches between calls)
        from app.prompts.loader import load_prompt  # type: ignore

        system_prompt = load_prompt("fact_system")

        # Use faster, cheaper model; allow override via env FAST_OPENAI_MODEL
        fast_model = os.getenv("FAST_OPENAI_MODEL", "gpt-3.5-turbo-0125")
        completion = client.chat.completions.create(
            model=fast_model,
            messages=[
                {"role": "system", "content": system_prompt}
            ],
            temperature=0.7,
            max_tokens=100,
        )
        content = completion.choices[0].message.content if completion.choices else None
        if not content:
            raise RuntimeError("empty completion")
        # Safety: trim to a couple of sentences
        return content.strip()
    except Exception as e:
        print("Error generating fact", e)
        return "ДНК всех людей совпадает примерно на 99,9%."


# ---- simple in-process cache (24 h) ----
_fact_cache_content: str | None = None
_fact_cache_timestamp: datetime | None = None


def _get_cached_fact() -> str:
    """Return cached fact or generate new one if older than 24 h."""
    global _fact_cache_content, _fact_cache_timestamp
    now = datetime.utcnow()
    needs_refresh = (
        _fact_cache_content is None
        or _fact_cache_timestamp is None
        or (now - _fact_cache_timestamp) > timedelta(hours=24)
    )
    if needs_refresh:
        _fact_cache_content = _generate_fact_via_openai()
        _fact_cache_timestamp = now
    return _fact_cache_content  # type: ignore


# Generate once at startup (module import)
try:
    _fact_cache_content = _generate_fact_via_openai()
    _fact_cache_timestamp = datetime.utcnow()
except Exception:
    _fact_cache_content = "Пчёлы способны узнавать человеческие лица по узорам."
    _fact_cache_timestamp = datetime.utcnow()


@router.get("/fact", response_model=FactResponse)
async def read_fact() -> FactResponse:  # noqa: D401
    """Возвращает факт дня, сгенерированный через OpenAI (или статический)."""
    import asyncio
    content = await asyncio.to_thread(_get_cached_fact)
    return FactResponse(content=content)

