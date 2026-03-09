"""
Nandika Module Router
=====================

OWNER: Nandika
DESCRIPTION: Multilingual Sentiment Analysis for Sri Lankan Reviews
             Uses Translation-Based Transfer Learning with RoBERTa model

This router handles all endpoints for the Nandika component.
All routes are automatically prefixed with /api/v1/nandika

ENDPOINTS:
- GET  /ping           - Health check for this module
- POST /chat           - Chat endpoint for this module
- POST /analyze_text   - Analyze single text sentiment
- POST /analyze_reviews - Scrape & analyze Google Maps reviews
- POST /generate_response - Generate AI response for a single review
- POST /generate_all_responses - Generate AI responses for all reviews
- POST /business_summary - Generate AI business intelligence report
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.schemas import PingResponse, ChatRequest, ChatResponse
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv

# Load environment variables (override=True ensures .env always wins)
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".env")
load_dotenv(_env_path, override=True)

router = APIRouter()

# Thread pool for running blocking operations
_executor = ThreadPoolExecutor(max_workers=2)

MODULE_NAME = "nandika"

# Get the module directory path
MODULE_DIR = os.path.dirname(os.path.abspath(__file__))

# Lazy load the AI engine (only when endpoints are called)
_ai_engine = None

def get_ai_engine():
    global _ai_engine
    if _ai_engine is None:
        from app.modules.nandika.classifier import SentimentAnalyzer
        model_path = os.path.join(MODULE_DIR, "my_sentiment_model_Roberta_1")
        _ai_engine = SentimentAnalyzer(model_path=model_path)
    return _ai_engine


# --- Request Models ---
class TextRequest(BaseModel):
    text: str

class ScrapeRequest(BaseModel):
    url: str
    limit: int = 10

class GenerateResponseRequest(BaseModel):
    review_text: str
    translated_text: str = ""
    sentiment: list[str] = []
    scores: dict = {}

class GenerateAllResponsesRequest(BaseModel):
    reviews: list[GenerateResponseRequest]

class BusinessSummaryReview(BaseModel):
    original_text: str
    translated_text: str = ""
    sentiment: list[str] = []
    scores: dict = {}

class BusinessSummaryRequest(BaseModel):
    statistics: dict
    total_reviews: int


# --- Helper Function ---
def calculate_statistics(results):
    """
    Organizes results into categories (Positive, Negative, Neutral, Mixed)
    with counts and percentages.
    """
    total = len(results)
    if total == 0:
        return {}

    stats = {
        "Positive": {"count": 0, "reviews": []},
        "Negative": {"count": 0, "reviews": []},
        "Neutral":  {"count": 0, "reviews": []},
        "Mixed":    {"count": 0, "reviews": []} 
    }

    for item in results:
        tags = item['sentiment']
        
        if "Positive" in tags and "Negative" in tags:
            category = "Mixed"
        elif "Positive" in tags:
            category = "Positive"
        elif "Negative" in tags:
            category = "Negative"
        else:
            category = "Neutral"
        
        if category in stats:
            stats[category]["count"] += 1
            stats[category]["reviews"].append(item)

    final_summary = {}
    for sentiment, data in stats.items():
        count = data["count"]
        percentage = (count / total) * 100 if total > 0 else 0
        
        final_summary[sentiment] = {
            "count": count,
            "percentage": f"{percentage:.1f}%", 
            "reviews": data["reviews"]
        }

    return final_summary


@router.get("/ping", response_model=PingResponse)
async def ping():
    """
    Health check endpoint for Nandika module.
    Returns module name and status.
    """
    return PingResponse(module=MODULE_NAME, status="ok")


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat endpoint for Nandika module.
    Analyzes the sentiment of the message.
    """
    ai_engine = get_ai_engine()
    result = ai_engine.predict(request.message)
    
    sentiment_str = ", ".join(result['sentiment'])
    scores_str = ", ".join([f"{k}: {v:.1%}" for k, v in result['scores'].items()])
    
    reply = f"Sentiment: {sentiment_str}\nScores: {scores_str}"
    if result['translated_text'] != result['original_text']:
        reply += f"\nTranslated: {result['translated_text']}"
    
    return ChatResponse(
        reply=reply,
        session_id=request.session_id,
        module=MODULE_NAME
    )


