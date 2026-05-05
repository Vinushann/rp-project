"""
ATHENA System — Post-RAG Evaluation & Comparison Script
========================================================

🎓 WHAT THIS SCRIPT DOES (Beginner Explanation):
─────────────────────────────────────────────────
Think of this like a school exam comparison:

1. We already ran the exam BEFORE giving the student (ATHENA) a textbook (RAG).
   → That was the "Pre-RAG Baseline" (scored 4.44/5 overall)

2. Now we give the student the textbook (6 knowledge documents), and run
   the EXACT SAME exam again.

3. Then we compare: Did having the textbook help? By how much?

The "exam" = 25 carefully chosen questions that NEED domain knowledge.
The "grader" = GPT-4o-mini acting as a judge with a 5-criteria rubric.

Usage:
    cd backend
    source ../.env 2>/dev/null
    ../.venv/bin/python -m app.modules.vinushan.evaluation.run_post_rag_evaluation
"""

import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import httpx
from dotenv import load_dotenv
from openai import OpenAI

# ─────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────
# 🎓 load_dotenv() reads the .env file and sets environment variables
# so we can access the OpenAI API key reliably
_env_path = Path(__file__).resolve().parents[4] / ".env"  # backend/.env
load_dotenv(_env_path, override=True)

BASE_URL = os.getenv("EVAL_BASE_URL", "http://127.0.0.1:8000")
CHAT_ENDPOINT = f"{BASE_URL}/api/v1/vinushan/chat"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
EVAL_DIR = Path(__file__).parent
QUESTIONS_FILE = EVAL_DIR / "rag_test_questions.json"        # Same 25 questions!
PRE_RAG_RESULTS = EVAL_DIR / "rag_evaluation_results.json"   # Pre-RAG baseline
POST_RAG_RESULTS = EVAL_DIR / "post_rag_evaluation_results.json"
COMPARISON_FILE = EVAL_DIR / "rag_comparison_report.md"
REQUEST_TIMEOUT = 180.0


def load_questions() -> list[dict]:
    """Load the same 25 test questions used in the pre-RAG baseline."""
    with open(QUESTIONS_FILE) as f:
        return json.load(f)


def load_pre_rag_results() -> list[dict]:
    """
    Load the pre-RAG baseline results for comparison.
    
    🎓 WHY: We need the "before" scores so we can compare them
    with the "after" scores and calculate the improvement.
    """
    if not PRE_RAG_RESULTS.exists():
        print("  ⚠️  No pre-RAG baseline found. Will generate post-RAG results only.")
        return []
    with open(PRE_RAG_RESULTS) as f:
        data = json.load(f)
    return data.get("results", [])


# ─────────────────────────────────────────────────────────────────────
# LLM Judge — The "Grader"
# ─────────────────────────────────────────────────────────────────────
# 🎓 HOW THE JUDGE WORKS:
# We send each question + ATHENA's answer to GPT-4o-mini and ask it
# to score the answer on 5 criteria (1-5 each). This is called
# "LLM-as-a-Judge" — a standard technique in AI research.
#
# We use the EXACT SAME rubric as the pre-RAG evaluation so the
# comparison is fair (same grader, same criteria, same scale).
# ─────────────────────────────────────────────────────────────────────

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
    """
    Send the question + answer to the LLM judge for scoring.
    
    🎓 This function:
    1. Takes a question and ATHENA's answer
    2. Sends them to GPT-4o-mini with our rubric
    3. GPT-4o-mini returns scores (1-5) for each criterion
    4. We parse the JSON response and return the scores
    """
    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,  # Temperature=0 means deterministic (same input → same output)
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


