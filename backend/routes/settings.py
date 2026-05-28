import httpx
from fastapi import APIRouter, HTTPException

from backend.config import get_settings, save_settings_overlay
from backend.schemas import SettingsUpdate, SettingsView

router = APIRouter()


def _build_settings_view() -> SettingsView:
    s = get_settings()
    return SettingsView(
        ollama_base_url=s.ollama_base_url,
        ollama_model=s.ollama_model,
        cloud_provider=s.cloud_provider,
        anthropic_model=s.anthropic_model,
        has_anthropic_key=bool(s.anthropic_api_key),
        openai_model=s.openai_model,
        openai_base_url=s.openai_base_url,
        has_openai_key=bool(s.openai_api_key),
        groq_model=s.groq_model,
        has_groq_key=bool(s.groq_api_key),
        gemini_model=s.gemini_model,
        has_gemini_key=bool(s.gemini_api_key),
    )


@router.get("/ollama/models")
async def ollama_models():
    settings = get_settings()
    url = f"{settings.ollama_base_url.rstrip('/')}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url)
            if response.status_code != 200:
                return {"models": []}
            data = response.json()
            return {"models": [m["name"] for m in data.get("models", [])]}
    except Exception:
        return {"models": []}


@router.get("/settings", response_model=SettingsView)
async def get_settings_view():
    return _build_settings_view()


@router.put("/settings", response_model=SettingsView)
async def update_settings(body: SettingsUpdate):
    updates: dict = {}

    if body.ollama_model is not None:
        updates["ollama_model"] = body.ollama_model
    if body.cloud_provider is not None:
        if body.cloud_provider not in ("anthropic", "openai", "groq", "gemini"):
            raise HTTPException(status_code=422, detail="cloud_provider must be 'anthropic', 'openai', 'groq', or 'gemini'")
        updates["cloud_provider"] = body.cloud_provider
    if body.anthropic_model is not None:
        updates["anthropic_model"] = body.anthropic_model
    if body.anthropic_api_key is not None:
        updates["anthropic_api_key"] = body.anthropic_api_key
    if body.openai_model is not None:
        updates["openai_model"] = body.openai_model
    if body.openai_base_url is not None:
        updates["openai_base_url"] = body.openai_base_url
    if body.openai_api_key is not None:
        updates["openai_api_key"] = body.openai_api_key
    if body.groq_model is not None:
        updates["groq_model"] = body.groq_model
    if body.groq_api_key is not None:
        updates["groq_api_key"] = body.groq_api_key
    if body.gemini_model is not None:
        updates["gemini_model"] = body.gemini_model
    if body.gemini_api_key is not None:
        updates["gemini_api_key"] = body.gemini_api_key

    if updates:
        save_settings_overlay(updates)

    return _build_settings_view()
