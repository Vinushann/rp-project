# ATHENA System Evaluation Report
## Pre-RAG Baseline Performance

**Date:** 2026-03-05 16:26:17  
**Endpoint:** `http://127.0.0.1:8000/api/v1/vinushan/chat`  
**Total Questions:** 20  
**System Version:** Current (Tool-based, No RAG)

---

## Overall Metrics

| Metric | Value |
|--------|-------|
| **Success Rate** | 100.0% (20/20) |
| **Avg Response Time** | 36.71s |
| **Min Response Time** | 2.56s |
| **Max Response Time** | 103.33s |
| **Avg Answer Relevance (1-5)** | 4.60 |
| **Routing Exact Match** | 15/20 (75.0%) |
| **Avg Routing F1** | 0.9100 |

---

## Answer Relevance Distribution

| Score | Count | Percentage |
|-------|-------|-----------|
| 5 — Excellent | 16 | 80.0% ████████████████ |
| 4 — Good | 1 | 5.0% █ |
| 3 — Average | 2 | 10.0% ██ |
| 2 — Poor | 1 | 5.0% █ |
| 1 — Bad | 0 | 0.0%  |

---

## Per-Category Breakdown

| Category | Questions | Avg Score | Avg Latency (s) |
|----------|-----------|-----------|-----------------|
| conversational | 1 | 5.0 | 4.2 |
| forecasting | 3 | 4.33 | 31.47 |
| historical | 3 | 5.0 | 24.17 |
| holiday | 2 | 5.0 | 20.96 |
| multi_agent | 3 | 5.0 | 75.78 |
| strategy | 2 | 5.0 | 68.55 |
| visualization | 2 | 2.5 | 17.73 |
| weather | 2 | 4.5 | 40.74 |
| what_if | 2 | 5.0 | 19.93 |

---

## Individual Results

| # | Category | Question | Agents Used | Score | Latency |
|---|----------|----------|-------------|-------|---------|
| 1 | historical | What were the top selling items last March?... | historical | 5 | 19.1s |
| 2 | historical | Which items have been declining in sales over the ... | historical | 5 | 22.9s |
| 3 | historical | Show me the discount patterns from last December... | historical | 5 | 30.5s |
| 4 | forecasting | How much will I sell next month?... | forecasting | 5 | 29.3s |
| 5 | forecasting | What are the predicted busiest days in the next 2 ... | forecasting | 3 | 22.3s |
| 6 | forecasting | Forecast daily demand for July 2025... | forecasting | 5 | 42.8s |
| 7 | holiday | How do Poya days affect my sales?... | holiday | 5 | 21.4s |
| 8 | holiday | What impact do holidays have on coffee shop sales ... | holiday | 5 | 20.6s |
| 9 | weather | How does rainy weather affect my sales?... | weather | 4 | 27.1s |
| 10 | weather | What happens to cold drink sales when temperature ... | weather | 5 | 54.4s |
| 11 | strategy | What should I do to prepare my coffee shop for the... | weather, strategy | 5 | 33.8s |
| 12 | strategy | Give me a comprehensive business plan for next mon... | historical, forecasting, holiday, strategy | 5 | 103.3s |
| 13 | visualization | Show me a chart of sales trends over the last 6 mo... | visualization | 3 | 32.9s |
| 14 | visualization | Create a bar chart of top 10 selling items this ye... | visualization | 2 | 2.6s |
| 15 | multi_agent | Forecast next month's sales and tell me how holida... | forecasting, holiday | 5 | 70.7s |
| 16 | multi_agent | Based on historical data and weather patterns, wha... | historical, weather | 5 | 88.8s |
| 17 | multi_agent | Compare last year's December performance with this... | historical, forecasting, strategy | 5 | 67.8s |
| 18 | what_if | What if there is heavy rain next week, how will it... | weather | 5 | 20.5s |
| 19 | what_if | If there's a holiday next Monday, what should I ex... | holiday | 5 | 19.3s |
| 20 | conversational | Hello, what can you help me with?... |  | 5 | 4.2s |

---

## Notes

- **Evaluation method**: Non-streaming `/chat` endpoint (synchronous)
- **LLM Judge**: GPT-4o-mini (temperature=0) scoring answer relevance 1-5
- **Routing accuracy**: Compared expected vs actual agents used
- **Baseline**: No RAG enhancement — pure tool-based agent orchestration
- This report serves as the **pre-RAG baseline** for comparison after RAG integration