# ─────────────────────────────────────────────────────────────────────
# Evaluate a Single Question
# ─────────────────────────────────────────────────────────────────────
def evaluate_question(q: dict, client: httpx.Client, total: int) -> dict:
    """
    🎓 For each question, we:
    1. Send it to ATHENA's /chat endpoint (which now has RAG enabled)
    2. Measure how long it takes (latency)
    3. Send the answer to the LLM judge for grading
    4. Return all the data in a structured dict
    """
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
    routing = data.get("routing_reasoning", "")
    
    # 🎓 The sync /chat endpoint now returns rag_used directly.
    # It's True when the router decided domain knowledge was needed
    # and the RAG service successfully retrieved context.
    rag_used = data.get("rag_used", False)

    # Grade the answer
    judge = judge_answer(question, answer_text, why_rag)
    overall = judge.get("overall", "N/A")

    rag_indicator = "📚" if rag_used else "—"
    print(f"OK ({elapsed:.1f}s) score={overall} {rag_indicator}")

    return {
        "id": qid,
        "category": category,
        "difficulty": difficulty,
        "question": question,
        "why_rag_needed": why_rag,
        "success": True,
        "latency_seconds": round(elapsed, 2),
        "agents_used": agents_used,
        "rag_used": rag_used,
        "answer_length": len(answer_text),
        "answer_preview": answer_text[:600],
        "judge": judge,
    }


# ─────────────────────────────────────────────────────────────────────
# Comparison Report Generator
# ─────────────────────────────────────────────────────────────────────

def _avg(values):
    """Safe average that handles empty lists."""
    return round(sum(values) / len(values), 2) if values else 0


def _extract_dim(results, dim):
    """Extract valid scores for a dimension from results."""
    return [r["judge"][dim] for r in results
            if r.get("success") and r.get("judge", {}).get(dim) is not None]


def generate_comparison_report(post_results: list[dict], pre_results: list[dict]) -> str:
    """
    🎓 THE HEART OF THE EVALUATION:
    
    This function creates a markdown report that compares pre-RAG vs post-RAG.
    It calculates:
    - Score improvements per dimension (relevance, depth, etc.)
    - Score improvements per category (system_knowledge, product_knowledge, etc.)
    - Which specific questions improved the most
    - RAG usage statistics (how many questions actually triggered RAG)
    
    This is what you'll show in your viva presentation!
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # ── Post-RAG metrics ──
    post_ok = [r for r in post_results if r.get("success")]
    pre_ok = [r for r in pre_results if r.get("success")]
    
    dims = ["relevance", "depth", "domain_knowledge", "specificity", "actionability", "overall"]
    
    post_avgs = {d: _avg(_extract_dim(post_ok, d)) for d in dims}
    pre_avgs = {d: _avg(_extract_dim(pre_ok, d)) for d in dims}
    
    # Latency
    post_lats = [r["latency_seconds"] for r in post_ok]
    pre_lats = [r["latency_seconds"] for r in pre_ok]
    post_avg_lat = _avg(post_lats)
    pre_avg_lat = _avg(pre_lats)
    
    # RAG usage stats
    rag_triggered = sum(1 for r in post_ok if r.get("rag_used"))
    rag_pct = round(rag_triggered / len(post_ok) * 100, 1) if post_ok else 0
    
    # Score distribution
    post_overalls = _extract_dim(post_ok, "overall")
    pre_overalls = _extract_dim(pre_ok, "overall")
    post_dist = {i: post_overalls.count(i) for i in range(1, 6)}
    pre_dist = {i: pre_overalls.count(i) for i in range(1, 6)}
    
    # Per-category comparison
    categories = sorted(set(r["category"] for r in post_results))
    
    # Per-question comparison
    pre_by_id = {r["id"]: r for r in pre_ok}
    
    # ── Build Report ──
    md = f"""# ATHENA RAG Evaluation — Pre vs Post Comparison Report

**Date:** {now}  
**Evaluation Type:** RAG-Targeted (25 domain knowledge questions)  
**Pre-RAG Baseline:** March 5, 2026  
**Post-RAG Test:** {now}

---

## Executive Summary

"""
    overall_change = post_avgs["overall"] - pre_avgs["overall"]
    direction = "📈 improved" if overall_change > 0 else "📉 decreased" if overall_change < 0 else "→ unchanged"
    
    md += f"""The overall quality score **{direction}** from **{pre_avgs['overall']}/5** (pre-RAG) to **{post_avgs['overall']}/5** (post-RAG), a change of **{overall_change:+.2f}**.

