"""Tests for the multimodal LLM client."""

import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch

from src.clients.llm import (
    query,
    extract_json,
    _build_anthropic_payload,
    _build_openai_payload,
    _build_google_payload,
    _parse_anthropic_response,
    _parse_openai_response,
    _parse_google_response,
    _encode_image,
    LLMResponse,
)


FAKE_IMG = b"\xff\xd8\xff\xe0fake"
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"

ANTHROPIC_RESPONSE = {
    "content": [{"type": "text", "text": '{"species": "oak"}'}],
    "model": "claude-sonnet-4-5-20250929",
    "usage": {"input_tokens": 100, "output_tokens": 20},
}

OPENAI_RESPONSE = {
    "choices": [{"message": {"content": '{"species": "oak"}'}}],
    "model": "gpt-4o",
    "usage": {"prompt_tokens": 100, "completion_tokens": 20},
}

GOOGLE_RESPONSE = {
    "candidates": [{"content": {"parts": [{"text": '{"species": "oak"}'}]}}],
    "modelVersion": "gemini-2.0-flash",
    "usageMetadata": {"promptTokenCount": 100, "candidatesTokenCount": 20},
}


class TestEncodeImage:
    def test_encodes_bytes(self):
        result = _encode_image(b"hello")
        assert isinstance(result, str)
        import base64
        assert base64.b64decode(result) == b"hello"


class TestBuildPayloads:
    def test_anthropic_payload_structure(self):
        payload = _build_anthropic_payload("identify", [(FAKE_IMG, "image/jpeg")], "claude-sonnet-4-5-20250929")
        assert payload["model"] == "claude-sonnet-4-5-20250929"
        assert payload["max_tokens"] == 1024
        assert len(payload["messages"]) == 1
        content = payload["messages"][0]["content"]
        assert content[0]["type"] == "image"
        assert content[0]["source"]["type"] == "base64"
        assert content[0]["source"]["media_type"] == "image/jpeg"
        assert content[-1]["type"] == "text"
        assert content[-1]["text"] == "identify"

    def test_anthropic_multiple_images(self):
        payload = _build_anthropic_payload("test", [(FAKE_IMG, "image/jpeg")] * 3, "model")
        content = payload["messages"][0]["content"]
        # 3 images + 1 text
        assert len(content) == 4

    def test_openai_payload_structure(self):
        payload = _build_openai_payload("identify", [(FAKE_IMG, "image/jpeg")], "gpt-4o")
        assert payload["model"] == "gpt-4o"
        content = payload["messages"][0]["content"]
        assert content[0]["type"] == "image_url"
        assert content[0]["image_url"]["url"].startswith("data:image/jpeg;base64,")
        assert content[-1]["type"] == "text"

    def test_google_payload_structure(self):
        payload = _build_google_payload("identify", [(FAKE_IMG, "image/jpeg")], "gemini-2.0-flash")
        assert "contents" in payload
        parts = payload["contents"][0]["parts"]
        assert parts[0]["inline_data"]["mime_type"] == "image/jpeg"
        assert "data" in parts[0]["inline_data"]
        assert parts[-1]["text"] == "identify"

    def test_google_multiple_images(self):
        payload = _build_google_payload("test", [(FAKE_IMG, "image/jpeg")] * 3, "model")
        parts = payload["contents"][0]["parts"]
        # 3 images + 1 text
        assert len(parts) == 4


class TestParseResponses:
    def test_parse_anthropic(self):
        result = _parse_anthropic_response(ANTHROPIC_RESPONSE)
        assert result.text == '{"species": "oak"}'
        assert result.provider == "anthropic"
        assert result.model == "claude-sonnet-4-5-20250929"
        assert result.usage is not None

    def test_parse_anthropic_empty(self):
        result = _parse_anthropic_response({"content": []})
        assert result.text == ""

    def test_parse_openai(self):
        result = _parse_openai_response(OPENAI_RESPONSE)
        assert result.text == '{"species": "oak"}'
        assert result.provider == "openai"
        assert result.model == "gpt-4o"

    def test_parse_openai_empty(self):
        result = _parse_openai_response({"choices": []})
        assert result.text == ""

    def test_parse_google(self):
        result = _parse_google_response(GOOGLE_RESPONSE)
        assert result.text == '{"species": "oak"}'
        assert result.provider == "google"
        assert result.model == "gemini-2.0-flash"
        assert result.usage is not None

    def test_parse_google_empty(self):
        result = _parse_google_response({"candidates": []})
        assert result.text == ""

    def test_parse_google_multiple_parts(self):
        response = {
            "candidates": [{"content": {"parts": [{"text": "Hello"}, {"text": " World"}]}}],
            "modelVersion": "gemini-2.0-flash",
        }
        result = _parse_google_response(response)
        assert result.text == "Hello World"


