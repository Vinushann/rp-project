# ATHENA vs Self-RAG (Public Numeric Comparison)

Date: 2026-03-08
Purpose: Provide a defensible numeric comparison against a publicly evaluated system that is architecturally similar to ATHENA (RAG + adaptive retrieval behavior + explainability).

## 1) Why Self-RAG Is a Valid Comparator

Self-RAG (ICLR 2024 oral) is conceptually close to ATHENA because both systems:

- Use retrieval augmentation for factual grounding.
- Include a self-reflective/critique stage before final output selection.
- Support adaptive retrieval behavior depending on query/task needs.

Primary sources:
- Self-RAG OpenReview page: https://openreview.net/forum?id=hSyW5go0v8
- Self-RAG arXiv/HF paper page: https://huggingface.co/papers/2310.11511
- ATHENA internal evaluation reports:
  - `backend/app/modules/vinushan/evaluation/rag_comparison_report.md`
  - `backend/app/modules/vinushan/evaluation/rag_evaluation_summary.md`

## 2) ATHENA Measured Metrics (Your System)

| Metric | Value |
|---|---:|
| Evaluation set size | 25 questions |
| Success rate | 100.0% (25/25) |
| Overall quality | 4.44/5 (pre-RAG), 4.68/5 (post-RAG) |
| Overall improvement | +0.24 (+5.4%) |
| Domain knowledge | 4.24 -> 4.56 (+0.32) |
| Avg latency | 35.12s (pre), 38.77s (post) |
| RAG trigger coverage | 19/25 (76.0%) |

Source: ATHENA internal reports listed above.

## 3) Public Self-RAG Numeric Values Found

The following values are publicly visible from the OpenReview discussion/rebuttal and project-linked material:

| Self-RAG metric (publicly visible) | Value | Context |
|---|---:|---|
| Model sizes | 7B, 13B | Reported in paper abstract and pages |
| Retrieval trigger rate (PopQA, threshold 0.5) | ~70% | Authors' response on OpenReview |
| Retrieval trigger rate (PubHealth, threshold 0.5) | <20% | Authors' response on OpenReview |
| % instances with `[Retrieve]` token across representative datasets | 15.8%, 53.3%, 87.7%, 63.2% | OpenReview author response table |
| Passage-count ablation (PopQA sampled 500): best shown score | 0.540 at 7 passages | OpenReview author response table |
| Passage-count ablation values | 2:0.498, 3:0.504, 5:0.504, 7:0.540, 10:0.538, 15:0.528, 20:0.520 | OpenReview author response table |
| Training data scale discussed | 50K -> 150K instances | OpenReview author response (reports notable gains) |
| Cost estimate for generating 150K GPT-4 style data | ~USD 10K (authors' estimate) | OpenReview author response |

Important note:
- These are valid public numbers, but they are not the same evaluation rubric as ATHENA's 1-5 quality scoring framework.

## 4) Side-by-Side Numeric Comparison (What Is Direct vs Indirect)

| Dimension | ATHENA | Self-RAG | Comparability |
|---|---:|---:|---|
| Evaluation set size | 25 questions | Multiple QA benchmarks (e.g., PopQA, PubHealth) | Indirect |
| Explicit RAG usage/trigger behavior | 76.0% of questions used RAG | ~70% PopQA, <20% PubHealth retrieval trigger (at threshold 0.5) | Partial |
| Quality score | 4.68/5 post-RAG | Not reported on a 1-5 rubric | Not direct |
| Improvement over own baseline | +5.4% overall | Reported as improved vs baselines, but not in your rubric | Indirect |
| Latency | 38.77s post-RAG average | Not directly published as end-user latency in same format | Not direct |
| Explainability evidence | Implemented and surfaced in UI timeline | Reflection-token framework and ablations reported | Conceptually direct |

## 5) Viva-Ready Interpretation

You can say this confidently:

"We compared ATHENA with Self-RAG, an ICLR 2024 self-reflective RAG framework. Both systems share adaptive retrieval and self-critique concepts. ATHENA provides explicit product-level evaluation values (4.68/5 overall, +5.4% gain, 76% RAG coverage, 100% success on our 25-question set), while Self-RAG publishes benchmark-oriented values such as retrieval-trigger behavior and ablation performance. This gives us a valid research comparison across architecture and numeric behavior, even though the exact scoring rubrics differ."

## 6) Limitations (State This to Avoid Panel Pushback)

- Not an apples-to-apples benchmark: datasets and rubrics differ.
- Self-RAG public values are benchmark-task-centric; ATHENA values are system-QA-rubric-centric.
- A strict fair comparison would require running both systems on the same fixed question set and scoring rubric.

## 7) If You Want Full Fairness Next

To convert this into a strict head-to-head experiment:

1. Use your current 25-question ATHENA set.
2. Evaluate both systems using the same 5-dimension rubric.
3. Record response latency, citation usage, and hallucination rate.
4. Report mean scores and confidence intervals.

This would produce publication-grade comparability.
