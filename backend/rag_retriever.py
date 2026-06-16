import re
import math
from pathlib import Path
from typing import List, Dict, Tuple, Set

# Common stop words to exclude from TF-IDF indexing
STOP_WORDS: Set[str] = {
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'in', 'on', 'at', 'to', 'for', 'of', 'by', 'with', 'about', 'against', 'between', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'from', 'up', 'down', 'in', 'out',
    'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
    'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
    'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will',
    'just', 'don', 'should', 'now', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
    'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she',
    'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves'
}

class RAGChunk:
    def __init__(self, source: str, heading: str, content: str):
        self.source = source          # e.g., "README.md" or "DOCUMENTATION.md"
        self.heading = heading        # Heading name for context
        self.content = content        # The chunk text content
        self.full_text = f"Source: {source} > {heading}\n{content}"
        self.tokens: List[str] = []
        self.tf: Dict[str, float] = {}

def tokenize(text: str) -> List[str]:
    # Lowercase and replace non-alphanumeric with spaces
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    tokens = text.split()
    # Remove stopwords and short tokens
    return [t for t in tokens if t not in STOP_WORDS and len(t) > 1]

class RAGRetriever:
    def __init__(self):
        self.chunks: List[RAGChunk] = []
        self.idf: Dict[str, float] = {}
        self.load_and_index_docs()

    def load_and_index_docs(self):
        """Loads README.md and DOCUMENTATION.md from project root and indexes them."""
        # Backend directory is at FreshScanAi/backend
        # Project root is at FreshScanAi/
        backend_dir = Path(__file__).parent
        project_root = backend_dir.parent

        files_to_load = [
            ("README.md", project_root / "README.md"),
            ("DOCUMENTATION.md", project_root / "DOCUMENTATION.md")
        ]

        raw_chunks: List[Tuple[str, str, str]] = [] # (source, heading, content)

        for name, path in files_to_load:
            if not path.exists():
                print(f"RAG WARNING: {name} not found at {path.absolute()}")
                continue

            try:
                content = path.read_text(encoding='utf-8')
                file_chunks = self.split_by_markdown_headers(name, content)
                raw_chunks.extend(file_chunks)
            except Exception as e:
                print(f"RAG ERROR reading {name}: {e}")

        # If no chunks were loaded, create a default fallback chunk so we don't crash
        if not raw_chunks:
            raw_chunks.append((
                "System", "System Info",
                "FreshScanAI provides edge and server fish freshness scanning using PyTorch. "
                "It has a scanner, a live market map, scan history, and support for 47+ species."
            ))

        # Build chunks and TF-IDF
        self.chunks = []
        doc_frequency: Dict[str, int] = {}

        for src, heading, text in raw_chunks:
            chunk = RAGChunk(src, heading, text)
            chunk.tokens = tokenize(chunk.full_text)

            # Term Frequency (TF)
            if chunk.tokens:
                word_counts = {}
                for token in chunk.tokens:
                    word_counts[token] = word_counts.get(token, 0) + 1

                num_tokens = len(chunk.tokens)
                for word, count in word_counts.items():
                    chunk.tf[word] = count / num_tokens

                # Track Document Frequency (DF)
                for word in word_counts.keys():
                    doc_frequency[word] = doc_frequency.get(word, 0) + 1

            self.chunks.append(chunk)

        # Compute Inverse Document Frequency (IDF)
        num_docs = len(self.chunks)
        for word, df in doc_frequency.items():
            # Standard smooth IDF formula
            self.idf[word] = math.log(1.0 + (num_docs / (1.0 + df)))

        print(
            f"RAG Indexing complete. Indexed {len(self.chunks)} chunks "
            f"across {len(files_to_load)} files."
        )

    def split_by_markdown_headers(
        self, source: str, content: str
    ) -> List[Tuple[str, str, str]]:
        """Parses markdown and splits it into chunks based on header sections."""
        chunks: List[Tuple[str, str, str]] = []
        lines = content.splitlines()

        current_heading = "Introduction"
        current_lines: List[str] = []

        # Heading regex for #, ##, ###, ####
        heading_re = re.compile(r'^(#{1,4})\s+(.+)$')

        for line in lines:
            match = heading_re.match(line)
            if match:
                # Flush the previous chunk if it has content
                if current_lines:
                    text_block = "\n".join(current_lines).strip()
                    if len(text_block) > 40: # Ignore tiny trivial chunks
                        chunks.extend(self.split_large_text(source, current_heading, text_block))

                current_heading = match.group(2).strip()
                current_lines = [line]
            else:
                current_lines.append(line)

        # Flush the last section
        if current_lines:
            text_block = "\n".join(current_lines).strip()
            if len(text_block) > 40:
                chunks.extend(self.split_large_text(source, current_heading, text_block))

        return chunks

    def split_large_text(
        self, source: str, heading: str, text: str, max_chars: int = 1500
    ) -> List[Tuple[str, str, str]]:
        """Sub-splits a markdown section if it is too long to maintain granularity."""
        if len(text) <= max_chars:
            return [(source, heading, text)]

        # Split by paragraph
        paragraphs = text.split('\n\n')
        sub_chunks: List[Tuple[str, str, str]] = []

        current_chunk_lines: List[str] = []
        current_len = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # If a single paragraph is extremely large, just force split by length
            if len(para) > max_chars:
                # Flush existing chunk
                if current_chunk_lines:
                    sub_chunks.append((source, heading, "\n\n".join(current_chunk_lines)))
                    current_chunk_lines = []
                    current_len = 0

                # Split large paragraph by sentences or fixed size
                sentences = re.split(r'(?<=[.!?])\s+', para)
                for sentence in sentences:
                    if current_len + len(sentence) > max_chars:
                        if current_chunk_lines:
                            sub_chunks.append((source, heading, " ".join(current_chunk_lines)))
                            current_chunk_lines = []
                            current_len = 0
                    current_chunk_lines.append(sentence)
                    current_len += len(sentence)
            else:
                if current_len + len(para) > max_chars:
                    if current_chunk_lines:
                        sub_chunks.append((source, heading, "\n\n".join(current_chunk_lines)))
                        current_chunk_lines = []
                        current_len = 0
                current_chunk_lines.append(para)
                current_len += len(para)

        # Flush remaining
        if current_chunk_lines:
            sub_chunks.append((source, heading, "\n\n".join(current_chunk_lines)))

        return sub_chunks

    def retrieve_relevant_context(self, query: str, limit: int = 3) -> str:
        """Retrieves and formats the top K matching chunks as a single context block."""
        query_tokens = tokenize(query)
        if not query_tokens:
            return ""

        # Compute query TF-IDF representation
        # (For simple cosine matching, TF is query_term_count / query_len)
        query_tf: Dict[str, float] = {}
        for token in query_tokens:
            query_tf[token] = query_tf.get(token, 0) + 1 / len(query_tokens)

        scored_chunks: List[Tuple[RAGChunk, float]] = []

        for chunk in self.chunks:
            score = 0.0
            # Cosine similarity dot product
            for word, q_tf in query_tf.items():
                if word in chunk.tf:
                    # Score contribution = (Query TF * IDF) * (Chunk TF * IDF)
                    w_idf = self.idf.get(word, 0.0)
                    score += (q_tf * w_idf) * (chunk.tf[word] * w_idf)

            if score > 0:
                scored_chunks.append((chunk, score))

        # Sort by score descending
        scored_chunks.sort(key=lambda x: x[1], reverse=True)
        top_chunks = scored_chunks[:limit]

        if not top_chunks:
            # Fallback to simple sub-string search on the query words if TF-IDF yields nothing
            overlap_chunks = []
            for chunk in self.chunks:
                matches = sum(1 for token in query_tokens if token in chunk.full_text.lower())
                if matches > 0:
                    overlap_chunks.append((chunk, matches))
            overlap_chunks.sort(key=lambda x: x[1], reverse=True)
            top_chunks = overlap_chunks[:limit]

        if not top_chunks:
            return ""

        # Format retrieved chunks
        formatted_blocks = []
        for rank, (chunk, score) in enumerate(top_chunks, 1):
            formatted_blocks.append(
                f"[Document {rank}]\n"
                f"{chunk.full_text.strip()}"
            )

        return "\n\n---\n\n".join(formatted_blocks)

# Singleton retriever instance loaded at application startup
_retriever = None

def get_retriever() -> RAGRetriever:
    global _retriever
    if _retriever is None:
        _retriever = RAGRetriever()
    return _retriever
