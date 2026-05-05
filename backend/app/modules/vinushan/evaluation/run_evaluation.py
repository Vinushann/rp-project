"""
ATHENA System Evaluation Script (Pre-RAG Baseline)
===================================================
Evaluates the current context-aware forecasting system performance by:
1. Sending test questions to the /chat endpoint
2. Measuring response time, routing accuracy, and response quality
3. Using LLM-as-judge for answer relevance scoring
4. Storing results in JSON and generating a summary report

Usage:
    cd backend
    python -m app.modules.vinushan.evaluation.run_evaluation

    OR from project root:
    python backend/app/modules/vinushan/evaluation/run_evaluation.py
"""

import json
import os
import time
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx
from openai import OpenAI

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BASE_URL = os.getenv("EVAL_BASE_URL", "http://127.0.0.1:8000")
CHAT_ENDPOINT = f"{BASE_URL}/api/v1/vinushan/chat"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
EVAL_DIR = Path(__file__).parent
QUESTIONS_FILE = EVAL_DIR / "test_questions.json"
RESULTS_FILE = EVAL_DIR / "evaluation_results.json"
SUMMARY_FILE = EVAL_DIR / "evaluation_summary.md"

# Timeout per question (seconds) — some multi-agent queries take a while
REQUEST_TIMEOUT = 180.0


def load_questions() -> list[dict]:
    with open(QUESTIONS_FILE) as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# LLM-as-judge: Answer Relevance Scoring
# ---------------------------------------------------------------------------
JUDGE_SYSTEM_PROMPT = """\
You are an impartial evaluator. You will be given a QUESTION and an ANSWER
produced by a coffee-shop forecasting AI assistant.

Score the ANSWER on a scale from 1 to 5 using these criteria:

1 — Completely irrelevant, gibberish, or error message
2 — Partially relevant but mostly unhelpful or incorrect
3 — Relevant but missing key details or somewhat vague
4 — Good answer, relevant with useful details
5 — Excellent, comprehensive, directly addresses the question with actionable detail

Also provide a one-sentence justification.

Respond ONLY with valid JSON:
{"score": <int 1-5>, "justification": "<one sentence>"}
"""


def judge_answer(question: str, answer: str) -> dict:
    """Use GPT-4o-mini to score answer relevance."""
    if not OPENAI_API_KEY:
        return {"score": None, "justification": "No OPENAI_API_KEY set — skipping LLM judge"}

    client = OpenAI(api_key=OPENAI_API_KEY)
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,
            max_tokens=150,
            messages=[
                {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
                {"role": "user", "content": f"QUESTION: {question}\n\nANSWER: {answer}"},
            ],
        )
        raw = resp.choices[0].message.content.strip()
        return json.loads(raw)
    except Exception as exc:
        return {"score": None, "justification": f"Judge error: {exc}"}


# ---------------------------------------------------------------------------
# Routing Accuracy
# ---------------------------------------------------------------------------
def compute_routing_accuracy(expected: list[str], actual: list[str]) -> dict:
    """Compute routing precision, recall, and F1."""
    expected_set = set(expected)
    actual_set = set(actual)

    if not expected_set and not actual_set:
        return {"precision": 1.0, "recall": 1.0, "f1": 1.0, "exact_match": True}

    if not expected_set or not actual_set:
        return {
            "precision": 0.0 if actual_set else 1.0,
            "recall": 0.0 if expected_set else 1.0,
            "f1": 0.0,
            "exact_match": expected_set == actual_set,
        }

    tp = len(expected_set & actual_set)
    precision = tp / len(actual_set) if actual_set else 0.0
    recall = tp / len(expected_set) if expected_set else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0

    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "exact_match": expected_set == actual_set,
    }