@router.post("/analyze_text")
async def analyze_text(request: TextRequest):
    """
    Analyze sentiment of a single text input.
    Supports Sinhala and English.
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
    
    ai_engine = get_ai_engine()
    result = ai_engine.predict(request.text)
    summary = calculate_statistics([result])
    
    return {
        "mode": "manual",
        "statistics": summary
    }


@router.post("/analyze_reviews")
async def analyze_reviews(request: ScrapeRequest):
    """
    Scrape and analyze reviews from Google Maps.
    """
    if "google" not in request.url or "maps" not in request.url:
        raise HTTPException(status_code=400, detail="Invalid URL. Please provide a valid Google Maps link.")
    
    try:
        from app.modules.nandika.scraper import scrape_google_reviews
        
        # Run blocking scraper in thread pool to avoid blocking the event loop
        loop = asyncio.get_event_loop()
        raw_reviews = await loop.run_in_executor(
            _executor, 
            scrape_google_reviews, 
            request.url, 
            request.limit
        )
        
        if not raw_reviews:
            return {"message": "No reviews found.", "data": [], "total_scraped": 0, "statistics": {}}
        
        ai_engine = get_ai_engine()
        analyzed_results = []
        
        for review_text in raw_reviews:
            result = ai_engine.predict(review_text)
            analyzed_results.append(result)

        summary = calculate_statistics(analyzed_results)

        return {
            "mode": "scraper",
            "total_scraped": len(analyzed_results),
            "statistics": summary
        }
    except Exception as e:
        print(f"Error in analyze_reviews: {e}")
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")


# ============================================
# OPENROUTER RESPONSE GENERATION
# ============================================

import httpx

OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

# Fallback chain — tries models in order until one succeeds
OPENROUTER_MODELS = [
    "openrouter/free",  # Auto-routes to any available free model
    "nvidia/nemotron-nano-9b-v2:free",
    "stepfun/step-3.5-flash:free",
    "z-ai/glm-4.5-air:free",
    "qwen/qwen3-4b:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "google/gemma-3-27b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free",
]

def _get_openai_key():
    key = os.environ.get("OPENAI_API_KEY", "")
    return key if key and key != "your_openai_api_key_here" else ""

def _get_gemini_key():
    key = os.environ.get("GEMINI_API_KEY", "")
    return key if key and key != "your_gemini_api_key_here" else ""

def _get_openrouter_key():
    key = os.environ.get("OPENROUTER_API_KEY", "")
    if not key or key == "your_openrouter_api_key_here":
        return ""
    return key


import re
from deep_translator import GoogleTranslator

def _is_sinhala(text: str) -> bool:
    """Detect if text contains Sinhala characters (Unicode range U+0D80-U+0DFF)."""
    sinhala_chars = len(re.findall(r'[\u0D80-\u0DFF]', text))
    return sinhala_chars > len(text) * 0.2

def _translate_to_sinhala(text: str) -> str:
    """Translate English text to Sinhala using Google Translate."""
    try:
        translator = GoogleTranslator(source='en', target='si')
        return translator.translate(text)
    except Exception as e:
        print(f"⚠️ Sinhala translation failed: {e}")
        return text  # Fallback: return English response


RESPONSE_SYSTEM_PROMPT = """You are a professional customer service representative for a Sri Lankan business.
Your task is to write a personalized, warm, and genuine response to a customer review.

CRITICAL RULES — FOLLOW EVERY SINGLE ONE:
1. LANGUAGE:
   - ALWAYS respond in English regardless of the review language.
   - The review text provided may be an English translation of the original — use it to understand the customer's experience.

2. COMPLETENESS — THIS IS MANDATORY:
   - Every response MUST be a complete, grammatically correct paragraph.
   - NEVER end mid-sentence. Every sentence must have a proper ending.
   - Write 3-5 complete sentences.

