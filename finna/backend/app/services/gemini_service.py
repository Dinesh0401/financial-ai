from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.config.settings import Settings

logger = logging.getLogger("finna.gemini")

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiService:
    """Thin wrapper around the Gemini REST API for both blocking and streaming calls."""

    def __init__(self, settings: Settings, client: httpx.AsyncClient) -> None:
        self.api_key = settings.gemini_api_key or ""
        self.model = settings.gemini_model
        self.client = client

    @property
    def available(self) -> bool:
        return bool(self.api_key) and not self.api_key.startswith("test-")

    async def generate(
        self,
        *,
        system_instruction: str | None = None,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> str:
        """Non-streaming Gemini call. Returns the text content or empty string on failure."""
        if not self.available:
            return ""

        payload: dict[str, Any] = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }
        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

        try:
            response = await self.client.post(
                f"{GEMINI_BASE}/{self.model}:generateContent",
                params={"key": self.api_key},
                headers={"Content-Type": "application/json"},
                content=json.dumps(payload),
                timeout=25.0,
            )
            if not response.is_success:
                logger.warning("Gemini API error %s: %s", response.status_code, response.text[:300])
                return ""
            data = response.json()
            return (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )
        except (httpx.HTTPError, KeyError, IndexError) as exc:
            logger.warning("Gemini call failed: %s", exc)
            return ""

    async def stream(
        self,
        *,
        system_instruction: str | None = None,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncIterator[str]:
        """Streaming Gemini call. Yields text chunks as they arrive."""
        if not self.available:
            # Don't yield anything — let the copilot use its fallback
            return

        payload: dict[str, Any] = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }
        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

        try:
            async with self.client.stream(
                "POST",
                f"{GEMINI_BASE}/{self.model}:streamGenerateContent",
                params={"key": self.api_key, "alt": "sse"},
                headers={"Content-Type": "application/json"},
                content=json.dumps(payload),
                timeout=60.0,
            ) as response:
                if not response.is_success:
                    # Don't yield anything — let the copilot use its fallback
                    return
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    raw = line.removeprefix("data: ").strip()
                    if not raw or raw == "[DONE]":
                        continue
                    try:
                        chunk = json.loads(raw)
                        text = (
                            chunk.get("candidates", [{}])[0]
                            .get("content", {})
                            .get("parts", [{}])[0]
                            .get("text", "")
                        )
                        if text:
                            yield text
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue
        except httpx.HTTPError as exc:
            logger.warning("Gemini stream failed: %s", exc)
            yield "Connection to the AI service was interrupted. Please try again."
