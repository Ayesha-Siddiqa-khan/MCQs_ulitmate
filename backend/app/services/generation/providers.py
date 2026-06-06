"""Provider adapters: openai, anthropic, google.

Every adapter exposes a single ``generate_json`` coroutine that takes a system
prompt and a user prompt and returns the parsed JSON list (or raises
``ProviderError``). All HTTP is via httpx with sensible timeouts.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import httpx

from app.schemas.common import AIProvider


class ProviderError(RuntimeError):
    pass


@dataclass
class ProviderConfig:
    provider: AIProvider
    api_key: str
    model: str | None = None


_DEFAULT_MODELS = {
    AIProvider.openai: "gpt-4o-mini",
    AIProvider.anthropic: "claude-3-5-haiku-latest",
    AIProvider.google: "gemini-1.5-flash-latest",
}


def _strip_code_fence(text: str) -> str:
    s = text.strip()
    if s.startswith("```"):
        s = s.lstrip("`").lstrip()
        if s.lower().startswith("json"):
            s = s[4:].lstrip()
        if s.endswith("```"):
            s = s[:-3].rstrip()
    return s


def _parse_json_list(text: str) -> list[dict[str, Any]]:
    cleaned = _strip_code_fence(text)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        # try to extract the first JSON array substring
        start = cleaned.find("[")
        end = cleaned.rfind("]")
        if start != -1 and end != -1 and end > start:
            try:
                parsed = json.loads(cleaned[start : end + 1])
            except json.JSONDecodeError as exc2:
                raise ProviderError(f"model returned invalid JSON: {exc2}") from exc2
        else:
            raise ProviderError(f"model returned invalid JSON: {exc}") from exc
    if isinstance(parsed, dict) and "questions" in parsed:
        parsed = parsed["questions"]
    if not isinstance(parsed, list):
        raise ProviderError("model JSON was not a list")
    return parsed


async def generate_json(cfg: ProviderConfig, system_prompt: str, user_prompt: str) -> list[dict[str, Any]]:
    model = cfg.model or _DEFAULT_MODELS.get(cfg.provider)
    if not model:
        raise ProviderError("no model configured")

    if cfg.provider is AIProvider.openai:
        return await _openai(cfg.api_key, model, system_prompt, user_prompt)
    if cfg.provider is AIProvider.anthropic:
        return await _anthropic(cfg.api_key, model, system_prompt, user_prompt)
    if cfg.provider is AIProvider.google:
        return await _google(cfg.api_key, model, system_prompt, user_prompt)
    raise ProviderError(f"unsupported provider: {cfg.provider}")


async def _openai(api_key: str, model: str, system_prompt: str, user_prompt: str) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "response_format": {"type": "json_object"},
                "temperature": 0.4,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            },
        )
    if resp.status_code >= 400:
        raise ProviderError(f"openai {resp.status_code}: {resp.text[:300]}")
    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    return _parse_json_list(content)


async def _anthropic(api_key: str, model: str, system_prompt: str, user_prompt: str) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": 4096,
                "temperature": 0.4,
                "system": system_prompt,
                "messages": [{"role": "user", "content": user_prompt}],
            },
        )
    if resp.status_code >= 400:
        raise ProviderError(f"anthropic {resp.status_code}: {resp.text[:300]}")
    data = resp.json()
    blocks = data.get("content", [])
    text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
    return _parse_json_list(text)


async def _google(api_key: str, model: str, system_prompt: str, user_prompt: str) -> list[dict[str, Any]]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            url,
            headers={"Content-Type": "application/json"},
            json={
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                "generationConfig": {
                    "temperature": 0.4,
                    "responseMimeType": "application/json",
                },
            },
        )
    if resp.status_code >= 400:
        raise ProviderError(f"google {resp.status_code}: {resp.text[:300]}")
    data = resp.json()
    candidates = data.get("candidates", [])
    if not candidates:
        raise ProviderError("google: no candidates returned")
    parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(p.get("text", "") for p in parts)
    return _parse_json_list(text)
