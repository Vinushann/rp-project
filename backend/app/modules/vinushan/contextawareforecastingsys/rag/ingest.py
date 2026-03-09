"""
Document Ingestion Pipeline
============================
Reads markdown documents from the knowledge base, splits them into
semantically meaningful chunks, generates embeddings via OpenAI,
and stores them in a ChromaDB collection.

Usage:
    from contextawareforecastingsys.rag.ingest import ingest_knowledge_base
    ingest_knowledge_base()  # Re-indexes all documents
"""

from __future__ import annotations

import hashlib
import os
import re
from pathlib import Path
from typing import Optional

import chromadb
from chromadb.config import Settings as ChromaSettings
from openai import OpenAI

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_MODULE_DIR = Path(__file__).resolve().parent.parent.parent  # vinushan/
KNOWLEDGE_DIR = _MODULE_DIR / "knowledge" / "domain"
CHROMA_DIR = _MODULE_DIR / "contextawareforecastingsys" / "rag" / "chroma_store"

# ---------------------------------------------------------------------------
# Embedding config
# ---------------------------------------------------------------------------
EMBEDDING_MODEL = "text-embedding-3-small"
COLLECTION_NAME = "athena_knowledge"

# Chunking config
CHUNK_SIZE = 800       # target characters per chunk
CHUNK_OVERLAP = 100    # overlap between consecutive chunks


def _get_openai_client() -> OpenAI:
    """Return an OpenAI client using the env API key."""
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------
def _split_by_headings(text: str, source: str) -> list[dict]:
    """
    Split a markdown document into chunks by heading boundaries.
    Each chunk keeps its section heading as context.
    Falls back to character-based splitting if no headings found.
    """
    # Split on markdown headings (## or ###)
    sections = re.split(r'\n(?=#{1,3}\s)', text)
    chunks: list[dict] = []

    for section in sections:
        section = section.strip()
        if not section:
            continue

        # Extract heading if present
        heading_match = re.match(r'^(#{1,3})\s+(.+)', section)
        heading = heading_match.group(2).strip() if heading_match else ""

        # If section is small enough, keep as one chunk
        if len(section) <= CHUNK_SIZE:
            chunks.append({
                "text": section,
                "heading": heading,
                "source": source,
            })
        else:
            # Split long sections into overlapping sub-chunks by paragraph
            paragraphs = section.split("\n\n")
            current = ""
            for para in paragraphs:
                if len(current) + len(para) + 2 > CHUNK_SIZE and current:
                    chunks.append({
                        "text": current.strip(),
                        "heading": heading,
                        "source": source,
                    })
                    # Overlap: keep last portion
                    overlap_start = max(0, len(current) - CHUNK_OVERLAP)
                    current = current[overlap_start:] + "\n\n" + para
                else:
                    current = current + "\n\n" + para if current else para

            if current.strip():
                chunks.append({
                    "text": current.strip(),
                    "heading": heading,
                    "source": source,
                })

    return chunks


def _chunk_document(filepath: Path) -> list[dict]:
    """Read a markdown file and return chunks with metadata."""
    text = filepath.read_text(encoding="utf-8")
    source_name = filepath.stem.replace("_", " ").title()
    return _split_by_headings(text, source=source_name)


# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------
def _embed_texts(texts: list[str], client: OpenAI) -> list[list[float]]:
    """Generate embeddings for a list of texts using OpenAI."""
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts,
    )
    return [item.embedding for item in response.data]


# ---------------------------------------------------------------------------
# Ingestion
# ---------------------------------------------------------------------------
def ingest_knowledge_base(
    knowledge_dir: Optional[Path] = None,
    chroma_dir: Optional[Path] = None,
    force: bool = False,
) -> dict:
    """
    Index all markdown documents from the knowledge directory into ChromaDB.

    Args:
        knowledge_dir: Path to folder with .md files (default: knowledge/domain/)
        chroma_dir: Path for ChromaDB storage (default: rag/chroma_store/)
        force: If True, re-index even if collection exists

    Returns:
        dict with ingestion stats
    """
    knowledge_dir = knowledge_dir or KNOWLEDGE_DIR
    chroma_dir = chroma_dir or CHROMA_DIR
    chroma_dir.mkdir(parents=True, exist_ok=True)

    # Initialize ChromaDB
    chroma_client = chromadb.PersistentClient(
        path=str(chroma_dir),
        settings=ChromaSettings(anonymized_telemetry=False),
    )

    # Check if collection exists and has data
    existing_collections = [c.name for c in chroma_client.list_collections()]
    if COLLECTION_NAME in existing_collections and not force:
        collection = chroma_client.get_collection(COLLECTION_NAME)
        if collection.count() > 0:
            return {
                "status": "skipped",
                "reason": "Collection already exists with data. Use force=True to re-index.",
                "document_count": collection.count(),
            }
        # Empty collection, delete and recreate
        chroma_client.delete_collection(COLLECTION_NAME)

    # Delete existing collection if force re-index
    if COLLECTION_NAME in existing_collections and force:
        chroma_client.delete_collection(COLLECTION_NAME)

    collection = chroma_client.create_collection(
        name=COLLECTION_NAME,
        metadata={"description": "ATHENA domain knowledge base"},
    )

    # Discover and chunk documents
    md_files = sorted(knowledge_dir.glob("*.md"))
    if not md_files:
        return {"status": "error", "reason": f"No .md files found in {knowledge_dir}"}

    all_chunks: list[dict] = []
    for filepath in md_files:
        chunks = _chunk_document(filepath)
        all_chunks.extend(chunks)

    if not all_chunks:
        return {"status": "error", "reason": "No chunks generated from documents"}

    # Generate embeddings
    openai_client = _get_openai_client()
    texts = [c["text"] for c in all_chunks]
    embeddings = _embed_texts(texts, openai_client)

    # Store in ChromaDB
    ids = []
    documents = []
    metadatas = []
    for i, chunk in enumerate(all_chunks):
        # Deterministic ID based on content hash
        chunk_id = hashlib.md5(chunk["text"].encode()).hexdigest()[:12]
        ids.append(f"chunk_{chunk_id}")
        documents.append(chunk["text"])
        metadatas.append({
            "source": chunk["source"],
            "heading": chunk["heading"],
        })

    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas,
    )

    return {
        "status": "success",
        "files_processed": len(md_files),
        "files": [f.name for f in md_files],
        "total_chunks": len(all_chunks),
        "collection_name": COLLECTION_NAME,
    }


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=Path(__file__).resolve().parents[4] / ".env")

    print("Ingesting knowledge base...")
    result = ingest_knowledge_base(force=True)
    print(f"Result: {result}")