3. SPECIFICITY — EXTRACT AND REFERENCE DETAILS:
   - Read the review carefully and identify EVERY specific topic mentioned (e.g., food quality, parking, pricing, staff, ambiance, cleanliness, location, family-friendliness).
   - Your response MUST reference at least 2-3 specific details from the review by name.
   - For MIXED reviews: you MUST address BOTH the positives AND the negatives mentioned.
   - NEVER write a generic response that could apply to any review.

4. TONE:
   - Warm and genuine, reflecting authentic Sri Lankan hospitality.
   - NEVER use robotic openers like "Dear valued customer", "Dear guest", or "Thank you for your review".
   - Start naturally — e.g., "We're so glad...", "It means a lot...", "We truly appreciate..."

SENTIMENT-BASED GUIDELINES:
- POSITIVE: Express heartfelt gratitude, specifically mention what they loved, warmly invite them back.
- NEGATIVE: Open with a sincere apology, acknowledge the EXACT problem(s) mentioned, explain what corrective steps you are taking, invite them to reach out directly so you can make it right.
- MIXED: First thank them for the positive aspects (mention them specifically), then directly acknowledge each concern they raised and explain how you plan to address it. Do NOT ignore any complaint.
- NEUTRAL: Acknowledge their experience warmly, invite them to share more specific feedback or visit again.

OUTPUT FORMAT:
- Write ONLY the response text.
- No labels, no quotes, no bullet points, no extra explanation.
- Must be one complete paragraph of 3-5 sentences.
- Double-check: does every sentence end properly? If not, fix it before outputting."""


async def _call_openai(api_key: str, system_prompt: str, user_message: str) -> str:
    """Call OpenAI GPT-4o-mini API."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            OPENAI_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                "temperature": 0.7,
                "max_tokens": 1024,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        text = data["choices"][0]["message"]["content"]
        return text.strip() if text else ""


async def _call_gemini(api_key: str, system_prompt: str, user_message: str) -> str:
    """Call Gemini 2.0 Flash API directly."""
    url = f"{GEMINI_API_URL}?key={api_key}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            url,
            headers={"Content-Type": "application/json"},
            json={
                "system_instruction": {"parts": [{"text": system_prompt}]},
                "contents": [{"parts": [{"text": user_message}]}],
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 1024,
                },
            },
        )
        resp.raise_for_status()
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return text.strip() if text else ""


async def _call_openrouter(api_key: str, system_prompt: str, user_message: str) -> str:
    """Call OpenRouter with fallback through multiple models."""
    last_error = None
    async with httpx.AsyncClient(timeout=60.0) as client:
        for model in OPENROUTER_MODELS:
            try:
                resp = await client.post(
                    OPENROUTER_API_URL,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_message},
                        ],
                        "temperature": 0.7,
                        "max_tokens": 1024,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                text = content.strip() if content else ""
                if text:
                    print(f"✅ OpenRouter response generated with model: {model}")
                    return text
            except httpx.HTTPStatusError as e:
                last_error = e.response.text
                print(f"⚠️ Model {model} failed ({e.response.status_code}), trying next...")
                continue
            except Exception as e:
                last_error = str(e)
                print(f"⚠️ Model {model} error: {e}, trying next...")
                continue

    raise HTTPException(
        status_code=502,
        detail=f"All OpenRouter models failed. Last error: {last_error}"
    )