- **RAG was triggered** on **{rag_triggered}/{len(post_ok)}** questions ({rag_pct}%)
- Domain Knowledge score: **{pre_avgs['domain_knowledge']}** → **{post_avgs['domain_knowledge']}** ({post_avgs['domain_knowledge'] - pre_avgs['domain_knowledge']:+.2f})

---

## Head-to-Head Comparison

### Overall Dimension Scores (1-5 scale)

| Dimension | Pre-RAG | Post-RAG | Change | Verdict |
|-----------|:-------:|:--------:|:------:|---------|
"""
    
    for d in dims:
        pre_v = pre_avgs[d]
        post_v = post_avgs[d]
        change = post_v - pre_v
        if change > 0.2:
            verdict = "✅ Improved"
        elif change > 0:
            verdict = "↗️ Slight gain"
        elif change == 0:
            verdict = "→ Same"
        elif change > -0.2:
            verdict = "↘️ Slight drop"
        else:
            verdict = "⚠️ Dropped"
        md += f"| **{d.replace('_', ' ').title()}** | {pre_v} | {post_v} | {change:+.2f} | {verdict} |\n"
    
    md += f"""
### Response Time

| Metric | Pre-RAG | Post-RAG |
|--------|:-------:|:--------:|
| **Avg Latency** | {pre_avg_lat}s | {post_avg_lat}s |
| **Min Latency** | {min(pre_lats) if pre_lats else 'N/A'}s | {min(post_lats) if post_lats else 'N/A'}s |
| **Max Latency** | {max(pre_lats) if pre_lats else 'N/A'}s | {max(post_lats) if post_lats else 'N/A'}s |

---

## Score Distribution

| Score | Pre-RAG | Post-RAG | Change |
|-------|:-------:|:--------:|:------:|
"""
    labels = {5: "Excellent", 4: "Good", 3: "Average", 2: "Poor", 1: "Bad"}
    for s in range(5, 0, -1):
        pre_c = pre_dist.get(s, 0)
        post_c = post_dist.get(s, 0)
        diff = post_c - pre_c
        md += f"| {s} — {labels[s]} | {pre_c} | {post_c} | {diff:+d} |\n"

    md += f"""
---

## Per-Category Comparison

| Category | Pre-RAG Overall | Post-RAG Overall | Change | Pre Depth | Post Depth | Pre Domain | Post Domain |
|----------|:---------------:|:----------------:|:------:|:---------:|:----------:|:----------:|:-----------:|
"""
    for cat in categories:
        pre_cat = [r for r in pre_ok if r["category"] == cat]
        post_cat = [r for r in post_ok if r["category"] == cat]
        
        pre_o = _avg(_extract_dim(pre_cat, "overall"))
        post_o = _avg(_extract_dim(post_cat, "overall"))
        pre_dep = _avg(_extract_dim(pre_cat, "depth"))
        post_dep = _avg(_extract_dim(post_cat, "depth"))
        pre_dom = _avg(_extract_dim(pre_cat, "domain_knowledge"))
        post_dom = _avg(_extract_dim(post_cat, "domain_knowledge"))
        change = post_o - pre_o
        
        md += f"| {cat} | {pre_o} | {post_o} | {change:+.2f} | {pre_dep} | {post_dep} | {pre_dom} | {post_dom} |\n"

    md += f"""
---

## RAG Usage Statistics

| Metric | Value |
|--------|-------|
| **Questions where RAG triggered** | {rag_triggered}/{len(post_ok)} ({rag_pct}%) |

---

## Question-by-Question Comparison

