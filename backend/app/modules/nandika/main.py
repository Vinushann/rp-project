# from fastapi import FastAPI, HTTPException
# from pydantic import BaseModel
# from classifier import SentimentAnalyzer
# from scraper import scrape_google_reviews
# import uvicorn

# # 1. Initialize App & Load Model
# app = FastAPI()
# ai_engine = SentimentAnalyzer() # Loads model immediately on startup

# # 2. Define Request Format
# class ScrapeRequest(BaseModel):
#     url: str
#     limit: int = 10  # Default to 10 if not provided

# # 3. Define the Endpoint
# @app.post("/analyze_reviews")
# def analyze_reviews(request: ScrapeRequest):
#     """
#     1. Scrapes reviews from the provided Google Maps URL.
#     2. Runs them through the mBERT model.
#     3. Returns the classified results.
#     """
#     print(f"Received request: {request.url} | Limit: {request.limit}")
    
#     # Step A: Scrape
#     if "google.com/maps" not in request.url:
#         raise HTTPException(status_code=400, detail="Invalid URL. Please provide a Google Maps link.")
        
#     raw_reviews = scrape_google_reviews(request.url, request.limit)
    
#     if not raw_reviews:
#         return {"message": "No reviews found or scraping failed.", "data": []}

#     # Step B: Classify
#     analyzed_results = []
#     for review_text in raw_reviews:
#         result = ai_engine.predict(review_text)
#         analyzed_results.append(result)

#     # Step C: Return
#     return {
#         "total_scraped": len(analyzed_results),
#         "url": request.url,
#         "results": analyzed_results
#     }

# # 4. Run Server (for debugging)
# if __name__ == "__main__":
#     uvicorn.run(app, host="127.0.0.1", port=8000)


# from fastapi import FastAPI, HTTPException
# from pydantic import BaseModel
# from classifier import SentimentAnalyzer
# from scraper import scrape_google_reviews
# import uvicorn

# # 1. Initialize App
# app = FastAPI()

# # Load the AI Engine once at startup
# # Ensure the path matches your actual folder name!
# ai_engine = SentimentAnalyzer(model_path="./my_sentiment_model_Roberta_1") 

# # 2. Define Request Format
# class ScrapeRequest(BaseModel):
#     url: str
#     limit: int = 10 

# # 3. Define the Endpoint
# @app.post("/analyze_reviews")
# def analyze_reviews(request: ScrapeRequest):
#     print(f"Received request for: {request.url}")
    
#     # Basic URL Validation
#     if "google" not in request.url or "maps" not in request.url:
#         raise HTTPException(status_code=400, detail="Invalid URL. Please provide a valid Google Maps link.")
        
#     # Step A: Scrape
#     print("Scraping reviews...")
#     raw_reviews = scrape_google_reviews(request.url, request.limit)
    
#     if not raw_reviews:
#         return {"message": "No reviews found (or scraping failed).", "data": []}

#     # Step B: Classify
#     print(f"Classifying {len(raw_reviews)} reviews...")
#     analyzed_results = []
    
#     for review_text in raw_reviews:
#         # The AI engine now handles translation internally
#         result = ai_engine.predict(review_text)
#         analyzed_results.append(result)

#     # Step C: Return
#     return {
#         "total_scraped": len(analyzed_results),
#         "url": request.url,
#         "results": analyzed_results
#     }

# # 4. Run Server
# if __name__ == "__main__":
#     uvicorn.run(app, host="127.0.0.1", port=8000)

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from classifier import SentimentAnalyzer
from scraper import scrape_google_reviews
import uvicorn

# 1. Initialize App
app = FastAPI()

# Load the AI Engine once at startup
# (Make sure this path matches your actual folder!)
ai_engine = SentimentAnalyzer(model_path="./my_sentiment_model_Roberta_1") 

# --- REQUEST MODELS ---
class ScrapeRequest(BaseModel):
    url: str
    limit: int = 10 

class TextRequest(BaseModel):
    text: str

# --- ENDPOINTS ---

# Endpoint 1: The Original Scraper (For Google Maps Links)
# @app.post("/analyze_reviews")
# def analyze_reviews(request: ScrapeRequest):
#     print(f"Received scraper request for: {request.url}")
    
#     if "google" not in request.url or "maps" not in request.url:
#         raise HTTPException(status_code=400, detail="Invalid URL. Please provide a valid Google Maps link.")
        
