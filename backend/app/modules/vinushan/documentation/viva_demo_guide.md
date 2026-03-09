# ATHENA Chatbot - Viva Demonstration Guide

> **Purpose**: This guide contains example questions and prompts to demonstrate ATHENA's capabilities during your viva presentation.

---

## 🎯 System Overview (Quick Pitch)

ATHENA is a **Context-Aware AI Sales Forecasting Assistant** that helps coffee shop managers:
- Analyze historical sales data
- Generate intelligent forecasts
- Create visual reports
- Provide actionable business insights

---

## 📋 Demo Question Categories

### 1. 📊 Sales Analysis & Trends

These questions demonstrate ATHENA's ability to analyze historical sales data:

```
"What were the total sales for last month?"

"Show me the sales trend for the past 6 months"

"Which products had the highest sales in 2024?"

"Compare sales between weekdays and weekends"

"What is the average daily revenue?"

"Which day of the week has the highest sales?"
```

---

### 2. 📈 Visualization & Charts

These questions showcase the data visualization capabilities:

```
"Visualize the monthly sales trend"

"Create a chart showing sales by product category"

"Show me a pie chart of revenue distribution by product"

"Generate a bar chart comparing quarterly sales"

"Visualize weekly sales patterns"
```

**💡 Tip for Demo**: After the chart appears, you can explain:
- "The system generates interactive charts using Chart.js"
- "Data is pulled from our historical sales database"

---

### 3. 🔮 Sales Forecasting

These questions demonstrate the AI forecasting capabilities:

```
"Forecast sales for next month"

"Predict the sales trend for the next quarter"

"What are the expected sales for next week?"

"Generate a sales forecast for February 2026"

"What products should we stock more based on trends?"
```

---

### 4. 📅 Time-Based Queries

Questions that show temporal understanding:

```
"How did sales perform during the holiday season?"

"Show me sales data for December 2024"

"What were our peak sales hours?"

"Compare this month's sales to the same month last year"

"What is the seasonal pattern in our sales?"
```

---

### 5. 🏪 Product & Category Analysis

Questions about specific products or categories:

```
"Which coffee products are best sellers?"

"What is the sales breakdown by product category?"

"Show me the performance of espresso-based drinks"

"Which items have declining sales?"

"What products should we promote more?"
```

---

### 6. 💡 Business Insights & Recommendations

Questions that showcase AI reasoning:

```
"What insights can you give me about our sales performance?"

"How can we improve our weekend sales?"

"What are the key factors affecting our revenue?"

"Suggest strategies to increase average transaction value"

"What patterns do you see in customer purchasing behavior?"
```

---

### 7. 📝 Report Generation

Questions for generating comprehensive reports:

```
"Generate a monthly sales report"

"Create a summary of our Q4 performance"

"Prepare a sales analysis report for the management"

"Give me an executive summary of our sales trends"
```

---

## 🎬 Recommended Demo Flow

### Opening (2 minutes)
1. Introduce ATHENA: "This is ATHENA - an AI-powered sales forecasting assistant"
2. Explain the problem it solves: "It helps coffee shop managers make data-driven decisions"

### Live Demo (5-7 minutes)

**Step 1: Start Simple**
```
"What were the total sales last month?"
```
*Shows: Basic data retrieval and natural language understanding*

**Step 2: Visualization**
```
"Visualize the monthly sales trend for 2024"
```
*Shows: Chart generation capabilities*

**Step 3: Forecasting**
```
"Forecast sales for next month"
```
*Shows: AI prediction capabilities*

**Step 4: Insights**
```
"What insights can you give me about improving sales?"
```
*Shows: AI reasoning and business recommendations*

### Closing (1 minute)
- Highlight key features: Real-time streaming, Chart visualization, Export options
- Mention the tech stack: React, FastAPI, CrewAI, Chart.js

---

## ⚙️ Key Features to Highlight

| Feature | How to Demo |
|---------|-------------|
| **Real-time Streaming** | Show how responses appear word-by-word |
| **Chart Visualization** | Ask for any "visualize" or "show chart" query |
| **Text-to-Speech** | Click the 🔊 speaker icon on any response |
| **Export Options** | Click 📄 to export response as PDF/DOCX |
| **Chat Persistence** | Refresh the page - conversations are saved |
| **Delete Messages** | Hover over a message and click the delete icon |

---

## 🚨 Troubleshooting During Demo

| Issue | Quick Fix |
|-------|-----------|
| Chart not loading | Say "The visualization is processing" and wait a few seconds |
| Slow response | Explain "The AI is analyzing the data, which takes a moment" |
| Error message | Refresh and try a simpler query first |

---

## 📚 Technical Points to Mention

If asked about the technology:

1. **Frontend**: React 18 with Vite, Tailwind CSS, Chart.js
2. **Backend**: FastAPI with Python
3. **AI Engine**: CrewAI framework with multiple specialized agents
4. **Streaming**: Server-Sent Events (SSE) for real-time responses
5. **Data**: Historical sales data from 2020-2025

---

## ✅ Pre-Demo Checklist

- [ ] Backend server running (`uvicorn app.main:app --reload --port 8000`)
- [ ] Frontend running (`npm run dev`)
- [ ] Test one simple query before presenting
- [ ] Have this guide open for reference
- [ ] Clear any old chat history if needed

---

**Good luck with your viva! 🎓**
