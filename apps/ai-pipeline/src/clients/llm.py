"""Multimodal LLM client — supports Anthropic (Claude), OpenAI (GPT-4o), and Google (Gemini).

Accepts images + text prompt, returns structured text response.
Provider abstraction allows swapping between Claude, GPT-4o, and Gemini via config.
"""

import asyncio
import base64
import io
import json
import logging
from dataclasses import dataclass
from typing import Literal

import httpx
from PIL import Image

from src.config import settings

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 60.0
MAX_RETRIES = 3

Provider = Literal["anthropic", "openai", "google"]


@dataclass
class LLMResponse:
    """Response from the LLM."""

    text: str
    provider: str
    model: str
    usage: dict | None = None


MAX_IMAGE_DIMENSION = 1568  # Anthropic recommended max


def _resize_image(image_bytes: bytes, max_dim: int = MAX_IMAGE_DIMENSION) -> bytes:
    """Resize image if either dimension exceeds max_dim, preserving aspect ratio.

    Returns JPEG bytes (re-encoded if resized, original if already small enough).
    """
    img = Image.open(io.BytesIO(image_bytes))
    w, h = img.size
    if w <= max_dim and h <= max_dim:
        return image_bytes
    scale = min(max_dim / w, max_dim / h)
    new_w, new_h = int(w * scale), int(h * scale)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    logger.debug("Resized image from %dx%d to %dx%d (%d→%d bytes)", w, h, new_w, new_h, len(image_bytes), buf.tell())
    return buf.getvalue()


def _encode_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """Resize (if needed) and base64-encode image bytes.

    Args:
        image_bytes: Raw image bytes.
        mime_type: MIME type of the image.

    Returns:
        Base64-encoded string.
    """
    resized = _resize_image(image_bytes)
    return base64.b64encode(resized).decode("utf-8")


def _build_anthropic_payload(
    prompt: str,
    images: list[tuple[bytes, str]],
    model: str,
) -> dict:
    """Build Anthropic Messages API payload.

    Args:
        prompt: Text prompt.
        images: List of (image_bytes, mime_type) tuples.
        model: Model name (e.g. claude-sonnet-4-5-20250929).

    Returns:
        Request payload dict.
    """
    content: list[dict] = []

    for img_bytes, mime_type in images:
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": mime_type or "image/jpeg",
                "data": _encode_image(img_bytes, mime_type),
            },
        })

    content.append({"type": "text", "text": prompt})

    return {
        "model": model,
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": content}],
    }


def _build_openai_payload(
    prompt: str,
    images: list[tuple[bytes, str]],
    model: str,
) -> dict:
    """Build OpenAI Chat Completions API payload.

    Args:
        prompt: Text prompt.
        images: List of (image_bytes, mime_type) tuples.
        model: Model name (e.g. gpt-4o).

    Returns:
        Request payload dict.
    """
    content: list[dict] = []

    for img_bytes, mime_type in images:
        b64 = _encode_image(img_bytes, mime_type)
        mt = mime_type or "image/jpeg"
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:{mt};base64,{b64}"},
        })

    content.append({"type": "text", "text": prompt})

    return {
        "model": model,
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": content}],
    }


def _parse_anthropic_response(data: dict) -> LLMResponse:
    """Parse Anthropic Messages API response.

    Args:
        data: Raw JSON response.

    Returns:
        LLMResponse with extracted text.
    """
    text_parts = []
    for block in data.get("content", []):
        if block.get("type") == "text":
            text_parts.append(block["text"])

    return LLMResponse(
        text="\n".join(text_parts),
        provider="anthropic",
        model=data.get("model", ""),
        usage=data.get("usage"),
    )


def _parse_openai_response(data: dict) -> LLMResponse:
    """Parse OpenAI Chat Completions response.

    Args:
        data: Raw JSON response.

    Returns:
        LLMResponse with extracted text.
    """
    choices = data.get("choices", [])
    text = choices[0]["message"]["content"] if choices else ""

    return LLMResponse(
        text=text,
        provider="openai",
        model=data.get("model", ""),
        usage=data.get("usage"),
    )


def _build_google_payload(
    prompt: str,
    images: list[tuple[bytes, str]],
    model: str,
) -> dict:
    """Build Google Gemini API payload.

    Args:
        prompt: Text prompt.
        images: List of (image_bytes, mime_type) tuples.
        model: Model name (e.g. gemini-2.0-flash).

    Returns:
        Request payload dict.
    """
    parts: list[dict] = []

    for img_bytes, mime_type in images:
        parts.append({
            "inline_data": {
                "mime_type": mime_type or "image/jpeg",
                "data": _encode_image(img_bytes, mime_type),
            }
        })

    parts.append({"text": prompt})

    return {"contents": [{"parts": parts}]}


