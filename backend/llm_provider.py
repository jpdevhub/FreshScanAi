import os
import logging
from typing import List, Dict

logger = logging.getLogger("freshscan.llm")


class LLMProvider:
    def generate_response(
        self, system_prompt: str, prompt: str,
        history: List[Dict[str, str]] = None,
    ) -> str:
        """
        Generate a response from the LLM.

        Args:
            system_prompt: The system instruction for the LLM.
            prompt: The user prompt with RAG context.
            history: list of {"role": "user"|"assistant", "content": str}
        """
        raise NotImplementedError(
            "Subclasses must implement generate_response"
        )


class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.model = os.environ.get(
            "GEMINI_MODEL", "gemini-2.5-flash"
        )

    def generate_response(
        self, system_prompt: str, prompt: str,
        history: List[Dict[str, str]] = None,
    ) -> str:
        import httpx
        url = (
            "https://generativelanguage.googleapis.com"
            f"/v1beta/models/{self.model}:generateContent"
            f"?key={self.api_key}"
        )

        # Build contents list
        contents = []
        if history:
            for turn in history:
                role = "user" if turn["role"] == "user" else "model"
                contents.append({
                    "role": role,
                    "parts": [{"text": turn["content"]}]
                })

        # Add the current user prompt
        contents.append({
            "role": "user",
            "parts": [{"text": prompt}]
        })

        payload = {
            "contents": contents,
            "systemInstruction": {
                "parts": [{"text": system_prompt}]
            },
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 1024
            }
        }

        try:
            response = httpx.post(url, json=payload, timeout=30.0)
            response.raise_for_status()
            data = response.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return text
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            raise RuntimeError(f"Gemini provider failed: {e}")


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    def generate_response(
        self, system_prompt: str, prompt: str,
        history: List[Dict[str, str]] = None,
    ) -> str:
        import httpx
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        messages = [{"role": "system", "content": system_prompt}]
        if history:
            for turn in history:
                messages.append({
                    "role": turn["role"],
                    "content": turn["content"],
                })
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 1024
        }

        try:
            response = httpx.post(
                url, json=payload, headers=headers, timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            text = data["choices"][0]["message"]["content"]
            return text
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise RuntimeError(f"OpenAI provider failed: {e}")


class ClaudeProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.model = os.environ.get(
            "CLAUDE_MODEL", "claude-3-5-sonnet-20241022"
        )

    def generate_response(
        self, system_prompt: str, prompt: str,
        history: List[Dict[str, str]] = None,
    ) -> str:
        import httpx
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }

        messages = []
        if history:
            for turn in history:
                messages.append({
                    "role": turn["role"],
                    "content": turn["content"],
                })
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "system": system_prompt,
            "messages": messages,
            "max_tokens": 1024,
            "temperature": 0.2
        }

        try:
            response = httpx.post(
                url, json=payload, headers=headers, timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            text = data["content"][0]["text"]
            return text
        except Exception as e:
            logger.error(f"Claude API error: {e}")
            raise RuntimeError(f"Claude provider failed: {e}")


class OllamaProvider(LLMProvider):
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.model = os.environ.get("OLLAMA_MODEL", "llama3")

    def generate_response(
        self, system_prompt: str, prompt: str,
        history: List[Dict[str, str]] = None,
    ) -> str:
        import httpx
        url = f"{self.base_url}/api/chat"

        messages = [{"role": "system", "content": system_prompt}]
        if history:
            for turn in history:
                messages.append({
                    "role": turn["role"],
                    "content": turn["content"],
                })
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.2
            }
        }

        try:
            response = httpx.post(
                url, json=payload, timeout=60.0,
            )
            response.raise_for_status()
            data = response.json()
            text = data["message"]["content"]
            return text
        except Exception as e:
            logger.error(f"Ollama API error: {e}")
            raise RuntimeError(f"Ollama provider failed: {e}")


class MockProvider(LLMProvider):
    """Fallback provider when no API keys are configured."""

    def generate_response(
        self, system_prompt: str, prompt: str,
        history: List[Dict[str, str]] = None,
    ) -> str:
        p_lower = prompt.lower()

        reply = (
            "\U0001f916 **FreshScanAI Assistant [DEMO MODE]**\n\n"
            "No active LLM API key detected in your "
            "environment. I am running in local document "
            "retrieval fallback mode. "
            "To enable fully conversational answers, "
            "please set `GEMINI_API_KEY` (or other provider "
            "credentials) in `backend/.env`.\n\n"
        )

        if (
            "hello" in p_lower
            or "hi" in p_lower
            or "hey" in p_lower
        ):
            reply += (
                "Hello! Welcome to FreshScanAI. "
                "How can I help you navigate the platform today?"
            )
        elif "upload" in p_lower:
            reply += (
                "To upload a file for freshness assessment:\n"
                "1. Go to the **Scanner** page.\n"
                "2. Click the **Upload File** button, "
                "or drag and drop your fish image.\n"
                "3. The system will process your image and "
                "auto-navigate to the detailed "
                "**Analysis Dashboard**."
            )
        elif "work" in p_lower or "how does" in p_lower:
            reply += (
                "FreshScanAI works by analyzing three "
                "biologically-significant freshness markers:\n"
                "- **Gills**: Evaluates hemoglobin oxidation "
                "(color saturation).\n"
                "- **Eyes**: Analyzes corneal clarity and "
                "pupil reflex.\n"
                "- **Body**: Assesses epidermal tension, "
                "scale adhesion, and mucus integrity.\n\n"
                "A dual-stream CNN fuses these outputs into a "
                "single **Freshness Index (0-100)** and "
                "letter grade."
            )
        elif "map" in p_lower or "vendor" in p_lower:
            reply += (
                "The **Market Trust Map** aggregates "
                "anonymized scans to rank markets and "
                "vendors. Markets are color-coded based on "
                "average freshness: Green (85+), "
                "Yellow (70-84), and Red (<70)."
            )
        else:
            reply += (
                "Here is the local documentation context "
                "I retrieved for your query:\n\n"
                "> *Query context matches your question:*\n"
                "*(Full AI responses will be active once "
                "GEMINI_API_KEY is configured in "
                "backend/.env)*"
            )

        return reply


def get_llm_provider() -> LLMProvider:
    provider_name = os.environ.get("LLM_PROVIDER", "gemini").lower()

    if provider_name == "gemini":
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            logger.warning(
                "GEMINI_API_KEY is not set. "
                "Falling back to MockProvider."
            )
            return MockProvider()
        return GeminiProvider(api_key)

    elif provider_name == "openai":
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            logger.warning(
                "OPENAI_API_KEY is not set. "
                "Falling back to MockProvider."
            )
            return MockProvider()
        return OpenAIProvider(api_key)

    elif provider_name == "claude":
        api_key = os.environ.get("CLAUDE_API_KEY")
        if not api_key:
            logger.warning(
                "CLAUDE_API_KEY is not set. "
                "Falling back to MockProvider."
            )
            return MockProvider()
        return ClaudeProvider(api_key)

    elif provider_name == "ollama":
        base_url = os.environ.get(
            "OLLAMA_BASE_URL", "http://localhost:11434"
        )
        return OllamaProvider(base_url)

    else:
        logger.warning(
            f"Unknown LLM provider: {provider_name}. "
            "Falling back to MockProvider."
        )
        return MockProvider()