| # | Category | Question | Pre Score | Post Score | Δ | RAG Used | Key Change |
|---|----------|----------|:---------:|:----------:|:-:|:--------:|------------|
"""
    
    for r in post_results:
        if not r.get("success"):
            md += f"| {r['id']} | {r['category']} | {r['question'][:35]}… | — | FAIL | — | — | Error |\n"
            continue
        
        pre_r = pre_by_id.get(r["id"], {})
        pre_score = pre_r.get("judge", {}).get("overall", "N/A") if pre_r else "N/A"
        post_score = r["judge"].get("overall", "N/A")
        
        if isinstance(pre_score, (int, float)) and isinstance(post_score, (int, float)):
            delta = post_score - pre_score
            delta_str = f"{delta:+d}"
        else:
            delta_str = "—"
        
        rag_flag = "📚 Yes" if r.get("rag_used") else "— No"
        justification = r["judge"].get("justification", "")[:50]
        
        md += f"| {r['id']} | {r['category']} | {r['question'][:35]}… | {pre_score} | {post_score} | {delta_str} | {rag_flag} | {justification}… |\n"

    # Biggest improvements
    improvements = []
    for r in post_ok:
        pre_r = pre_by_id.get(r["id"])
        if pre_r and pre_r.get("judge", {}).get("overall") and r.get("judge", {}).get("overall"):
            delta = r["judge"]["overall"] - pre_r["judge"]["overall"]
            if delta != 0:
                improvements.append({
                    "id": r["id"],
                    "question": r["question"],
                    "category": r["category"],
                    "pre": pre_r["judge"]["overall"],
                    "post": r["judge"]["overall"],
                    "delta": delta,
                })
    
    improvements.sort(key=lambda x: x["delta"], reverse=True)
    
    if improvements:
        md += """
---

## Biggest Score Changes

### Improved Questions
"""
        improved = [i for i in improvements if i["delta"] > 0]
        declined = [i for i in improvements if i["delta"] < 0]
        
        if improved:
            for item in improved[:10]:
                md += f"- **Q{item['id']}** ({item['category']}): {item['pre']}→{item['post']} ({item['delta']:+d}) — *{item['question'][:60]}…*\n"
        else:
            md += "- No questions showed improvement.\n"
        
        if declined:
            md += "\n### Declined Questions\n"
            for item in declined:
                md += f"- **Q{item['id']}** ({item['category']}): {item['pre']}→{item['post']} ({item['delta']:+d}) — *{item['question'][:60]}…*\n"

    md += f"""
---

## Conclusion

| Metric | Pre-RAG Baseline | Post-RAG | Improvement |
|--------|:----------------:|:--------:|:-----------:|
| **Overall Score** | {pre_avgs['overall']}/5 | {post_avgs['overall']}/5 | {post_avgs['overall'] - pre_avgs['overall']:+.2f} |
| **Domain Knowledge** | {pre_avgs['domain_knowledge']}/5 | {post_avgs['domain_knowledge']}/5 | {post_avgs['domain_knowledge'] - pre_avgs['domain_knowledge']:+.2f} |
| **Depth** | {pre_avgs['depth']}/5 | {post_avgs['depth']}/5 | {post_avgs['depth'] - pre_avgs['depth']:+.2f} |
| **Specificity** | {pre_avgs['specificity']}/5 | {post_avgs['specificity']}/5 | {post_avgs['specificity'] - pre_avgs['specificity']:+.2f} |

---