# ---------------------------------------------------------------------------
# Core Evaluation
# ---------------------------------------------------------------------------
def evaluate_question(q: dict, client: httpx.Client) -> dict:
    """Send one question and measure performance."""
    qid = q["id"]
    question = q["question"]
    expected_agents = q.get("expected_agents", [])
    category = q["category"]
    difficulty = q["difficulty"]

    print(f"  [{qid:02d}/{20}] ({category}) {question[:60]}...", end=" ", flush=True)

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
            "id": qid,
            "category": category,
            "difficulty": difficulty,
            "question": question,
            "expected_agents": expected_agents,
            "success": False,
            "error": str(exc),
            "latency_seconds": round(elapsed, 2),
        }

    answer_text = data.get("response", "")
    agents_used = data.get("agents_used", [])
    routing_reasoning = data.get("routing_reasoning", "")
    charts = data.get("charts", [])

    # Routing accuracy
    routing = compute_routing_accuracy(expected_agents, agents_used)

    # LLM judge
    judge = judge_answer(question, answer_text)

    print(f"OK ({elapsed:.1f}s) score={judge.get('score', 'N/A')}")

    return {
        "id": qid,
        "category": category,
        "difficulty": difficulty,
        "question": question,
        "expected_agents": expected_agents,
        "actual_agents": agents_used,
        "success": True,
        "latency_seconds": round(elapsed, 2),
        "answer_length": len(answer_text),
        "answer_preview": answer_text[:500],
        "num_charts": len(charts),
        "routing": routing,
        "routing_reasoning": routing_reasoning,
        "judge_score": judge.get("score"),
        "judge_justification": judge.get("justification", ""),
    }