async def _call_ai(system_prompt: str, user_message: str) -> str:
    """Call AI with OpenAI as primary, Gemini as secondary, OpenRouter as last fallback."""
    # 1. Try OpenAI first (paid, most reliable — 500 RPM, ~$0.0002/call)
    openai_key = _get_openai_key()
    if openai_key:
        try:
            result = await _call_openai(openai_key, system_prompt, user_message)
            if result:
                print("✅ Response generated via OpenAI GPT-4o-mini")
                return result
        except Exception as e:
            print(f"⚠️ OpenAI failed: {e}, falling back to Gemini...")

    # 2. Fallback to Gemini (free tier: 1500 RPD, 15 RPM)
    gemini_key = _get_gemini_key()
    if gemini_key:
        try:
            result = await _call_gemini(gemini_key, system_prompt, user_message)
            if result:
                print("✅ Response generated via Gemini 2.0 Flash")
                return result
        except Exception as e:
            print(f"⚠️ Gemini failed: {e}, falling back to OpenRouter...")

    # 3. Last fallback to OpenRouter free models
    openrouter_key = _get_openrouter_key()
    if openrouter_key:
        return await _call_openrouter(openrouter_key, system_prompt, user_message)

    raise HTTPException(
        status_code=500,
        detail="No AI API keys configured. Set OPENAI_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY in backend/.env"
    )


@router.post("/generate_response")
async def generate_response(request: GenerateResponseRequest):
    """
    Generate an AI-powered personalized response for a single review.
    Uses OpenRouter API to craft context-aware, language-matched replies.
    """
    if not request.review_text.strip():
        raise HTTPException(status_code=400, detail="Review text cannot be empty.")

    is_sinhala = _is_sinhala(request.review_text)
    # For Sinhala reviews, use the English translation for the AI to understand
    review_for_ai = request.translated_text or request.review_text

    sentiment_str = ", ".join(request.sentiment) if request.sentiment else "Unknown"
    scores_str = ", ".join([f"{k}: {v:.1%}" if isinstance(v, float) else f"{k}: {v}" for k, v in request.scores.items()]) if request.scores else "N/A"

    user_message = (
        f"REVIEW TEXT: \"{review_for_ai}\"\n\n"
        f"DETECTED SENTIMENT: {sentiment_str}\n"
        f"SENTIMENT SCORES: {scores_str}\n\n"
        f"INSTRUCTIONS: Write a complete, personalized response IN ENGLISH that addresses the specific details in this review. "
        f"Make sure every sentence is complete and the response does not cut off."
    )

    generated_text = await _call_ai(RESPONSE_SYSTEM_PROMPT, user_message)

    # For Sinhala reviews, translate the English response back to Sinhala
    if is_sinhala:
        generated_text = await asyncio.get_event_loop().run_in_executor(
            None, _translate_to_sinhala, generated_text
        )

    return {"generated_response": generated_text}


@router.post("/generate_all_responses")
async def generate_all_responses(request: GenerateAllResponsesRequest):
    """
    Generate personalized responses for multiple reviews in one call.
    """
    if not request.reviews:
        raise HTTPException(status_code=400, detail="No reviews provided.")

    results = []

    for review in request.reviews:
        is_sinhala = _is_sinhala(review.review_text)
        review_for_ai = review.translated_text or review.review_text

        sentiment_str = ", ".join(review.sentiment) if review.sentiment else "Unknown"
        scores_str = ", ".join([f"{k}: {v:.1%}" if isinstance(v, float) else f"{k}: {v}" for k, v in review.scores.items()]) if review.scores else "N/A"

        user_message = (
            f"REVIEW TEXT: \"{review_for_ai}\"\n\n"
            f"DETECTED SENTIMENT: {sentiment_str}\n"
            f"SENTIMENT SCORES: {scores_str}\n\n"
            f"INSTRUCTIONS: Write a complete, personalized response IN ENGLISH that addresses the specific details in this review. "
            f"Make sure every sentence is complete and the response does not cut off."
        )

        try:
            generated_text = await _call_ai(RESPONSE_SYSTEM_PROMPT, user_message)

            # For Sinhala reviews, translate English response back to Sinhala
            if is_sinhala:
                generated_text = await asyncio.get_event_loop().run_in_executor(
                    None, _translate_to_sinhala, generated_text
                )

            results.append({
                "review_text": review.review_text,
                "generated_response": generated_text
            })
        except Exception as e:
            print(f"AI error for review: {e}")
            results.append({
                "review_text": review.review_text,
                "generated_response": f"[Generation failed: {str(e)}]"
            })

    return {"responses": results}


# ============================================
# BUSINESS INTELLIGENCE SUMMARY
# ============================================

