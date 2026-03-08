"""
ATHENA System — RAG-Targeted Evaluation Script (Pre-RAG Baseline)
=================================================================
Tests the system with questions that specifically require:
  - Domain knowledge retrieval (coffee shop operations, best practices)
  - Product/category knowledge not exposed by tools
  - System self-knowledge (architecture, capabilities)
  - Methodology explanation (how forecasts work, what factors matter)
  - Cross-domain reasoning (combining multiple knowledge sources)
  - Causal/explanatory reasoning

These questions are designed so that:
  - Current tool-based system will score LOW (baseline)
  - After RAG integration, scores should jump significantly

Usage:
    source backend/.env  # Ensure OPENAI_API_KEY is set
    python backend/app/modules/vinushan/evaluation/run_rag_evaluation.py
"""

import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import httpx
from openai import OpenAI

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BASE_URL = os.getenv("EVAL_BASE_URL", "http://127.0.0.1:8000")
CHAT_ENDPOINT = f"{BASE_URL}/api/v1/vinushan/chat"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
EVAL_DIR = Path(__file__).parent
QUESTIONS_FILE = EVAL_DIR / "rag_test_questions.json"
RESULTS_FILE = EVAL_DIR / "rag_evaluation_results.json"
SUMMARY_FILE = EVAL_DIR / "rag_evaluation_summary.md"
REQUEST_TIMEOUT = 180.0


def load_questions() -> list[dict]:
    with open(QUESTIONS_FILE) as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# RAG-Focused LLM Judge
# ---------------------------------------------------------------------------
RAG_JUDGE_SYSTEM_PROMPT = """\
You are an expert evaluator for a coffee shop AI assistant. You assess how well
the system answers questions that require KNOWLEDGE RETRIEVAL and DOMAIN
EXPERTISE — not just data lookups.

You will be given a QUESTION, the REASON why RAG (Retrieval-Augmented
Generation) is needed for this question, and the system's ANSWER.

Score the ANSWER on FIVE dimensions (1-5 each):

1. **Relevance** — Does the answer address the specific question asked?
2. **Depth** — Does it go beyond surface-level, providing detailed, actionable insight?
3. **Domain Knowledge** — Does it demonstrate coffee shop / F&B industry expertise?
4. **Specificity** — Does it provide specific, contextual advice (not generic platitudes)?
5. **Actionability** — Can the user take concrete action based on this answer?

Also assign an **Overall Score** (1-5):
  1 = Failed to answer / error / completely irrelevant
  2 = Vague or generic response with no real insight
  3 = Partially addressed but missing depth or domain knowledge
  4 = Good response with relevant details and some actionable advice
  5 = Excellent, comprehensive response with deep domain knowledge

Provide a one-sentence justification.

Respond ONLY with valid JSON:
{
  "relevance": <1-5>,
  "depth": <1-5>,
  "domain_knowledge": <1-5>,
  "specificity": <1-5>,
  "actionability": <1-5>,
  "overall": <1-5>,
  "justification": "<one sentence>"
}
"""


def judge_answer(question: str, answer: str, why_rag: str) -> dict:
    """Use GPT-4o-mini as RAG-focused evaluator."""
    if not OPENAI_API_KEY:
        return {
            "relevance": None, "depth": None, "domain_knowledge": None,
            "specificity": None, "actionability": None, "overall": None,
            "justification": "No OPENAI_API_KEY — skipping judge"
        }
    client = OpenAI(api_key=OPENAI_API_KEY)
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,
            max_tokens=250,
            messages=[
                {"role": "system", "content": RAG_JUDGE_SYSTEM_PROMPT},
                {"role": "user", "content": (
                    f"QUESTION: {question}\n\n"
                    f"WHY RAG IS NEEDED: {why_rag}\n\n"
                    f"ANSWER:\n{answer}"
                )},
            ],
        )
        raw = resp.choices[0].message.content.strip()
        return json.loads(raw)
    except Exception as exc:
        return {
            "relevance": None, "depth": None, "domain_knowledge": None,
            "specificity": None, "actionability": None, "overall": None,
            "justification": f"Judge error: {exc}"
        }


