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
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.schemas import PingResponse, ChatRequest, ChatResponse
import os

router = APIRouter()

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
    
    from app.modules.nandika.scraper import scrape_google_reviews
    
    raw_reviews = scrape_google_reviews(request.url, request.limit)
    
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


# ============================================
# ADD YOUR CUSTOM ENDPOINTS BELOW THIS LINE
# ============================================