def _parse_google_response(data: dict) -> LLMResponse:
    """Parse Google Gemini API response.

    Args:
        data: Raw JSON response.

    Returns:
        LLMResponse with extracted text.
    """
    candidates = data.get("candidates", [])
    text = ""
    if candidates:
        parts = candidates[0].get("content", {}).get("parts", [])
        text = "".join(p.get("text", "") for p in parts)

    return LLMResponse(
        text=text,
        provider="google",
        model=data.get("modelVersion", ""),
        usage=data.get("usageMetadata"),
    )


async def query(
    prompt: str,
    images: list[tuple[bytes, str]] | None = None,
    provider: Provider | None = None,
    model: str | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> LLMResponse:
    """Send a multimodal query to the configured LLM provider.

    Args:
        prompt: Text prompt to send.
        images: Optional list of (image_bytes, mime_type) tuples.
        provider: Override provider ("anthropic" or "openai"). Uses settings if None.
        model: Override model name. Uses settings if None.
        timeout: Request timeout in seconds.

    Returns:
        LLMResponse with the model's text output.

    Raises:
        ValueError: If provider is unsupported or API key is missing.
        httpx.HTTPStatusError: If the API returns an error.
    """
    prov = provider or settings.llm_provider
    mdl = model or settings.llm_model
    imgs = images or []

    if prov == "anthropic":
        api_key = settings.anthropic_api_key
        if not api_key:
            raise ValueError("Anthropic API key is required (set ANTHROPIC_API_KEY)")
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = _build_anthropic_payload(prompt, imgs, mdl)
        parse_fn = _parse_anthropic_response

    elif prov == "openai":
        api_key = settings.openai_api_key
        if not api_key:
            raise ValueError("OpenAI API key is required (set OPENAI_API_KEY)")
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = _build_openai_payload(prompt, imgs, mdl)
        parse_fn = _parse_openai_response

    elif prov == "google":
        api_key = settings.google_api_key
        if not api_key:
            raise ValueError("Google API key is required (set GOOGLE_API_KEY)")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{mdl}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        payload = _build_google_payload(prompt, imgs, mdl)
        parse_fn = _parse_google_response

    else:
        raise ValueError(f"Unsupported LLM provider: {prov}")

    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.info(
                "LLM request attempt %d/%d (provider=%s, model=%s, images=%d)",
                attempt, MAX_RETRIES, prov, mdl, len(imgs),
            )
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()

            result = parse_fn(response.json())
            logger.info("LLM response received (%d chars)", len(result.text))
            return result

        except httpx.TimeoutException as e:
            last_error = e
            logger.warning("LLM request timed out (attempt %d/%d)", attempt, MAX_RETRIES)
        except httpx.HTTPStatusError as e:
            last_error = e
            if e.response.status_code == 429:
                logger.warning("LLM rate limited (attempt %d/%d)", attempt, MAX_RETRIES)
            elif e.response.status_code >= 500:
                logger.warning("LLM server error %d (attempt %d/%d)", e.response.status_code, attempt, MAX_RETRIES)
            else:
                raise
        except httpx.RequestError as e:
            last_error = e
            logger.warning("LLM request failed (attempt %d/%d): %s", attempt, MAX_RETRIES, e)

        if attempt < MAX_RETRIES:
            wait = 2 ** attempt
            logger.info("Retrying in %ds...", wait)
            await asyncio.sleep(wait)

    logger.error("LLM query failed after %d attempts", MAX_RETRIES)
    raise last_error  # type: ignore[misc]


def extract_json(text: str) -> dict | None:
    """Extract JSON from LLM response text.

    Handles cases where the model wraps JSON in markdown code blocks
    or includes extra prose.

    Args:
        text: Raw text from LLM response.

    Returns:
        Parsed dict, or None if no valid JSON found.
    """
    # Try direct parse first
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # Try extracting from code blocks
    import re
    patterns = [
        r"```json\s*\n(.*?)\n```",
        r"```\s*\n(.*?)\n```",
        r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.DOTALL)
        if match:
            try:
                candidate = match.group(1) if match.lastindex else match.group(0)
                return json.loads(candidate.strip())
            except (json.JSONDecodeError, IndexError):
                continue

    logger.warning("Failed to extract JSON from LLM response: %s", text[:200])
    return None
