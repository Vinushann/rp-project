# Context-Aware Forecasting Crew

Multi-agent pipeline that helps a Sri Lankan coffee shop manager plan the next month. The crew:

- reads the cleaned `data/the_rossmann_coffee_shop_sales_dataset.csv`
- summarizes item-level history Dear students,

Kindly share this with other friends of yours from other universities such as Horizon, NSBM, ESOFT etc. A great help. If you have not filled this please fill it. It will take just 5 minutes. This is extremely important for me in an academic work.

I kindly request a few minutes (Just 5 minutes) of your valuable time to complete tDear students,

Kindly share this with other friends of yours from other universities such as Horizon, NSBM, ESOFT etc. A great help. If you have not filled this please fill it. It will take just 5 minutes. This is extremely important for me in an academic work.

I kindly request a few minutes (Just 5 minutes) of your valuable time to complete the following questionnaire, which is part of an academic research study on university selection for undergraduate Information Technology programs in private universities in Sri Lanka. Everyone please fill this form.

Please note that:
All responses are anonymous and confidential
The questionnaire is for academic purposes only
There are no right or wrong answers — only your genuine opinions matter

Google Form Link-

https://docs.google.com/forms/d/e/1FAIpQLScEEtYHo83MvpBB2Im69W0W2OxC8jxqMtTcfSPBJzkowIQNWA/viewform?usp=publish-editorDear students,

Kindly share this with other friends of yours from other universities such as Horizon, NSBM, ESOFT etc. A great help. If you have not filled this please fill it. It will take just 5 minutes. This is extremely important for me in an academic work.

I kindly request a few minutes (Just 5 minutes) of your valuable time to complete the following questionnaire, which is part of an academic research study on university selection for undergraduate Information Technology programs in private universities in Sri Lanka. Everyone please fill this form.

Please note that:
All responses are anonymous and confidential
The questionnaire is for academic purposes only
There are no right or wrong answers — only your genuine opinions matter

Google Form Link-

https://docs.google.com/forms/d/e/1FAIpQLScEEtYHo83MvpBB2Im69W0W2OxC8jxqMtTcfSPBJzkowIQNWA/viewform?usp=publish-editorhe following questionnaire, which is part of an academic research study on university selection for undergraduate Information Technology programs in private universities in Sri Lanka. Everyone please fill this form.

Please note that:
All responses are anonymous and confidential
The questionnaire is for academic purposes only
There are no right or wrong answers — only your genuine opinions matter

Google Form Link-

https://docs.google.com/forms/d/e/1FAIpQLScEEtYHo83MvpBB2Im69W0W2OxC8jxqMtTcfSPBJzkowIQNWA/viewform?usp=publish-editorfor the target month
- forecasts daily demand with a blended seasonal baseline
- adds holiday and weather context
- writes a short action plan (promotions, staffing, inventory, risks)

## Installation

Requirements: Python >= 3.10, < 3.14 plus uv or pip. Install deps (uv example):

```bash
pip install uv
uv pip install -e .
```

## Environment

Add these to `.env`:

```
OPENAI_API_KEY=sk-...
SALES_DATA_PATH=data/the_rossmann_coffee_shop_sales_dataset.csv  # optional override
BUSINESS_NAME=Rossmann Coffee Shop                             # optional
BUSINESS_LOCATION=Katunayake / Negombo, Sri Lanka              # optional
HISTORY_YEARS=4                                                # optional
```

You can also set `TARGET_MONTH` and `TARGET_YEAR` if you want to plan a specific period.

## Running the crew

```bash
crewai run
```

During startup the runner:
1. Loads `.env`
2. Picks next calendar month (or the override supplied via env/trigger)
3. Executes the five tasks (history, forecast, holidays, weather, planner)
4. Writes the final plan to `reports/monthly_plan.md`

Other entrypoints (`crewai train`, `crewai test`, etc.) reuse the same inputs.

## Agents & Tasks

| Agent | Tool | Output |
| --- | --- | --- |
| Historical Analyst | Item History Tool | JSON for top/falling/discount-heavy items + action notes |
| Forecasting Specialist | Daily Forecast Tool | Daily predictions + MAE/MAPE + staffing summary |
| Holiday Analyst | Holiday Context Tool | Bullet list of holiday effects and actions |
| Weather Analyst | Weather Context Tool | Rain + temperature impact by category |
| Strategy Planner | (context only) | Markdown plan with sections (Demand, Promotions, Staffing, Inventory, Risks) + summary table |

## Data expectations

The single CSV already contains item-level rows plus calendar, holiday, and weather columns. No extra preprocessing is required; the new Python tools build any aggregated view in-memory.

## Customizing

- Update `config/agents.yaml` for tone.
- Update `config/tasks.yaml` if you change deliverables.
- Extend `src/contextawareforecastingsys/tools/` when you add new analytics modules.

## Support

- [crewAI docs](https://docs.crewai.com)
- [crewAI GitHub](https://github.com/joaomdmoura/crewai)