class TestExtractJson:
    def test_plain_json(self):
        result = extract_json('{"key": "value"}')
        assert result == {"key": "value"}

    def test_json_in_code_block(self):
        text = 'Here is the result:\n```json\n{"key": "value"}\n```\nDone.'
        result = extract_json(text)
        assert result == {"key": "value"}

    def test_json_in_plain_code_block(self):
        text = 'Result:\n```\n{"key": "value"}\n```'
        result = extract_json(text)
        assert result == {"key": "value"}

    def test_nested_json(self):
        text = '{"outer": {"inner": 42}}'
        result = extract_json(text)
        assert result == {"outer": {"inner": 42}}

    def test_no_json(self):
        result = extract_json("This is just plain text with no JSON.")
        assert result is None

    def test_json_with_whitespace(self):
        result = extract_json('  \n  {"key": "value"}  \n  ')
        assert result == {"key": "value"}


def _mock_response(url: str, status: int, json_data: dict) -> httpx.Response:
    return httpx.Response(status, json=json_data, request=httpx.Request("POST", url))


class TestQuery:
    @pytest.mark.asyncio
    async def test_unsupported_provider(self):
        with pytest.raises(ValueError, match="Unsupported"):
            await query("test", provider="unknown_provider")  # type: ignore

    @pytest.mark.asyncio
    async def test_missing_anthropic_key(self):
        with patch("src.clients.llm.settings") as mock_settings:
            mock_settings.llm_provider = "anthropic"
            mock_settings.llm_model = "claude-sonnet-4-5-20250929"
            mock_settings.anthropic_api_key = ""
            with pytest.raises(ValueError, match="Anthropic API key"):
                await query("test", provider="anthropic")

    @pytest.mark.asyncio
    async def test_missing_openai_key(self):
        with patch("src.clients.llm.settings") as mock_settings:
            mock_settings.llm_provider = "openai"
            mock_settings.llm_model = "gpt-4o"
            mock_settings.openai_api_key = ""
            with pytest.raises(ValueError, match="OpenAI API key"):
                await query("test", provider="openai")

    @pytest.mark.asyncio
    async def test_missing_google_key(self):
        with patch("src.clients.llm.settings") as mock_settings:
            mock_settings.llm_provider = "google"
            mock_settings.llm_model = "gemini-2.0-flash"
            mock_settings.google_api_key = ""
            with pytest.raises(ValueError, match="Google API key"):
                await query("test", provider="google")

    @pytest.mark.asyncio
    async def test_anthropic_success(self):
        resp = _mock_response(ANTHROPIC_URL, 200, ANTHROPIC_RESPONSE)
        mock_post = AsyncMock(return_value=resp)

        with patch("src.clients.llm.settings") as mock_settings:
            mock_settings.llm_provider = "anthropic"
            mock_settings.llm_model = "claude-sonnet-4-5-20250929"
            mock_settings.anthropic_api_key = "sk-test"

            with patch("src.clients.llm.httpx.AsyncClient") as MockClient:
                MockClient.return_value.__aenter__ = AsyncMock(
                    return_value=MagicMock(post=mock_post)
                )
                MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

                result = await query(
                    "identify this tree",
                    images=[(FAKE_IMG, "image/jpeg")],
                    provider="anthropic",
                )

        assert result.text == '{"species": "oak"}'
        assert result.provider == "anthropic"

    @pytest.mark.asyncio
    async def test_openai_success(self):
        resp = _mock_response(OPENAI_URL, 200, OPENAI_RESPONSE)
        mock_post = AsyncMock(return_value=resp)

        with patch("src.clients.llm.settings") as mock_settings:
            mock_settings.llm_provider = "openai"
            mock_settings.llm_model = "gpt-4o"
            mock_settings.openai_api_key = "sk-test"

            with patch("src.clients.llm.httpx.AsyncClient") as MockClient:
                MockClient.return_value.__aenter__ = AsyncMock(
                    return_value=MagicMock(post=mock_post)
                )
                MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

                result = await query(
                    "identify this tree",
                    images=[(FAKE_IMG, "image/jpeg")],
                    provider="openai",
                )

        assert result.text == '{"species": "oak"}'
        assert result.provider == "openai"

    @pytest.mark.asyncio
    async def test_google_success(self):
        google_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=test-key"
        resp = _mock_response(google_url, 200, GOOGLE_RESPONSE)
        mock_post = AsyncMock(return_value=resp)

        with patch("src.clients.llm.settings") as mock_settings:
            mock_settings.llm_provider = "google"
            mock_settings.llm_model = "gemini-2.0-flash"
            mock_settings.google_api_key = "test-key"

            with patch("src.clients.llm.httpx.AsyncClient") as MockClient:
                MockClient.return_value.__aenter__ = AsyncMock(
                    return_value=MagicMock(post=mock_post)
                )
                MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

                result = await query(
                    "identify this tree",
                    images=[(FAKE_IMG, "image/jpeg")],
                    provider="google",
                )

        assert result.text == '{"species": "oak"}'
        assert result.provider == "google"

    @pytest.mark.asyncio
    async def test_retries_on_500(self):
        error_resp = _mock_response(ANTHROPIC_URL, 500, {"error": "internal"})
        error_resp.raise_for_status = MagicMock(side_effect=httpx.HTTPStatusError(
            "500", request=httpx.Request("POST", ANTHROPIC_URL), response=error_resp
        ))
        ok_resp = _mock_response(ANTHROPIC_URL, 200, ANTHROPIC_RESPONSE)

        mock_post = AsyncMock(side_effect=[error_resp, ok_resp])

        with patch("src.clients.llm.settings") as mock_settings:
            mock_settings.llm_provider = "anthropic"
            mock_settings.llm_model = "claude-sonnet-4-5-20250929"
            mock_settings.anthropic_api_key = "sk-test"

            with patch("src.clients.llm.httpx.AsyncClient") as MockClient:
                MockClient.return_value.__aenter__ = AsyncMock(
                    return_value=MagicMock(post=mock_post)
                )
                MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
                with patch("src.clients.llm.asyncio.sleep", new_callable=AsyncMock):
                    result = await query("test", provider="anthropic")

        assert result.provider == "anthropic"
        assert mock_post.call_count == 2

    @pytest.mark.asyncio
    async def test_no_retry_on_401(self):
        error_resp = _mock_response(ANTHROPIC_URL, 401, {"error": "unauthorized"})
        error_resp.raise_for_status = MagicMock(side_effect=httpx.HTTPStatusError(
            "401", request=httpx.Request("POST", ANTHROPIC_URL), response=error_resp
        ))
        mock_post = AsyncMock(return_value=error_resp)

        with patch("src.clients.llm.settings") as mock_settings:
            mock_settings.llm_provider = "anthropic"
            mock_settings.llm_model = "claude-sonnet-4-5-20250929"
            mock_settings.anthropic_api_key = "sk-bad"

            with patch("src.clients.llm.httpx.AsyncClient") as MockClient:
                MockClient.return_value.__aenter__ = AsyncMock(
                    return_value=MagicMock(post=mock_post)
                )
                MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

                with pytest.raises(httpx.HTTPStatusError):
                    await query("test", provider="anthropic")

        assert mock_post.call_count == 1

    @pytest.mark.asyncio
    async def test_query_without_images(self):
        resp = _mock_response(ANTHROPIC_URL, 200, ANTHROPIC_RESPONSE)
        mock_post = AsyncMock(return_value=resp)

        with patch("src.clients.llm.settings") as mock_settings:
            mock_settings.llm_provider = "anthropic"
            mock_settings.llm_model = "claude-sonnet-4-5-20250929"
            mock_settings.anthropic_api_key = "sk-test"

            with patch("src.clients.llm.httpx.AsyncClient") as MockClient:
                MockClient.return_value.__aenter__ = AsyncMock(
                    return_value=MagicMock(post=mock_post)
                )
                MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

                result = await query("text only prompt", provider="anthropic")

        assert result.text == '{"species": "oak"}'
        # Verify the payload had no images
        call_kwargs = mock_post.call_args
        payload = call_kwargs.kwargs["json"]
        content = payload["messages"][0]["content"]
        assert len(content) == 1  # text only
        assert content[0]["type"] == "text"