BUSINESS_SUMMARY_PROMPT = """You are a business intelligence analyst specializing in hospitality and tourism in Sri Lanka.
You will receive aggregated customer review data for a business. Generate a structured business intelligence report.

YOU MUST RESPOND WITH VALID JSON ONLY. No markdown, no explanation, no text outside the JSON.

The JSON must have this exact structure:
{
  "overall_score": <number 1-10>,
  "overall_verdict": "<one sentence summary>",
  "strengths": [
    {"title": "<2-4 word title>", "description": "<1-2 sentence detail>"},
    {"title": "<2-4 word title>", "description": "<1-2 sentence detail>"},
    {"title": "<2-4 word title>", "description": "<1-2 sentence detail>"}
  ],
  "weaknesses": [
    {"title": "<2-4 word title>", "description": "<1-2 sentence detail>"},
    {"title": "<2-4 word title>", "description": "<1-2 sentence detail>"},
    {"title": "<2-4 word title>", "description": "<1-2 sentence detail>"}
  ],
  "recommendations": [
    {"title": "<2-4 word title>", "description": "<1-2 sentence actionable advice>"},
    {"title": "<2-4 word title>", "description": "<1-2 sentence actionable advice>"},
    {"title": "<2-4 word title>", "description": "<1-2 sentence actionable advice>"}
  ],
  "sentiment_insight": "<2-3 sentence analysis of the sentiment distribution pattern>"
}

RULES:
- Base the overall_score on the sentiment distribution and specific feedback.
- Strengths/weaknesses MUST reference specific details from the actual reviews.
- Recommendations must be concrete and actionable (not generic).
- If there are fewer than 3 weaknesses apparent, still provide 3 but note the lesser ones.
- Return ONLY valid JSON. No markdown code fences, no extra text."""


@router.post("/business_summary")
async def business_summary(request: BusinessSummaryRequest):
    """
    Generate an AI-powered business intelligence summary from review statistics.
    Returns structured JSON with overall score, strengths, weaknesses, and recommendations.
    """
    if not request.statistics:
        raise HTTPException(status_code=400, detail="No statistics provided.")

    # Build a condensed review digest for the AI
    review_digest = []
    sentiment_counts = {}
    for sentiment_label, data in request.statistics.items():
        count = data.get("count", 0)
        percentage = data.get("percentage", "0%")
        sentiment_counts[sentiment_label] = f"{count} ({percentage})"
        for review in data.get("reviews", []):
            translated = review.get("translated_text") or review.get("original_text", "")
            scores = review.get("scores", {})
            review_digest.append(f"[{sentiment_label}] {translated} (scores: {scores})")

    user_message = (
        f"TOTAL REVIEWS: {request.total_reviews}\n\n"
        f"SENTIMENT DISTRIBUTION:\n"
        + "\n".join(f"  - {k}: {v}" for k, v in sentiment_counts.items())
        + f"\n\nINDIVIDUAL REVIEWS (translated to English):\n"
        + "\n".join(f"{i+1}. {r}" for i, r in enumerate(review_digest[:50]))
        + "\n\nGenerate the business intelligence JSON report now."
    )

    import json as json_module
    import re as re_module

    raw_text = await _call_ai(BUSINESS_SUMMARY_PROMPT, user_message)

    # Extract JSON from the response — handles markdown fences, extra text, etc.
    cleaned = raw_text.strip()

    # Try to extract JSON from markdown code fences first
    fence_match = re_module.search(r"```(?:json)?\s*\n?(.*?)```", cleaned, re_module.DOTALL)
    if fence_match:
        cleaned = fence_match.group(1).strip()
    else:
        # Try to find JSON object by matching first { to last }
        brace_start = cleaned.find("{")
        brace_end = cleaned.rfind("}")
        if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
            cleaned = cleaned[brace_start:brace_end + 1]

    try:
        report = json_module.loads(cleaned)
    except json_module.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail=f"AI returned invalid JSON. Raw: {cleaned[:500]}"
        )

    return {"report": report}