*Generated by ATHENA Evaluation Framework*  
*Pre-RAG baseline: March 5, 2026 | Post-RAG test: {now}*  
*Judge: GPT-4o-mini (temperature=0, 5-dimension RAG-focused rubric)*
"""
    return md


# ─────────────────────────────────────────────────────────────────────
# Main Entry Point
# ─────────────────────────────────────────────────────────────────────
def main():
    """
    🎓 WHAT HAPPENS WHEN YOU RUN THIS:
    
    Step 1: Check if the backend is running
    Step 2: Load the same 25 test questions
    Step 3: Load the pre-RAG baseline results (for comparison)
    Step 4: Run each question through ATHENA (now with RAG)
    Step 5: For each answer, get five scores from the LLM judge
    Step 6: Save raw results as JSON
    Step 7: Generate a comparison report showing pre vs post
    """
    print("=" * 70)
    print("  ATHENA Post-RAG Evaluation — Comparison Test")
    print("  Same 25 questions, same judge, now WITH knowledge retrieval")
    print("=" * 70)

    # Step 1: Verify backend
    print("\n[1/5] Verifying backend connectivity...")
    try:
        with httpx.Client() as c:
            r = c.get(f"{BASE_URL}/api/v1/vinushan/ping", timeout=10)
            r.raise_for_status()
            print(f"  ✅ Backend reachable: {r.json()}")
            
            # Also check RAG health
            rh = c.get(f"{BASE_URL}/api/v1/vinushan/rag/health", timeout=10)
            rh.raise_for_status()
            rag_health = rh.json()
            print(f"  ✅ RAG status: {rag_health.get('status', 'unknown')} "
                  f"(docs: {rag_health.get('document_count', '?')})")
    except Exception as exc:
        print(f"  ❌ Cannot reach backend at {BASE_URL}: {exc}")
        print("  Make sure the backend is running:")
        print("    cd backend && ../.venv/bin/uvicorn app.main:app --port 8000 --reload")
        sys.exit(1)

    # Step 2: Load questions
    print("\n[2/5] Loading test questions...")
    questions = load_questions()
    cats = sorted(set(q["category"] for q in questions))
    print(f"  📝 {len(questions)} questions across {len(cats)} categories")

    # Step 3: Load pre-RAG baseline
    print("\n[3/5] Loading pre-RAG baseline...")
    pre_results = load_pre_rag_results()
    if pre_results:
        pre_ok = [r for r in pre_results if r.get("success")]
        pre_overalls = _extract_dim(pre_ok, "overall")
        print(f"  📊 Baseline loaded: {len(pre_results)} results, "
              f"avg overall = {_avg(pre_overalls)}/5")
    else:
        print("  ⚠️  No baseline found — will generate post-RAG results only")

    # Step 4: Run evaluation
    print(f"\n[4/5] Running post-RAG evaluation ({len(questions)} questions)...")
    print(f"  ⏱️  Timeout: {REQUEST_TIMEOUT}s per question")
    print(f"  📚 RAG is enabled — knowledge base will be searched\n")

    results = []
    with httpx.Client() as client:
        for q in questions:
            result = evaluate_question(q, client, len(questions))
            results.append(result)

    # Step 5: Save results
    print(f"\n[5/5] Saving results and generating comparison...")
    
    with open(POST_RAG_RESULTS, "w") as f:
        json.dump({
            "metadata": {
                "timestamp": datetime.now().isoformat(),
                "endpoint": CHAT_ENDPOINT,
                "total_questions": len(questions),
                "system_version": "post-rag",
                "evaluation_type": "rag-targeted",
                "rag_enabled": True,
            },
            "results": results,
        }, f, indent=2)
    print(f"  ✅ Raw results: {POST_RAG_RESULTS.name}")

    # Generate comparison report
    report = generate_comparison_report(results, pre_results)
    with open(COMPARISON_FILE, "w") as f:
        f.write(report)
    print(f"  ✅ Comparison report: {COMPARISON_FILE.name}")

    # Quick summary
    post_ok = [r for r in results if r.get("success")]
    print("\n" + "=" * 70)
    print("  QUICK COMPARISON")
    print("=" * 70)
    
    dims = ["overall", "relevance", "depth", "domain_knowledge", "specificity", "actionability"]
    pre_ok_map = {r["id"]: r for r in pre_results if r.get("success")} if pre_results else {}
    
    header = f"  {'Dimension':<20} {'Pre-RAG':>8} {'Post-RAG':>9} {'Change':>8}"
    print(header)
    print("  " + "─" * 48)
    
    for d in dims:
        pre_v = _avg(_extract_dim([r for r in pre_results if r.get("success")], d)) if pre_results else 0
        post_v = _avg(_extract_dim(post_ok, d))
        change = post_v - pre_v
        arrow = "↑" if change > 0 else "↓" if change < 0 else "→"
        print(f"  {d.replace('_', ' ').title():<20} {pre_v:>7.2f} {post_v:>9.2f} {change:>+7.2f} {arrow}")
    
    print("  " + "─" * 48)
    
    rag_count = sum(1 for r in post_ok if r.get("rag_used"))
    print(f"  RAG triggered: {rag_count}/{len(post_ok)} questions")
    print(f"  Success rate: {len(post_ok)}/{len(results)}")
    print("=" * 70)


if __name__ == "__main__":
    main()
