"""
RAG Retrieval Service (Adaptive)
=================================
Provides semantic search over the ATHENA knowledge base using ChromaDB.
Returns relevant context chunks with source citations for grounding
agent responses in domain knowledge.

🎓 ADAPTIVE RAG — What Makes This "Adaptive"?
Instead of always retrieving the same number of chunks the same way,
the service first CLASSIFIES the query, then ADAPTS its strategy:

  ┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
  │   Question   │ ──► │  Query Classifier │ ──► │ Adaptive Retrieval│
  │  from user   │     │  (factual/analyt  │     │  (top_k, expand, │
  │              │     │   /strategic/sys) │     │   filter, merge) │
  └──────────────┘     └──────────────────┘     └──────────────────┘

  - Factual queries  → 3 focused chunks, high relevance threshold
  - Analytical       → 5 balanced chunks, moderate threshold
  - Strategic/complex→ 7+ chunks, query expansion for broader coverage
  - System queries   → target ATHENA system docs specifically
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Optional

import chromadb
from chromadb.config import Settings as ChromaSettings
from openai import OpenAI

from .ingest import CHROMA_DIR, COLLECTION_NAME, EMBEDDING_MODEL, ingest_knowledge_base

logger = logging.getLogger(__name__)

# ── Adaptive RAG Configuration ──────────────────────────────────────
# 🎓 These settings control HOW the adaptive retrieval behaves.
# Think of them as "knobs" we can tune.

QUERY_PROFILES = {
    # query_type → (top_k, relevance_threshold, expand_query)
    "factual":   {"top_k": 3, "min_relevance": 0.35, "expand": False},
    "analytical": {"top_k": 5, "min_relevance": 0.25, "expand": False},
    "strategic":  {"top_k": 7, "min_relevance": 0.20, "expand": True},
    "system":     {"top_k": 5, "min_relevance": 0.25, "expand": False},
}

DEFAULT_PROFILE = QUERY_PROFILES["analytical"]


class RAGService:
    """
    Retrieval-Augmented Generation service.
    
    Retrieves relevant domain knowledge chunks from the vector store
    and formats them with source citations for injection into agent prompts.
    """

    def __init__(self, auto_ingest: bool = True):
        """
        Initialize the RAG service.
        
        Args:
            auto_ingest: If True, automatically ingest knowledge base
                         if the vector store is empty or missing.
        """
        self._openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self._chroma_client: Optional[chromadb.ClientAPI] = None
        self._collection = None
        self._auto_ingest = auto_ingest

    # ------------------------------------------------------------------
    # Lazy initialization
    # ------------------------------------------------------------------
    def _ensure_ready(self) -> None:
        """Ensure ChromaDB client and collection are initialized."""
        if self._collection is not None:
            return

        chroma_dir = CHROMA_DIR
        chroma_dir.mkdir(parents=True, exist_ok=True)

        self._chroma_client = chromadb.PersistentClient(
            path=str(chroma_dir),
            settings=ChromaSettings(anonymized_telemetry=False),
        )

        existing = [c.name for c in self._chroma_client.list_collections()]

        if COLLECTION_NAME not in existing or self._should_reingest():
            if self._auto_ingest:
                ingest_knowledge_base(force=True)
                # Re-connect after ingestion
                self._chroma_client = chromadb.PersistentClient(
                    path=str(chroma_dir),
                    settings=ChromaSettings(anonymized_telemetry=False),
                )

        self._collection = self._chroma_client.get_collection(COLLECTION_NAME)

    def _should_reingest(self) -> bool:
        """Check if collection exists but is empty."""
        try:
            col = self._chroma_client.get_collection(COLLECTION_NAME)
            return col.count() == 0
        except Exception:
            return True

    # ------------------------------------------------------------------
    # Core retrieval
    # ------------------------------------------------------------------
    def retrieve(self, query: str, top_k: int = 5) -> list[dict]:
        """
        Retrieve the most relevant knowledge chunks for a query.

        Args:
            query: The user's question or search query.
            top_k: Number of chunks to return.

        Returns:
            List of dicts, each containing:
                - text: The chunk content
                - source: Document source name
                - heading: Section heading
                - relevance_score: Similarity score (lower = more similar for L2)
        """
        self._ensure_ready()

        # Embed the query
        response = self._openai.embeddings.create(
            model=EMBEDDING_MODEL,
            input=[query],
        )
        query_embedding = response.data[0].embedding

        # Query ChromaDB
        results = self._collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )

        chunks = []
        if results and results["documents"]:
            for i, doc in enumerate(results["documents"][0]):
                metadata = results["metadatas"][0][i] if results["metadatas"] else {}
                distance = results["distances"][0][i] if results["distances"] else 0
                chunks.append({
                    "text": doc,
                    "source": metadata.get("source", "Unknown"),
                    "heading": metadata.get("heading", ""),
                    "relevance_score": round(1 - distance, 4),  # Convert distance to similarity
                })

        return chunks

    # ------------------------------------------------------------------
    # Formatted context for agent injection
    # ------------------------------------------------------------------
    def get_context_for_query(self, query: str, top_k: int = 5) -> str:
        """
        Retrieve relevant knowledge and format it as context text
        that can be injected into an agent's prompt.

        Returns a formatted string with source citations.
        """
        chunks = self.retrieve(query, top_k=top_k)

        if not chunks:
            return ""

        lines = ["--- DOMAIN KNOWLEDGE (retrieved from knowledge base) ---"]
        sources_seen = set()

        for i, chunk in enumerate(chunks, 1):
            source = chunk["source"]
            heading = chunk["heading"]
            citation = f"[{source}"
            if heading:
                citation += f" > {heading}"
            citation += "]"
            sources_seen.add(source)

            lines.append(f"\n[{i}] {citation}")
            lines.append(chunk["text"])

        lines.append("\n--- END DOMAIN KNOWLEDGE ---")
        lines.append(f"Sources: {', '.join(sorted(sources_seen))}")

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Structured citations
    # ------------------------------------------------------------------
    def get_citations(self, query: str, top_k: int = 5) -> dict:
        """
        Return retrieved context plus structured citation metadata.

        Returns:
            dict with:
                - context: Formatted context string for agent prompt
                - citations: List of {source, heading, relevance_score}
                - source_documents: List of unique source document names
        """
        chunks = self.retrieve(query, top_k=top_k)

        if not chunks:
            return {"context": "", "citations": [], "source_documents": []}

        context = self.get_context_for_query(query, top_k=top_k)

        citations = [
            {
                "source": c["source"],
                "heading": c["heading"],
                "relevance_score": c["relevance_score"],
            }
            for c in chunks
        ]

        source_documents = sorted(set(c["source"] for c in chunks))

        return {
            "context": context,
            "citations": citations,
            "source_documents": source_documents,
        }

    # ------------------------------------------------------------------
    # 🎓 ADAPTIVE RAG — The Smart Retrieval Methods
    # ------------------------------------------------------------------
    # These are the new methods that make RAG "adaptive".
    # Instead of a fixed top_k=5, we:
    #   1. Classify the query type
    #   2. Choose retrieval parameters based on type
    #   3. Optionally expand the query for multi-topic coverage
    #   4. Filter out low-relevance chunks
    #   5. Deduplicate across multiple searches
    # ------------------------------------------------------------------

    def classify_query(self, query: str) -> dict:
        """
        🎓 STEP 1 of Adaptive RAG: Classify the query.

        Uses a fast LLM call to categorize the question into one of:
          - "factual"    → simple fact lookup (e.g., "What's our discount?")
          - "analytical" → needs data + knowledge (e.g., "Why did sales drop?")
          - "strategic"  → complex planning (e.g., "Prepare plan for December")
          - "system"     → about ATHENA itself (e.g., "How does forecasting work?")

        Also extracts key topics for potential query expansion.

        Returns:
            dict with query_type, topics, reasoning
        """
        try:
            response = self._openai.chat.completions.create(
                model=os.getenv("MODEL", "gpt-4o-mini"),
                temperature=0,
                max_tokens=200,
                messages=[
                    {"role": "system", "content": (
                        "You classify queries for a coffee shop AI assistant's knowledge retrieval system.\n"
                        "Categorize the query and extract key search topics.\n\n"
                        "Categories:\n"
                        "- factual: Simple fact lookup (policies, definitions, single-topic)\n"
                        "- analytical: Needs data analysis + domain knowledge (trends, causes)\n"
                        "- strategic: Complex planning requiring broad knowledge (multi-topic plans)\n"
                        "- system: Questions about how the ATHENA system works\n\n"
                        "Respond with JSON only:\n"
                        '{"query_type": "factual|analytical|strategic|system", '
                        '"topics": ["topic1", "topic2"], '
                        '"reasoning": "one sentence"}'
                    )},
                    {"role": "user", "content": query},
                ],
            )
            content = response.choices[0].message.content.strip()
            # Handle markdown code blocks
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()
            result = json.loads(content)
            # Validate query_type
            if result.get("query_type") not in QUERY_PROFILES:
                result["query_type"] = "analytical"
            return result
        except Exception as exc:
            logger.warning(f"Query classification failed: {exc}")
            return {"query_type": "analytical", "topics": [], "reasoning": "fallback"}

    def _expand_and_retrieve(self, query: str, topics: list[str], top_k: int) -> list[dict]:
        """
        🎓 STEP 2b: Query Expansion — search multiple angles.

        For strategic (complex) queries, we don't just search the original question.
        We ALSO search for each extracted topic separately, then merge all results.

        Example:
          Query: "How should I prepare for the December holiday season?"
          Topics: ["holiday sales preparation", "December demand forecast",
                   "seasonal staffing strategy"]

        We search ALL of these and combine the best chunks.

        This gives the agents a BROADER knowledge base to work with.
        """
        all_chunks = {}  # key = (source, heading) to deduplicate

        # Search with the original query
        for chunk in self.retrieve(query, top_k=top_k):
            key = (chunk["source"], chunk["heading"], chunk["text"][:80])
            if key not in all_chunks or chunk["relevance_score"] > all_chunks[key]["relevance_score"]:
                all_chunks[key] = chunk

        # Search with each expanded topic
        per_topic_k = max(2, top_k // len(topics)) if topics else 0
        for topic in topics[:3]:  # Limit to 3 expansions to control cost
            for chunk in self.retrieve(topic, top_k=per_topic_k):
                key = (chunk["source"], chunk["heading"], chunk["text"][:80])
                if key not in all_chunks or chunk["relevance_score"] > all_chunks[key]["relevance_score"]:
                    all_chunks[key] = chunk

        # Sort by relevance and return
        merged = sorted(all_chunks.values(), key=lambda c: c["relevance_score"], reverse=True)
        return merged

    def _filter_by_relevance(self, chunks: list[dict], min_relevance: float) -> list[dict]:
        """
        🎓 STEP 3: Relevance Filtering — drop low-quality chunks.

        Not every retrieved chunk is actually useful. If a chunk has a
        low relevance score, it's probably not related to the question.
        Including it would just confuse the agents.

        Think of it like throwing away search results from page 10 of Google —
        they're technically "results" but not helpful.
        """
        return [c for c in chunks if c["relevance_score"] >= min_relevance]

    def adaptive_retrieve(self, query: str) -> dict:
        """
        🎓 THE MAIN ADAPTIVE RAG METHOD.

        This is the "smart" version of get_citations(). Instead of always
        retrieving 5 chunks, it:

        1. Classifies the query → determines type (factual/analytical/strategic/system)
        2. Selects a retrieval profile → decides top_k and relevance threshold
        3. Optionally expands the query → searches multiple angles for complex queries
        4. Filters by relevance → drops low-quality chunks
        5. Formats everything → returns context, citations, and metadata

        Returns:
            dict with:
                - context: Formatted context string for agent prompt
                - citations: List of citation metadata
                - source_documents: Unique source names
                - adaptive_metadata: Info about what the adaptive system decided
        """
        # Step 1: Classify
        classification = self.classify_query(query)
        query_type = classification.get("query_type", "analytical")
        topics = classification.get("topics", [])
        profile = QUERY_PROFILES.get(query_type, DEFAULT_PROFILE)

        logger.info(
            f"Adaptive RAG: type={query_type}, top_k={profile['top_k']}, "
            f"expand={profile['expand']}, topics={topics}"
        )

        # Step 2: Retrieve (with or without expansion)
        if profile["expand"] and topics:
            raw_chunks = self._expand_and_retrieve(query, topics, profile["top_k"])
        else:
            raw_chunks = self.retrieve(query, top_k=profile["top_k"])

        # Step 3: Filter by relevance
        filtered_chunks = self._filter_by_relevance(raw_chunks, profile["min_relevance"])

        # Step 4: Format
        if not filtered_chunks:
            return {
                "context": "",
                "citations": [],
                "source_documents": [],
                "adaptive_metadata": {
                    "query_type": query_type,
                    "classification_reasoning": classification.get("reasoning", ""),
                    "topics": topics,
                    "profile": profile,
                    "chunks_retrieved": 0,
                    "chunks_after_filter": 0,
                },
            }

        # Build context string (same format as get_context_for_query)
        lines = ["--- DOMAIN KNOWLEDGE (retrieved from knowledge base) ---"]
        sources_seen = set()
        for i, chunk in enumerate(filtered_chunks, 1):
            source = chunk["source"]
            heading = chunk["heading"]
            citation = f"[{source}"
            if heading:
                citation += f" > {heading}"
            citation += "]"
            sources_seen.add(source)
            lines.append(f"\n[{i}] {citation}")
            lines.append(chunk["text"])
        lines.append("\n--- END DOMAIN KNOWLEDGE ---")
        lines.append(f"Sources: {', '.join(sorted(sources_seen))}")
        context = "\n".join(lines)

        citations = [
            {"source": c["source"], "heading": c["heading"], "relevance_score": c["relevance_score"]}
            for c in filtered_chunks
        ]
        source_documents = sorted(sources_seen)

        return {
            "context": context,
            "citations": citations,
            "source_documents": source_documents,
            "adaptive_metadata": {
                "query_type": query_type,
                "classification_reasoning": classification.get("reasoning", ""),
                "topics": topics,
                "profile": profile,
                "chunks_retrieved": len(raw_chunks),
                "chunks_after_filter": len(filtered_chunks),
            },
        }

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------
    def health_check(self) -> dict:
        """Return RAG system status."""
        try:
            self._ensure_ready()
            count = self._collection.count() if self._collection else 0
            return {
                "status": "healthy",
                "collection": COLLECTION_NAME,
                "document_count": count,
                "embedding_model": EMBEDDING_MODEL,
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
            }
