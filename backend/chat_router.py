import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from llm_provider import get_llm_provider
from rag_retriever import get_retriever
from chat_logger import log_chat_message, update_chat_feedback

logger = logging.getLogger("freshscan.chat")
router = APIRouter(prefix="/api/v1/chat", tags=["chat"])

# ── Pydantic Request/Response Models ──────────────────────────────────────────

class ChatHistoryItem(BaseModel):
    role: str = Field(..., description="Either 'user' or 'assistant'")
    content: str = Field(..., description="The message content")

class ChatMessageRequest(BaseModel):
    question: str = Field(..., min_length=1, description="User question")
    currentPage: Optional[str] = Field(
        None, description="Active page user is viewing"
    )
    currentFeature: Optional[str] = Field(
        None, description="Feature area user is interacting with"
    )
    history: Optional[List[ChatHistoryItem]] = Field(
        default_factory=list, description="Recent conversation history"
    )

class ChatMessageResponse(BaseModel):
    message_id: str = Field(..., description="Unique ID for this response")
    response: str = Field(..., description="Generated markdown text answer")

class ChatFeedbackRequest(BaseModel):
    message_id: str = Field(..., description="ID of the message being rated")
    feedback: str = Field(..., description="Feedback direction: 'up' or 'down'")

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/message", response_model=ChatMessageResponse)
async def chat_message(request: ChatMessageRequest):
    """
    Main Chat Assistant endpoint.
    Retrieves local RAG context, merges page context & history, sends to LLM, and logs analytics.
    """
    try:
        # 1. Retrieve local documentation context (RAG)
        context = ""
        try:
            retriever = get_retriever()
            context = retriever.retrieve_relevant_context(request.question)
        except Exception as e:
            logger.error(f"RAG retrieval error: {e}")
            # Non-blocking, continue with empty context

        # 2. Build system prompt
        system_prompt = (
            "You are the official FreshScanAI Assistant.\n"
            "Your primary purpose is helping users understand and navigate FreshScanAI.\n"
            "Answer questions related to platform features, workflows, onboarding, "
            "reports, dashboards, uploads, analysis processes, and troubleshooting.\n"
            "Use retrieved documentation whenever available.\n"
            "Never invent product features that do not exist.\n"
            "If documentation does not contain the answer, politely explain that the "
            "information is unavailable."
        )

        # 3. Incorporate page and feature context if provided
        context_details = []
        if request.currentPage:
            context_details.append(f"- Active Page: {request.currentPage}")
        if request.currentFeature:
            context_details.append(f"- Active Feature/Section: {request.currentFeature}")

        context_info = ""
        if context_details:
            context_info = "\nUser Current App Context:\n" + "\n".join(context_details) + "\n"

        # 4. Integrate RAG documentation into LLM input
        prompt = ""
        if context:
            prompt += (
                f"Retrieved Documentation:\n{context}\n\n"
                f"Instructions:\n"
                "Use the retrieved documentation to answer the user's question. "
                "Be factual, concise, and helpful. "
                "If the information to answer is not present in the retrieved documentation, "
                "state that the information is not available in the platform's documentation.\n\n"
            )
        else:
            prompt += (
                "No documentation was retrieved for this question. "
                "Answer using only verified platform information if you are certain, "
                "or politely state that the info is unavailable.\n\n"
            )

        if context_info:
            prompt += context_info + "\n"

        prompt += f"User Question: {request.question}"

        # 5. Format history for provider
        history_list = []
        if request.history:
            # Limit history to last 5 turns to prevent token bloat
            for item in request.history[-10:]:
                history_list.append({
                    "role": "user" if item.role == "user" else "assistant",
                    "content": item.content
                })

        # 6. Generate answer via provider
        try:
            provider = get_llm_provider()
            response_text = provider.generate_response(system_prompt, prompt, history_list)
        except Exception as provider_err:
            logger.error(f"LLM Provider execution failed: {provider_err}")
            response_text = (
                "I'm sorry, I encountered a temporary connection issue "
                "while trying to reach the AI model. "
                "Please ensure LLM_PROVIDER and API keys are set correctly "
                "in the environment configuration."
            )

        # 7. Log exchange to SQLite for analytics
        msg_id = str(uuid.uuid4())
        try:
            log_chat_message(
                msg_id=msg_id,
                question=request.question,
                response=response_text,
                current_page=request.currentPage,
                current_feature=request.currentFeature
            )
        except Exception as log_err:
            logger.error(f"Failed to log chat interaction: {log_err}")

        return ChatMessageResponse(message_id=msg_id, response=response_text)

    except Exception as e:
        logger.error(f"Unhandled error in chat message handler: {e}")
        # Always return a user-friendly error envelope, never expose stack traces
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred in the chat assistant. Please try again."
        )

@router.post("/feedback")
async def chat_feedback(request: ChatFeedbackRequest):
    """Logs thumbs up/down user feedback for a given message ID."""
    if request.feedback not in ("up", "down"):
        raise HTTPException(status_code=400, detail="Feedback must be either 'up' or 'down'")

    try:
        update_chat_feedback(request.message_id, request.feedback)
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to record feedback for message {request.message_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Could not submit feedback due to an internal logger issue."
        )
