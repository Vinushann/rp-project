# ATHENA vs ThoughtSpot (Spotter) - Comparison Report

Date: 2026-03-08
Prepared for: RP viva and panel discussion

## 1) Scope and Method

This comparison uses two evidence classes:

1. Verified internal metrics from ATHENA evaluation reports.
2. Publicly available ThoughtSpot product/customer claims from official web pages.

Important:
- ATHENA values below are measured in your own controlled evaluation.
- ThoughtSpot does not publicly publish equivalent head-to-head benchmark values (for your exact task), so several cells are marked `Not publicly disclosed`.

## 2) Source Documents

### ATHENA (internal, measured)
- `backend/app/modules/vinushan/evaluation/rag_comparison_report.md`
- `backend/app/modules/vinushan/evaluation/rag_evaluation_summary.md`

### ThoughtSpot (public pages)
- https://www.thoughtspot.com/product/ai-analyst
- https://www.thoughtspot.com/product/agents/spotter
- https://www.thoughtspot.com/why-thoughtspot
- https://www.thoughtspot.com/product/automated-analytics
- https://www.thoughtspot.com/customers
- https://www.thoughtspot.com/new-features

## 3) Quantitative Comparison Table

| Metric | ATHENA (Your System) | ThoughtSpot Spotter (Public) | Notes |
|---|---:|---|---|
| Evaluation question set size | 25 | Not publicly disclosed | ATHENA uses a defined RAG-targeted 25-question set. |
| Success rate | 100.0% (25/25) | Not publicly disclosed | ATHENA measured in `rag_evaluation_summary.md`. |
| Overall quality score | 4.44/5 (pre-RAG), 4.68/5 (post-RAG) | Not publicly disclosed | ATHENA measured with rubric-based judge. |
| Overall improvement | +0.24 (+5.4%) | Not publicly disclosed | ATHENA pre vs post RAG. |
| Domain knowledge score | 4.24 -> 4.56 (+0.32) | Not publicly disclosed | ATHENA domain-knowledge gain measured. |
| Avg latency | 35.12s (pre), 38.77s (post) | Not publicly disclosed | ATHENA only. |
| RAG usage coverage | 19/25 (76.0%) | Not publicly disclosed | ATHENA only. |
| Score distribution (5/5 answers) | 17 -> 19 | Not publicly disclosed | ATHENA only. |
| Claimed reliability/explainability | Implemented with self-reflection + XAI timeline | Claims "100% reliable answers" and "full verifiability" | ThoughtSpot claims from official product pages. |
| Customer outcome examples | Not included in your current report | "Over $70K in cost savings" (Cox2M case story), "adopted self-service BI in 3 months" (Zencargo case story) | Customer-specific, not universal platform benchmark. |

## 4) Capability Comparison (Research-Friendly)

| Capability Dimension | ATHENA | ThoughtSpot Spotter |
|---|---|---|
| Domain focus (coffee shop forecasting and strategy) | Strong, domain-specialized | Broad enterprise analytics |
| Multi-agent orchestration | Yes (specialist agent flow) | Yes (agentic analytics positioning) |
| Adaptive retrieval | Yes (adaptive RAG profiles) | Not explicitly documented as your style of adaptive RAG |
| Citations / source grounding | Yes (RAG citations) | Claims traceability, semantic grounding |
| Self-reflection before final output | Yes (explicit pipeline phase) | Claims self-checking and refinement |
| Explainability UI for users | Yes (XAI phase: factors, confidence, assumptions, counterfactuals) | Claims explainability/verifiability |
| Real-time reasoning timeline | Yes (phase-by-phase SSE timeline) | Not publicly documented in the same granularity |
| Forecasting + operational action plan in one flow | Yes | Yes (broadly supports analytics and insights-to-actions) |

## 5) ThoughtSpot Public Metrics Found on the Internet

The following numeric claims were found from official ThoughtSpot pages, but they are not standardized head-to-head benchmark metrics for your exact use case:

1. "100% reliable answers" (marketing claim context).
2. Customer story claim: "over $70K in cost savings" (Cox2M case story listing on customers page).
3. Customer story claim: "adopted self-service BI in just 3 months" (Zencargo case story listing on customers page).

These are useful for viva discussion as external evidence, but treat them as case-study/marketing evidence, not controlled benchmark metrics.

## 6) Viva-Ready Interpretation

You can present this defensibly as:

- ATHENA provides measured, reproducible internal metrics for quality, latency, RAG coverage, and score lift.
- ThoughtSpot provides strong public claims and enterprise case stories, but no directly comparable open benchmark values for your exact dataset/task.
- Therefore, your research contribution is a domain-specific, transparent system with explicit measured gains and interpretable pipeline stages.

## 7) If You Need True Head-to-Head Numeric Fairness

Run a controlled benchmark:

1. Use the same 25-question test set.
2. Score both systems with the same rubric (relevance, depth, domain knowledge, specificity, actionability).
3. Report means, deltas, and latency distributions for both.
4. Mark external system constraints where equivalent features are inaccessible.

That produces a publication-style apples-to-apples comparison.
