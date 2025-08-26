import os
from fastapi import APIRouter  # type: ignore
from pydantic import BaseModel  # type: ignore

try:
    # Optional in dev: load .env if present
    from dotenv import load_dotenv  # type: ignore

    load_dotenv()  # no-op if file not found
except Exception:
    pass

router = APIRouter(tags=["fact"])


class FactResponse(BaseModel):
    content: str


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

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
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


@router.get("/fact", response_model=FactResponse)
async def read_fact() -> FactResponse:  # noqa: D401
    """Возвращает факт дня, сгенерированный через OpenAI (или статический)."""
    return FactResponse(content=_generate_fact_via_openai())