# ---------------------------------------------------------------------------
# Evaluation Logic
# ---------------------------------------------------------------------------
def evaluate_question(q: dict, client: httpx.Client, total: int) -> dict:
    qid = q["id"]
    question = q["question"]
    category = q["category"]
    difficulty = q["difficulty"]
    why_rag = q.get("why_rag_needed", "")

    print(f"  [{qid:02d}/{total}] ({category}) {question[:55]}...", end=" ", flush=True)

    start = time.perf_counter()
    try:
        resp = client.post(
            CHAT_ENDPOINT,
            json={"message": question, "conversation_history": []},
            timeout=REQUEST_TIMEOUT,
        )
        elapsed = time.perf_counter() - start
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        elapsed = time.perf_counter() - start
        print(f"ERROR ({elapsed:.1f}s)")
        return {
            "id": qid, "category": category, "difficulty": difficulty,
            "question": question, "why_rag_needed": why_rag,
            "success": False, "error": str(exc),
            "latency_seconds": round(elapsed, 2),
        }

    answer_text = data.get("response", "")
    agents_used = data.get("agents_used", [])

    # RAG-focused judge
    judge = judge_answer(question, answer_text, why_rag)
    overall = judge.get("overall", "N/A")

    print(f"OK ({elapsed:.1f}s) score={overall}")

    return {
        "id": qid,
        "category": category,
        "difficulty": difficulty,
        "question": question,
        "why_rag_needed": why_rag,
        "success": True,
        "latency_seconds": round(elapsed, 2),
        "agents_used": agents_used,
        "answer_length": len(answer_text),
        "answer_preview": answer_text[:600],
        "judge": judge,
    }