#     print("Scraping reviews...")
#     raw_reviews = scrape_google_reviews(request.url, request.limit)
    
#     if not raw_reviews:
#         return {"message": "No reviews found (or scraping failed).", "data": []}

#     print(f"Classifying {len(raw_reviews)} reviews...")
#     analyzed_results = []
    
#     for review_text in raw_reviews:
#         result = ai_engine.predict(review_text)
#         analyzed_results.append(result)

#     return {
#         "mode": "scraper",
#         "total": len(analyzed_results),
#         "results": analyzed_results
#     }

# # Endpoint 2: The New Manual Input (For Single Sinhala Sentences)
# @app.post("/analyze_text")
# def analyze_single_text(request: TextRequest):
#     """
#     Directly analyzes a single string of text (Sinhala or English).
#     No scraping involved.
#     """
#     print(f"Received manual text: {request.text[:50]}...") # Log first 50 chars
    
#     if not request.text.strip():
#         raise HTTPException(status_code=400, detail="Text cannot be empty.")

#     # Send directly to the AI (which handles translation automatically)
#     result = ai_engine.predict(request.text)
    
#     return {
#         "mode": "manual",
#         "results": [result] # Return as a list so the frontend treats it the same way
#     }

# # 4. Run Server
# if __name__ == "__main__":
#     uvicorn.run(app, host="127.0.0.1", port=8000)

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from classifier import SentimentAnalyzer
from scraper import scrape_google_reviews
import uvicorn
from fastapi.middleware.cors import CORSMiddleware

# 1. Initialize App
app = FastAPI()

# --- ENABLE CORS (Allow Frontend to talk to Backend) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (simplest for development)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the AI Engine
# Ensure the path matches your actual folder name!
ai_engine = SentimentAnalyzer(model_path="./my_sentiment_model_Roberta_1") 

# --- REQUEST MODELS ---
class ScrapeRequest(BaseModel):
    url: str
    limit: int = 10 

class TextRequest(BaseModel):
    text: str

# --- HELPER FUNCTION (UPDATED FOR MIXED SENTIMENT) ---
def calculate_statistics(results):
    """
    Organizes results into categories (Positive, Negative, Neutral, Mixed)
    with counts and percentages.
    """
    total = len(results)
    if total == 0:
        return {}

    # 1. Initialize Containers (Now including "Mixed")
    stats = {
        "Positive": {"count": 0, "reviews": []},
        "Negative": {"count": 0, "reviews": []},
        "Neutral":  {"count": 0, "reviews": []},
        "Mixed":    {"count": 0, "reviews": []} 
    }

    # 2. Sort Reviews into Categories
    for item in results:
        tags = item['sentiment'] # This is a list, e.g., ['Positive', 'Negative']
        
        # LOGIC: Check for Mixed first
        if "Positive" in tags and "Negative" in tags:
            category = "Mixed"
        elif "Positive" in tags:
            category = "Positive"
        elif "Negative" in tags:
            category = "Negative"
        else:
            category = "Neutral" # Default fallback
        
        # Add to the correct bin
        if category in stats:
            stats[category]["count"] += 1
            stats[category]["reviews"].append(item)

    # 3. Calculate Percentages
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

# --- ENDPOINTS ---

@app.post("/analyze_reviews")
def analyze_reviews(request: ScrapeRequest):
    print(f"Received scraper request for: {request.url}")
    
    if "google" not in request.url or "maps" not in request.url:
        raise HTTPException(status_code=400, detail="Invalid URL. Please provide a valid Google Maps link.")
        
    print("Scraping reviews...")
    raw_reviews = scrape_google_reviews(request.url, request.limit)
    
    if not raw_reviews:
        return {"message": "No reviews found.", "data": []}

    print(f"Classifying {len(raw_reviews)} reviews...")
    analyzed_results = []
    
    for review_text in raw_reviews:
        result = ai_engine.predict(review_text)
        analyzed_results.append(result)

    # Calculate stats with the new "Mixed" logic
    summary = calculate_statistics(analyzed_results)

    return {
        "mode": "scraper",
        "total_scraped": len(analyzed_results),
        "statistics": summary 
    }

@app.post("/analyze_text")
def analyze_single_text(request: TextRequest):
    print(f"Received manual text: {request.text[:50]}...")
    
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    result = ai_engine.predict(request.text)
    
    summary = calculate_statistics([result])
    
    return {
        "mode": "manual",
        "statistics": summary
    }

# 4. Run Server
if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)