# How KPIs Get Better Over Time 🚀

## Overview
Your system now has a complete **feedback loop** that learns from user interactions to automatically improve KPI recommendations.

## The Complete Feedback Loop

```
1. User uploads data
   ↓
2. System generates KPI cards
   ↓
3. User provides feedback (likes/dislikes)
   ↓
4. Feedback logged to kpi_feedback.jsonl
   ↓
5. Model retrains on new feedback
   ↓
6. KPIs are re-ranked using the model
   ↓
7. Better KPIs shown to users
   ↓
[Loop continues with more feedback]
```

## How to Make KPIs Better

### 1. **Collect User Feedback** (Already Implemented ✅)

Users can:
- 👍 Like KPI cards they find useful
- 👎 Dislike KPI cards they don't want
- ✏️ Suggest custom KPI text

Frontend already has feedback buttons in `AnalysisResults.jsx` that call:
```javascript
POST /ayathma/kpi/feedback
{
  "dataset": "my_dataset",
  "card": "top_dimension_by_measure",
  "columns": ["revenue", "product"],
  "prompt_text": "Top products by revenue",
  "liked": true,
  "user_text": "Show top 10 products"
}
```

### 2. **Train the Model** (Trigger Manually or Automate)

**Option A: Manual Training (Current)**
```bash
# From backend directory
curl -X POST http://localhost:8000/ayathma/kpi/train
```

**Option B: Automated Training (Recommended)**

Add a cron job or scheduled task:
```python
# In your scheduler or cron:
import requests
from datetime import datetime

def retrain_kpi_model_weekly():
    """Train model every week with accumulated feedback"""
    response = requests.post("http://localhost:8000/ayathma/kpi/train")
    if response.ok:
        print(f"✅ Model retrained at {datetime.now()}")
        print(f"Metrics: {response.json()}")
    else:
        print(f"❌ Training failed: {response.text}")
```

Or use a simple cron job:
```bash
# Add to crontab (every Sunday at 2am)
0 2 * * 0 curl -X POST http://localhost:8000/ayathma/kpi/train
```

### 3. **Model Automatically Re-ranks KPIs** (Already Implemented ✅)

Every time `generate_insights()` is called:
1. It generates candidate KPI cards
2. Scores each card using the trained model
3. Re-orders cards by relevance score
4. Returns the most relevant KPIs first

**Code location:** `backend/app/modules/ayathma/app/services/insights.py` (lines ~700)

## What Gets Better Over Time

### Week 1: Fresh Start
- User uploads sales data
- System shows generic KPIs (top products, revenue trends, etc.)
- User dislikes "distribution" cards, likes "top sellers"

### Week 2: After First Training
- Model learns: this user/dataset prefers "top N" rankings
- Next time similar data is uploaded, "top N" cards appear first
- "Distribution" cards are deprioritized

### Week 4: More Feedback
- User consistently likes time-series trends
- Dislikes category breakdowns
- Model learns temporal patterns are important for this domain

### Month 3: Optimized
- System immediately shows relevant KPIs for similar datasets
- Bad KPI cards rarely appear
- User satisfaction improves dramatically

## Key Features That Make It Work

### 1. **Smart Feature Extraction**
- Combines dataset context (column names) with KPI text
- Uses TF-IDF to capture semantic meaning
- Learns patterns like "revenue + product → show top sellers"

### 2. **Graceful Fallback**
- If no model exists → shows default order
- If model fails → continues without crashing
- Always functional, even without training

### 3. **Continuous Improvement**
- More feedback = better model
- Works across different datasets
- Learns domain-specific preferences

## Best Practices for Maximum Improvement

### 1. **Encourage User Feedback**
```javascript
// Add tooltips in your frontend
"Help us improve! 👍 if this KPI is useful, 👎 if not"
```

### 2. **Train Regularly**
- **Weekly training** for active systems
- **Daily training** during initial learning phase
- **Monthly training** for stable systems

### 3. **Monitor Model Performance**
Check training metrics after each run:
```json
{
  "n_examples": 245,
  "accuracy": 0.87,
  "f1_score": 0.84,
  "model_path": "ml/kpi_preference.joblib"
}
```

Good metrics:
- **Accuracy > 0.75** (75%+ correct predictions)
- **F1 Score > 0.70** (balanced precision/recall)
- **n_examples > 50** (enough data to learn)

### 4. **Handle Edge Cases**
```python
# If accuracy is low, collect more feedback:
if metrics["accuracy"] < 0.70:
    print("⚠️ Need more feedback examples")
    # Show feedback prompts more prominently
```

## API Endpoints Summary

### Record Feedback
```bash
POST /ayathma/kpi/feedback
Body: {
  "dataset": "string",
  "card": "string",
  "columns": ["array"],
  "prompt_text": "string",
  "liked": boolean,
  "user_text": "optional string"
}
```

### Train Model
```bash
POST /ayathma/kpi/train
Returns: {
  "n_examples": int,
  "accuracy": float,
  "f1_score": float,
  "model_path": "string"
}
```

### List Feedback (Optional)
```bash
GET /ayathma/kpi/feedback
Returns: [
  {
    "dataset": "...",
    "liked": true,
    "timestamp": "..."
  }
]
```

## Troubleshooting

### "Model not improving"
- ✅ Check feedback is being logged: `ml/kpi_feedback.jsonl`
- ✅ Ensure feedback has both likes AND dislikes
- ✅ Need at least 20+ examples for meaningful training

### "Training fails"
- ✅ Check `kpi_feedback.jsonl` exists and has valid JSON
- ✅ Ensure at least 5 feedback examples exist
- ✅ Check logs for specific error messages

### "KPIs still in wrong order"
- ✅ Verify model was trained successfully
- ✅ Check `ml/kpi_preference.joblib` exists
- ✅ Ensure `insights.py` has KPI_SCORER_AVAILABLE = True

## Advanced: Monitoring Dashboard

Track improvement over time:

```python
# Add to your admin panel
def get_model_stats():
    return {
        "total_feedback": count_feedback_examples(),
        "model_accuracy": load_latest_metrics()["accuracy"],
        "last_trained": get_model_last_modified(),
        "feedback_trend": get_feedback_per_week()
    }
```

## Summary

✅ **What's Implemented:**
- Feedback collection (frontend + backend)
- Feedback logging (JSONL storage)
- Model training (TF-IDF + LogisticRegression)
- Automatic re-ranking in insights

🔄 **To Enable Continuous Improvement:**
1. Encourage users to provide feedback
2. Set up weekly automated training
3. Monitor model accuracy metrics
4. Iterate based on performance

The system will automatically get smarter with each interaction! 🧠✨