# ---------------------------------------------------------------------------
# Summary Report
# ---------------------------------------------------------------------------
def generate_summary(results: list[dict]) -> str:
    total = len(results)
    successes = [r for r in results if r.get("success")]
    failures = [r for r in results if not r.get("success")]
    success_rate = len(successes) / total * 100 if total else 0

    # Latency
    lats = [r["latency_seconds"] for r in successes]
    avg_lat = sum(lats) / len(lats) if lats else 0
    min_lat = min(lats) if lats else 0
    max_lat = max(lats) if lats else 0

    # Dimensions
    dims = ["relevance", "depth", "domain_knowledge", "specificity", "actionability", "overall"]
    dim_avgs = {}
    for d in dims:
        vals = [r["judge"][d] for r in successes if r.get("judge", {}).get(d) is not None]
        dim_avgs[d] = round(sum(vals) / len(vals), 2) if vals else "N/A"

    # Overall distribution
    overalls = [r["judge"]["overall"] for r in successes if r.get("judge", {}).get("overall") is not None]
    dist = {i: overalls.count(i) for i in range(1, 6)}

    # Per-category
    categories = sorted(set(r["category"] for r in results))
    cat_stats = {}
    for cat in categories:
        cr = [r for r in successes if r["category"] == cat]
        cat_overalls = [r["judge"]["overall"] for r in cr if r.get("judge", {}).get("overall") is not None]
        cat_lats = [r["latency_seconds"] for r in cr]
        cat_depth = [r["judge"]["depth"] for r in cr if r.get("judge", {}).get("depth") is not None]
        cat_domain = [r["judge"]["domain_knowledge"] for r in cr if r.get("judge", {}).get("domain_knowledge") is not None]
        cat_stats[cat] = {
            "count": len(cr),
            "avg_overall": round(sum(cat_overalls) / len(cat_overalls), 2) if cat_overalls else "N/A",
            "avg_depth": round(sum(cat_depth) / len(cat_depth), 2) if cat_depth else "N/A",
            "avg_domain": round(sum(cat_domain) / len(cat_domain), 2) if cat_domain else "N/A",
            "avg_latency": round(sum(cat_lats) / len(cat_lats), 2) if cat_lats else "N/A",
        }

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    md = f"""# ATHENA RAG-Targeted Evaluation Report
## Pre-RAG Baseline — Knowledge Retrieval Performance

**Date:** {now}  
**Endpoint:** `{CHAT_ENDPOINT}`  
**Total Questions:** {total}  
**System Version:** Current (Tool-based, No RAG)  
**Purpose:** Establish baseline for questions that **require domain knowledge retrieval** — to measure improvement after RAG integration.

---

## Why This Evaluation Matters

The general evaluation scored **4.60/5** — but those questions were designed for tool-based data lookups (historical sales, forecasts, weather/holiday impact). This evaluation tests questions that require:

- **Domain expertise** (coffee shop operations, best practices)
- **Product knowledge** (categories, relationships, seasonal patterns)
- **System self-awareness** (architecture, agent capabilities)
- **Methodology explanations** (how forecasts are computed)
- **Cross-domain reasoning** (combining multiple knowledge sources)
- **Causal analysis** (why something happened and what to do about it)

These are the question types where RAG should produce a **significant performance jump**.

---

## Overall Metrics (RAG-Targeted Questions)

| Metric | Value |
|--------|-------|
| **Success Rate** | {success_rate:.1f}% ({len(successes)}/{total}) |
| **Avg Response Time** | {avg_lat:.2f}s |
| **Min / Max Response Time** | {min_lat:.2f}s / {max_lat:.2f}s |

### Multi-Dimensional Scoring (1-5 scale)

| Dimension | Avg Score | Description |
|-----------|-----------|-------------|
| **Overall** | **{dim_avgs['overall']}** | Composite quality score |
| **Relevance** | {dim_avgs['relevance']} | Does it address the question? |
| **Depth** | {dim_avgs['depth']} | Beyond surface-level? |
| **Domain Knowledge** | {dim_avgs['domain_knowledge']} | Coffee shop / F&B expertise? |
| **Specificity** | {dim_avgs['specificity']} | Contextual, not generic? |
| **Actionability** | {dim_avgs['actionability']} | Can user act on this? |

---

## Overall Score Distribution

| Score | Count | Percentage |
|-------|-------|-----------|
"""
    labels = {5: "Excellent", 4: "Good", 3: "Average", 2: "Poor", 1: "Bad"}
    for s in range(5, 0, -1):
        cnt = dist.get(s, 0)
        pct = cnt / len(overalls) * 100 if overalls else 0
        bar = "█" * int(pct / 3)
        md += f"| {s} — {labels[s]} | {cnt} | {pct:.1f}% {bar} |\n"

    md += f"""
---

## Per-Category Breakdown

| Category | # Qs | Overall | Depth | Domain Knowledge | Avg Latency |
|----------|------|---------|-------|------------------|-------------|
"""
    for cat in categories:
        cs = cat_stats[cat]
        md += f"| {cat} | {cs['count']} | {cs['avg_overall']} | {cs['avg_depth']} | {cs['avg_domain']} | {cs['avg_latency']}s |\n"

    md += f"""
---

## Individual Results

| # | Category | Question | Score | Depth | Domain | Latency | Justification |
|---|----------|----------|-------|-------|--------|---------|---------------|
"""
    for r in results:
        if r.get("success"):
            j = r.get("judge", {})
            md += (
                f"| {r['id']} | {r['category']} | {r['question'][:40]}... "
                f"| {j.get('overall','N/A')} | {j.get('depth','N/A')} "
                f"| {j.get('domain_knowledge','N/A')} | {r['latency_seconds']:.1f}s "
                f"| {j.get('justification','')[:60]}... |\n"
            )
        else:
            md += f"| {r['id']} | {r['category']} | {r['question'][:40]}... | FAIL | - | - | {r['latency_seconds']:.1f}s | {r.get('error','')} |\n"

    # Comparison section
    md += f"""
---

## Comparison: General vs RAG-Targeted Evaluation

| Metric | General (Tool-Based Qs) | RAG-Targeted (This Test) | Gap |
|--------|------------------------|-------------------------|-----|
| **Avg Overall Score** | 4.60 / 5 | {dim_avgs['overall']} / 5 | {round(4.60 - (dim_avgs['overall'] if isinstance(dim_avgs['overall'], (int, float)) else 0), 2)} |
| **Questions Tested** | 20 | {total} | — |
| **Avg Latency** | 36.71s | {avg_lat:.2f}s | — |

> **Interpretation:** The gap between general and RAG-targeted scores represents the
> improvement opportunity for RAG integration. A larger gap = more room for RAG to help.

---

## Expected Improvements After RAG

| Dimension | Current (Pre-RAG) | Expected (Post-RAG) | Why |
|-----------|--------------------|---------------------|-----|
| **Domain Knowledge** | {dim_avgs['domain_knowledge']} | 4.0 - 4.5 | RAG retrieves coffee shop best practices |
| **Depth** | {dim_avgs['depth']} | 4.0 - 4.5 | RAG provides detailed context from knowledge base |
| **Specificity** | {dim_avgs['specificity']} | 4.0 - 4.5 | RAG grounds answers in specific documents |
| **Actionability** | {dim_avgs['actionability']} | 4.0 - 4.5 | Domain knowledge enables better recommendations |
| **Overall** | {dim_avgs['overall']} | 4.0 - 4.5 | Combined improvement across all dimensions |

---

## Notes

- **Evaluation method**: Non-streaming `/chat` endpoint (synchronous)
- **LLM Judge**: GPT-4o-mini (temperature=0) with 5-dimension RAG-focused rubric
- **Baseline**: Pure tool-based agent orchestration — no document retrieval
- **Key insight**: These scores represent the **floor** — the minimum performance
  without any knowledge retrieval capability
- Re-run this same script after RAG integration to measure the improvement
"""
    return md


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=" * 65)
    print("  ATHENA RAG-Targeted Evaluation — Pre-RAG Baseline")
    print("=" * 65)

    # Verify backend
    print("\n[1/4] Verifying backend connectivity...")
    try:
        with httpx.Client() as c:
            r = c.get(f"{BASE_URL}/api/v1/vinushan/ping", timeout=10)
            r.raise_for_status()
            print(f"  ✅ Backend reachable: {r.json()}")
    except Exception as exc:
        print(f"  ❌ Cannot reach backend at {BASE_URL}: {exc}")
        sys.exit(1)

    # Load questions
    print("\n[2/4] Loading RAG-targeted test questions...")
    questions = load_questions()
    cats = sorted(set(q["category"] for q in questions))
    print(f"  Loaded {len(questions)} questions across {len(cats)} categories:")
    for cat in cats:
        n = sum(1 for q in questions if q["category"] == cat)
        print(f"    - {cat}: {n} questions")

    # Evaluate
    print(f"\n[3/4] Running evaluation ({len(questions)} questions)...")
    print(f"  Timeout: {REQUEST_TIMEOUT}s per question\n")

    results = []
    with httpx.Client() as client:
        for q in questions:
            result = evaluate_question(q, client, len(questions))
            results.append(result)

    # Save
    print(f"\n[4/4] Saving results...")
    with open(RESULTS_FILE, "w") as f:
        json.dump({
            "metadata": {
                "timestamp": datetime.now().isoformat(),
                "endpoint": CHAT_ENDPOINT,
                "total_questions": len(questions),
                "system_version": "pre-rag-baseline",
                "evaluation_type": "rag-targeted",
            },
            "results": results,
        }, f, indent=2)
    print(f"  ✅ Raw results: {RESULTS_FILE}")

    summary = generate_summary(results)
    with open(SUMMARY_FILE, "w") as f:
        f.write(summary)
    print(f"  ✅ Summary report: {SUMMARY_FILE}")

    # Quick stats
    successes = [r for r in results if r.get("success")]
    dims = ["overall", "relevance", "depth", "domain_knowledge", "specificity", "actionability"]
    print("\n" + "=" * 65)
    print(f"  Success: {len(successes)}/{len(results)}")
    for d in dims:
        vals = [r["judge"][d] for r in successes if r.get("judge", {}).get(d) is not None]
        avg = sum(vals) / len(vals) if vals else 0
        print(f"  {d:20s}: {avg:.2f}/5")
    lats = [r["latency_seconds"] for r in successes]
    print(f"  {'avg_latency':20s}: {sum(lats)/len(lats):.2f}s")
    print("=" * 65)


if __name__ == "__main__":
    main()