# ---------------------------------------------------------------------------
# Summary Generation
# ---------------------------------------------------------------------------
def generate_summary(results: list[dict]) -> str:
    """Generate a Markdown summary report."""
    total = len(results)
    successes = [r for r in results if r.get("success")]
    failures = [r for r in results if not r.get("success")]

    # Success rate
    success_rate = len(successes) / total * 100 if total else 0

    # Latency stats
    latencies = [r["latency_seconds"] for r in successes]
    avg_lat = sum(latencies) / len(latencies) if latencies else 0
    max_lat = max(latencies) if latencies else 0
    min_lat = min(latencies) if latencies else 0

    # LLM judge stats
    scores = [r["judge_score"] for r in successes if r.get("judge_score") is not None]
    avg_score = sum(scores) / len(scores) if scores else 0
    score_dist = {i: scores.count(i) for i in range(1, 6)}

    # Routing accuracy
    exact_matches = sum(1 for r in successes if r.get("routing", {}).get("exact_match"))
    routing_f1s = [r["routing"]["f1"] for r in successes if "routing" in r]
    avg_routing_f1 = sum(routing_f1s) / len(routing_f1s) if routing_f1s else 0

    # Per-category breakdown
    categories = sorted(set(r["category"] for r in results))
    cat_stats = {}
    for cat in categories:
        cat_results = [r for r in successes if r["category"] == cat]
        cat_scores = [r["judge_score"] for r in cat_results if r.get("judge_score") is not None]
        cat_lats = [r["latency_seconds"] for r in cat_results]
        cat_stats[cat] = {
            "count": len(cat_results),
            "avg_score": round(sum(cat_scores) / len(cat_scores), 2) if cat_scores else "N/A",
            "avg_latency": round(sum(cat_lats) / len(cat_lats), 2) if cat_lats else "N/A",
        }

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    md = f"""# ATHENA System Evaluation Report
## Pre-RAG Baseline Performance

**Date:** {now}  
**Endpoint:** `{CHAT_ENDPOINT}`  
**Total Questions:** {total}  
**System Version:** Current (Tool-based, No RAG)

---

## Overall Metrics

| Metric | Value |
|--------|-------|
| **Success Rate** | {success_rate:.1f}% ({len(successes)}/{total}) |
| **Avg Response Time** | {avg_lat:.2f}s |
| **Min Response Time** | {min_lat:.2f}s |
| **Max Response Time** | {max_lat:.2f}s |
| **Avg Answer Relevance (1-5)** | {avg_score:.2f} |
| **Routing Exact Match** | {exact_matches}/{len(successes)} ({exact_matches/len(successes)*100:.1f}%) |
| **Avg Routing F1** | {avg_routing_f1:.4f} |

---

## Answer Relevance Distribution

| Score | Count | Percentage |
|-------|-------|-----------|
"""
    for s in range(5, 0, -1):
        cnt = score_dist.get(s, 0)
        pct = cnt / len(scores) * 100 if scores else 0
        bar = "█" * int(pct / 5)
        md += f"| {s} — {'Excellent' if s==5 else 'Good' if s==4 else 'Average' if s==3 else 'Poor' if s==2 else 'Bad'} | {cnt} | {pct:.1f}% {bar} |\n"

    md += f"""
---

## Per-Category Breakdown

| Category | Questions | Avg Score | Avg Latency (s) |
|----------|-----------|-----------|-----------------|
"""
    for cat in categories:
        cs = cat_stats[cat]
        md += f"| {cat} | {cs['count']} | {cs['avg_score']} | {cs['avg_latency']} |\n"

    md += f"""
---

## Individual Results

| # | Category | Question | Agents Used | Score | Latency |
|---|----------|----------|-------------|-------|---------|
"""
    for r in results:
        status = "✅" if r.get("success") else "❌"
        agents = ", ".join(r.get("actual_agents", [])) if r.get("success") else "FAILED"
        score = r.get("judge_score", "N/A") if r.get("success") else "N/A"
        lat = f"{r['latency_seconds']:.1f}s"
        md += f"| {r['id']} | {r['category']} | {r['question'][:50]}... | {agents} | {score} | {lat} |\n"

    if failures:
        md += f"""
---

## Failed Questions

"""
        for r in failures:
            md += f"- **Q{r['id']}**: {r['question']}\n  - Error: `{r.get('error', 'Unknown')}`\n"

    md += f"""
---

## Notes

- **Evaluation method**: Non-streaming `/chat` endpoint (synchronous)
- **LLM Judge**: GPT-4o-mini (temperature=0) scoring answer relevance 1-5
- **Routing accuracy**: Compared expected vs actual agents used
- **Baseline**: No RAG enhancement — pure tool-based agent orchestration
- This report serves as the **pre-RAG baseline** for comparison after RAG integration
"""
    return md


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=" * 60)
    print("  ATHENA System Evaluation — Pre-RAG Baseline")
    print("=" * 60)

    # Verify backend
    print("\n[1/4] Verifying backend connectivity...")
    try:
        with httpx.Client() as client:
            r = client.get(f"{BASE_URL}/api/v1/vinushan/ping", timeout=10)
            r.raise_for_status()
            print(f"  ✅ Backend is reachable: {r.json()}")
    except Exception as exc:
        print(f"  ❌ Cannot reach backend at {BASE_URL}: {exc}")
        print("  Make sure the server is running: uvicorn app.main:app --port 8000")
        sys.exit(1)

    # Load questions
    print("\n[2/4] Loading test questions...")
    questions = load_questions()
    print(f"  Loaded {len(questions)} questions across {len(set(q['category'] for q in questions))} categories")

    # Run evaluation
    print(f"\n[3/4] Running evaluation ({len(questions)} questions)...")
    print(f"  Timeout per question: {REQUEST_TIMEOUT}s")
    print()

    results = []
    with httpx.Client() as client:
        for q in questions:
            result = evaluate_question(q, client)
            results.append(result)

    # Save results & summary
    print(f"\n[4/4] Saving results...")
    with open(RESULTS_FILE, "w") as f:
        json.dump(
            {
                "metadata": {
                    "timestamp": datetime.now().isoformat(),
                    "endpoint": CHAT_ENDPOINT,
                    "total_questions": len(questions),
                    "system_version": "pre-rag-baseline",
                },
                "results": results,
            },
            f,
            indent=2,
        )
    print(f"  ✅ Raw results: {RESULTS_FILE}")

    summary = generate_summary(results)
    with open(SUMMARY_FILE, "w") as f:
        f.write(summary)
    print(f"  ✅ Summary report: {SUMMARY_FILE}")

    # Quick stats
    successes = [r for r in results if r.get("success")]
    scores = [r["judge_score"] for r in successes if r.get("judge_score") is not None]
    avg_score = sum(scores) / len(scores) if scores else 0
    avg_lat = sum(r["latency_seconds"] for r in successes) / len(successes) if successes else 0

    print("\n" + "=" * 60)
    print(f"  Success: {len(successes)}/{len(results)}")
    print(f"  Avg Score: {avg_score:.2f}/5")
    print(f"  Avg Latency: {avg_lat:.2f}s")
    print("=" * 60)


if __name__ == "__main__":
    main()
