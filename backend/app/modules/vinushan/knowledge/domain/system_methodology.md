# ATHENA System — Architecture and Methodology Documentation

## System Overview
ATHENA (Adaptive Tactical Helper for Enterprise Needs and Analytics) is an AI-powered context-aware forecasting and decision support system designed for coffee shop managers. It uses a multi-agent architecture to provide intelligent business insights by combining machine learning forecasting with contextual data (weather, holidays, calendar patterns).

## Core Components

### Query Router
- Uses GPT-4o-mini to classify user questions and route them to the appropriate agents.
- Classifies questions into categories: historical, forecasting, holiday, weather, strategy, visualization.
- Returns which agents should handle the question, with reasoning.
- Conversational messages (greetings, small talk) are handled without invoking any agent.

### Multi-Agent System (CrewAI)
The system uses CrewAI to orchestrate 6 specialized AI agents:

1. **Historical Analyst**: Analyzes past sales data — top sellers, declining items, discount patterns, seasonal trends.
2. **Forecasting Specialist**: Uses the trained Prophet model to predict future demand, busiest days, and expected sales volumes.
3. **Holiday Analyst**: Explains how Sri Lankan holidays (Poya days, Sinhala New Year, Vesak, Christmas) affect sales demand.
4. **Weather Analyst**: Correlates weather patterns (rain, temperature) with product-level sales changes.
5. **Strategy Planner**: Combines insights from other agents to provide actionable business recommendations.
6. **Visualization Specialist**: Generates charts and graphs (trend charts, bar charts, pie charts, daily pattern charts, year comparisons).

### Prophet Forecasting Model
- Model type: Facebook Prophet (additive time-series model)
- Training data: Daily aggregated sales from January 2020 to September 2025
- Features/regressors:
  - `is_weekend`: Binary flag for Saturday/Sunday
  - `is_holiday`: Binary flag for Sri Lankan holidays
  - `is_pre_holiday`: 1 day before a holiday
  - `is_post_holiday`: 1 day after a holiday
  - `temp_avg`: Average daily temperature (°C)
  - `rain_mm`: Daily rainfall in millimeters
  - `is_rainy`: Binary flag for rainy days
- Seasonality: Weekly and yearly seasonality components
- Performance metrics:
  - MAE (Mean Absolute Error): 7.94
  - RMSE (Root Mean Square Error): 15.58
  - Improvement over baseline: 64%
- The model captures:
  - Weekly patterns (weekend peaks, midweek dips)
  - Yearly seasonality (December peaks, monsoon dips)
  - Holiday effects (pre/post holiday demand changes)
  - Weather impact (rain reduces traffic, temperature affects drink preferences)

### Tool System
Agents use specialized tools to access data and generate outputs:
- **ItemHistoryTool**: Retrieves historical sales data for specific months, showing top sellers, declining items, and discount patterns.
- **ForecastingTool**: Baseline blended forecast using seasonal naive methods.
- **TimeSeriesForecastTool**: Uses the trained Prophet model for daily predictions with confidence intervals.
- **HolidayContextTool**: Returns holiday schedule and impact estimates for a given month.
- **WeatherContextTool**: Returns weather-based product recommendations for a given month.
- **Visualization Tools** (7 types): Generate base64-encoded chart images with explanations.

## Data Pipeline
1. Raw data: Rossmann coffee shop sales dataset (20,830 transaction records, 2020–2025)
2. Feature engineering: Added weather data (temperature, rainfall), holiday calendar, calendar features (weekend, month start/end, week of month)
3. Daily aggregation: Transaction-level data aggregated to daily totals for time-series modeling
4. Training dataset: `athena_daily_ts_dataset.csv` — used for Prophet model training

## Real-Time Streaming
- Uses Server-Sent Events (SSE) for real-time progressive display
- Events include: query analysis, agent start/end, tool invocations, intermediate results, and final response
- Allows users to see the system's reasoning process as agents work

## Available Visualization Types
1. **Sales Trend Chart**: Line chart showing sales over time, with optional item filter
2. **Top Items Chart**: Bar chart of best-selling items for a given period
3. **Daily Pattern Chart**: Day-of-week analysis showing average sales per weekday
4. **Year Comparison Chart**: Side-by-side comparison of two years for the same period
5. **Category Pie Chart**: Breakdown of sales by product category
6. **Weather Impact Chart**: Visualization of weather effects on different product types
7. **Holiday Impact Chart**: Chart showing sales variations around holiday periods
