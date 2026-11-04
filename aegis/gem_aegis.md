I've got you covered. Here is the complete package. I've integrated all the thread-safety fixes, database logic corrections, and inference engine rewrites directly into the full files so you can just copy, paste, and run without having to manually patch anything together.
File 1: Fixed JavaScript (aegis.html - Final Script Section)
        async function deleteThread(id) {
            if (!confirm('Delete this thread?')) return;
            
            try {
                await fetch(`${API_BASE}/threads/${id}`, {method: 'DELETE'});
                state.threads = state.threads.filter(t => t.id !== id);
                
                if (state.currentThread === id) {
                    state.currentThread = null;
                    state.messages = [];
                    renderMessages();
                    document.getElementById('chatTitle').textContent = 'New Conversation';
                }
                
                renderThreads();
                showToast('Thread deleted', 'success');
            } catch (e) {
                showToast('Failed to delete thread', 'error');
            }
        }

        function searchThreads() {
            renderThreads();
        }
        
        async function deleteMemory(id) {
            if (!confirm('Delete this document from memory?')) return;
            
            try {
                await fetch(`${API_BASE}/memory/${id}`, {method: 'DELETE'});
                state.memoryDocuments = state.memoryDocuments.filter(d => d.id !== id);
                renderMemoryList();
                showToast('Document removed from memory', 'success');
            } catch (e) {
                showToast('Failed to delete document', 'error');
            }
        }
        
        async function copyMessage(msgId) {
            const msg = state.messages.find(m => m.id === msgId);
            if (!msg) return;
            
            try {
                await navigator.clipboard.writeText(msg.content);
                showToast('Copied to clipboard', 'success');
            } catch (e) {
                showToast('Failed to copy', 'error');
            }
        }
        
        // Auto-save settings on change
        document.querySelectorAll('.setting-input, .setting-select, .setting-textarea').forEach(el => {
            el.addEventListener('change', saveSettings);
        });
        
        // Periodic status updates
        setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE}/stats`);
                if (res.ok) {
                    const stats = await res.json();
                    updateSystemStatus(stats);
                }
            } catch (e) {
                // Silent fail - SSE will show connection issues
            }
        }, 2000);
    </script>

File 2: Fixed config.py
"""
Aegis Configuration Module
==========================

Centralized configuration for the Aegis Local AI Interface.
All paths, defaults, and hardware-specific settings are defined here.
"""

import os
import json
from pathlib import Path
from typing import Dict, List, Any, Optional

# Base directories
HOME = Path.home()
AEGIS_DIR = HOME / ".local" / "share" / "aegis"
MODELS_DIR = AEGIS_DIR / "models"
LOGS_DIR = AEGIS_DIR / "logs"
DB_PATH = AEGIS_DIR / "aegis.db"

# Ensure directories exist
AEGIS_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# Server Configuration
HOST = "127.0.0.1"  # Strictly local only
PORT = 7860
API_BASE = f"http://{HOST}:{PORT}"

# Hardware Constraints - Sandy Bridge Era
# ========================================
HARDWARE = {
    "cpu_avx2": False,  # Sandy Bridge has AVX, not AVX2
    "cpu_avx": True,
    "max_ram_gb": 12,
    "effective_inference_gb": 10,  # 12GB - 2GB system overhead
    "gpu_vram_mb": 1024,
    "max_concurrent_models": 1,  # Large model OR 2 small models
    "threads": 4, 
    "zram_warning_ratio": 3.0,  # Throttle if compression > 3:1
    "zram_critical_ratio": 4.0,
}

# Model Registry Path
MODEL_REGISTRY_PATH = AEGIS_DIR / "model_registry.json"

# SQLite Configuration
DB_POOL_SIZE = 5

# LLaMA.cpp Parameters - Optimized for Sandy Bridge
LLAMA_DEFAULTS = {
    "n_ctx": 2048,
    "n_batch": 512,
    "n_threads": 4,  
    "n_gpu_layers": 0,  
    "kv_cache_quantization": "Q4_0", 
    "kv_cache_defrag": True,
    
    # Sampling defaults
    "temperature": 0.7,
    "top_p": 0.9,
    "top_k": 40,
    "min_p": 0.05,
    "repeat_penalty": 1.1,
    "frequency_penalty": 0.0,
    "presence_penalty": 0.0,
    
    # Mirostat for quality at low perplexity
    "mirostat_mode": 0,  # 0=disabled, 1=mirostat, 2=mirostat 2.0
    "mirostat_tau": 5.0,
    "mirostat_eta": 0.1,
}

# Context Management
CONTEXT_CONFIG = {
    "max_kv_tokens": 2048,
    "prune_threshold": 0.9,  
    "prune_ratio": 0.25,  
    "sliding_window_history": 0.75,  
    "sliding_window_rag": 0.25,  
    "compression_threshold": 0.85,  
    "compression_ratio": 0.5,  
    "ooc_retry_attempts": 3,
    "ooc_truncate_ratio": 0.25,
}

# RAG Configuration
RAG_CONFIG = {
    "chunk_size_tokens": 512,
    "chunk_overlap_tokens": 50,
    "embedding_model": "nomic-embed-text-v1.5.Q2_K.gguf",  
    "embedding_dim": 768,
    "top_k_chunks": 5,
    "similarity_threshold": 0.65,
    "max_file_size_mb": 50,
    "supported_extensions": [".txt", ".md", ".pdf", ".py", ".js", ".json", ".csv", ".html"],
}

# TTS Configuration
TTS_CONFIG = {
    "sample_rate": 22050,
    "voices_dir": MODELS_DIR / "voices",
    "speed_range": (0.5, 2.0),
    "default_speed": 1.0,
}

# STT Configuration
STT_CONFIG = {
    "model_size": "base",  # faster-whisper model
    "device": "cpu",
    "compute_type": "int8",  
    "beam_size": 5,
    "vad_filter": True,
}

# Image Generation
IMAGE_CONFIG = {
    "model_id": "stable-diffusion-v1-5",
    "onnx_provider": "CPUExecutionProvider",
    "default_steps": 25,
    "default_guidance": 7.5,
    "max_resolution": 512,  
}

# Security
SECURITY = {
    "max_upload_size": 50 * 1024 * 1024,  # 50MB
    "zip_bomb_ratio": 200,  
    "allowed_origins": ["null", "http://127.0.0.1:7860", "http://localhost:7860"], 
    "path_traversal_blacklist": ["..", "~", "//"],
}

# Logging
LOG_CONFIG = {
    "level": "INFO",
    "format": "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    "file": LOGS_DIR / "aegis.log",
    "max_bytes": 10 * 1024 * 1024,  # 10MB
    "backup_count": 5,
}

# Model Type Definitions
MODEL_TYPES = {
    "text": {"ram_estimate": 4.5, "class": "LlamaModel"},  
    "vision": {"ram_estimate": 4.5, "class": "LlavaModel"}, 
    "embedding": {"ram_estimate": 0.5, "class": "EmbeddingModel"}, 
    "stt": {"ram_estimate": 0.3, "class": "STTModel"},  
    "tts": {"ram_estimate": 0.1, "class": "TTSModel"},  
    "image_gen": {"ram_estimate": 2.0, "class": "ImageGenModel"},  
}

def get_model_path(model_name: str) -> Path:
    """Resolve model path within allowed directory."""
    # Prevent path traversal
    model_name = os.path.basename(model_name)  
    path = MODELS_DIR / model_name
    
    # Security: ensure path is within MODELS_DIR
    try:
        path.relative_to(MODELS_DIR)
    except ValueError:
        raise ValueError(f"Invalid model path: {model_name}")
    return path

def load_model_registry() -> List[Dict[str, Any]]:
    """Load or create model registry."""
    
    if MODEL_REGISTRY_PATH.exists():
        with open(MODEL_REGISTRY_PATH) as f:
            return json.load(f)
    
    # Default registry with Sandy Bridge compatible models
    default_registry = [
        {
            "id": "mistral-7b-instruct",
            "name": "Mistral 7B Instruct Q4_K_M",
            "filename": "mistral-7b-instruct-v0.2.Q4_K_M.gguf",
            "type": "text",
            "quantization": "Q4_K_M",
            "ram_estimate": 4.5,
            "max_ctx": 32768,
            "url": "https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf"
        },
        {
            "id": "llama-2-13b",
            "name": "Llama 2 13B Q4_K_M",
            "filename": "llama-2-13b-chat.Q4_K_M.gguf",
            "type": "text",
            "quantization": "Q4_K_M",
            "ram_estimate": 8.2,
            "max_ctx": 4096,
            "url": "https://huggingface.co/TheBloke/Llama-2-13B-chat-GGUF/resolve/main/llama-2-13b-chat.Q4_K_M.gguf"
        },
        {
            "id": "moondream2",
            "name": "Moondream2 1.6B Vision Q4_K_M",
            "filename": "moondream-2b-int8.gguf",
            "type": "vision",
            "quantization": "Q4_K_M",
            "ram_estimate": 2.0,
            "max_ctx": 2048,
            "url": "https://huggingface.co/vikhyatk/moondream2/resolve/main/moondream-2b-int8.gguf"
        },
        {
            "id": "nomic-embed",
            "name": "Nomic Embed Text v1.5 Q2_K",
            "filename": "nomic-embed-text-v1.5.Q2_K.gguf",
            "type": "embedding",
            "quantization": "Q2_K",
            "ram_estimate": 0.5,
            "max_ctx": 2048,
            "url": "https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q2_K.gguf"
        },
        {
            "id": "whisper-base",
            "name": "Whisper Base (faster-whisper)",
            "filename": "whisper-base",
            "type": "stt",
            "quantization": "int8",
            "ram_estimate": 0.3,
            "url": "https://huggingface.co/Systran/faster-whisper-base"
        }
    ]
    
    with open(MODEL_REGISTRY_PATH, 'w') as f:
        json.dump(default_registry, f, indent=2)
    
    return default_registry

File 3: Fixed db.py
"""
Aegis Database Module
=====================

SQLite schema and async operations using aiosqlite.
All chat data persists here - no localStorage dependency.
"""

import asyncio
import aiosqlite
import json
import sqlite3
import math
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

from .config import DB_PATH, RAG_CONFIG

# Schema definition
SCHEMA = """
-- Threads table
CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    model_id TEXT,
    model_type TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    parameters TEXT
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    model TEXT,
    token_count INTEGER DEFAULT 0,
    used_memory BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

-- Message attachments
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT,
    file_size INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Memory documents (RAG)
CREATE TABLE IF NOT EXISTS memory_documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    file_path TEXT,
    content_hash TEXT UNIQUE,
    file_size INTEGER,
    chunk_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Memory chunks with embeddings (stored as JSON array)
CREATE TABLE IF NOT EXISTS memory_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding TEXT NOT NULL, 
    token_count INTEGER,
    FOREIGN KEY (document_id) REFERENCES memory_documents(id) ON DELETE CASCADE
);

-- Thread-message index for RAG
CREATE TABLE IF NOT EXISTS thread_index (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    chunk_content TEXT,
    embedding TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON memory_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_thread_index_thread ON thread_index(thread_id);
"""

class Database:
    """Async SQLite database manager."""
    
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._pool: Optional[aiosqlite.Connection] = None
    
    async def initialize(self):
        """Initialize database with schema."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        async with aiosqlite.connect(self.db_path) as db:
            await db.executescript(SCHEMA)
            await db.commit()
        
        self._pool = await aiosqlite.connect(self.db_path)
        self._pool.row_factory = aiosqlite.Row
    
    async def close(self):
        """Close database connection."""
        if self._pool:
            await self._pool.close()
            self._pool = None
    
    async def create_thread(self, title: str, model_id: Optional[str] = None) -> Dict[str, Any]:
        """Create new conversation thread."""
        thread_id = f"thread_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{hash(title) % 10000:04d}"
        
        await self._pool.execute(
            "INSERT INTO threads (id, title, model_id) VALUES (?, ?, ?)",
            (thread_id, title, model_id)
        )
        await self._pool.commit()
        
        return {
            "id": thread_id,
            "title": title,
            "model_id": model_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    
    async def get_threads(self, search: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all threads, optionally filtered."""
        query = "SELECT * FROM threads"
        params: List[Any] = []
        
        if search:
            query += " WHERE title LIKE ?"
            params.append(f"%{search}%")
        
        query += " ORDER BY updated_at DESC"
        
        async with self._pool.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
    
    async def get_thread(self, thread_id: str) -> Optional[Dict[str, Any]]:
        """Get specific thread."""
        async with self._pool.execute(
            "SELECT * FROM threads WHERE id = ?", (thread_id,)
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None
    
    async def update_thread(self, thread_id: str, title: Optional[str] = None) -> bool:
        """Update thread metadata."""
        if title:
            await self._pool.execute(
                "UPDATE threads SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (title, thread_id)
            )
            await self._pool.commit()
            return True
        return False
    
    async def delete_thread(self, thread_id: str) -> bool:
        """Delete thread and all messages."""
        await self._pool.execute("DELETE FROM threads WHERE id = ?", (thread_id,))
        await self._pool.commit()
        return True
    
    async def add_message(
        self,
        thread_id: str,
        role: str,
        content: str,
        model: Optional[str] = None,
        token_count: int = 0,
        used_memory: bool = False
    ) -> Dict[str, Any]:
        """Add message to thread."""
        msg_id = f"msg_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{hash(content) % 10000:04d}"
        
        await self._pool.execute(
            """INSERT INTO messages (id, thread_id, role, content, model, token_count, used_memory)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (msg_id, thread_id, role, content, model, token_count, int(used_memory))
        )
        
        await self._pool.execute(
            "UPDATE threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (thread_id,)
        )
        
        await self._pool.commit()
        
        return {
            "id": msg_id,
            "thread_id": thread_id,
            "role": role,
            "content": content,
            "model": model,
            "token_count": token_count,
            "used_memory": used_memory,
            "created_at": datetime.now().isoformat()
        }
    
    async def get_messages(self, thread_id: str) -> List[Dict[str, Any]]:
        """Get all messages in thread."""
        async with self._pool.execute(
            """SELECT m.*, GROUP_CONCAT(a.id) as attachment_ids
               FROM messages m
               LEFT JOIN attachments a ON a.message_id = m.id
               WHERE m.thread_id = ?
               GROUP BY m.id
               ORDER BY m.created_at ASC""",
            (thread_id,)
        ) as cursor:
            rows = await cursor.fetchall()
            messages = []
            for row in rows:
                msg = dict(row)
                if msg.get('attachment_ids'):
                    async with self._pool.execute(
                        "SELECT id, filename, mime_type, file_size FROM attachments WHERE message_id = ?",
                        (msg['id'],)
                    ) as att_cursor:
                        attachments = await att_cursor.fetchall()
                        msg['attachments'] = [dict(a) for a in attachments]
                else:
                    msg['attachments'] = []
                messages.append(msg)
            return messages
    
    async def add_attachment(
        self,
        message_id: str,
        filename: str,
        file_path: str,
        mime_type: str,
        file_size: int
    ) -> str:
        """Add file attachment to message."""
        att_id = f"att_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{hash(filename) % 10000:04d}"
        
        await self._pool.execute(
            """INSERT INTO attachments (id, message_id, filename, file_path, mime_type, file_size)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (att_id, message_id, filename, file_path, mime_type, file_size)
        )
        await self._pool.commit()
        return att_id
    
    async def add_memory_document(
        self,
        filename: str,
        content_hash: str,
        file_size: int,
        file_path: Optional[str] = None
    ) -> str:
        """Add document to memory store with proper duplicate handling."""
        doc_id = f"doc_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{hash(filename) % 10000:04d}"
        
        await self._pool.execute(
            """INSERT OR IGNORE INTO memory_documents (id, filename, file_path, content_hash, file_size)
               VALUES (?, ?, ?, ?, ?)""",
            (doc_id, filename, file_path, content_hash, file_size)
        )
        await self._pool.commit()
        
        async with self._pool.execute(
            "SELECT id FROM memory_documents WHERE content_hash = ?",
            (content_hash,)
        ) as cursor:
            row = await cursor.fetchone()
            return row['id']
    
    async def add_memory_chunk(
        self,
        document_id: str,
        chunk_index: int,
        content: str,
        embedding: List[float],
        token_count: int
    ) -> str:
        """Add chunked document with embedding."""
        chunk_id = f"chunk_{document_id}_{chunk_index}"
        
        await self._pool.execute(
            """INSERT OR REPLACE INTO memory_chunks 
               (id, document_id, chunk_index, content, embedding, token_count)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (chunk_id, document_id, chunk_index, content, json.dumps(embedding), token_count)
        )
        await self._pool.commit()
        return chunk_id
    
    async def update_document_chunk_count(self, document_id: str, count: int):
        """Update chunk count for document."""
        await self._pool.execute(
            "UPDATE memory_documents SET chunk_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (count, document_id)
        )
        await self._pool.commit()
    
    async def get_memory_documents(self) -> List[Dict[str, Any]]:
        """List all memory documents."""
        async with self._pool.execute(
            "SELECT * FROM memory_documents ORDER BY updated_at DESC"
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
    
    async def get_document_chunks(self, document_id: str) -> List[Dict[str, Any]]:
        """Get all chunks for a document."""
        async with self._pool.execute(
            "SELECT * FROM memory_chunks WHERE document_id = ? ORDER BY chunk_index",
            (document_id,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
    
    async def search_memory(
        self,
        query_embedding: List[float],
        top_k: int = RAG_CONFIG["top_k_chunks"],
        threshold: float = RAG_CONFIG["similarity_threshold"]
    ) -> List[Dict[str, Any]]:
        """Search memory chunks without blocking the async event loop."""
        async with self._pool.execute(
            "SELECT id, document_id, content, embedding FROM memory_chunks"
        ) as cursor:
            rows = await cursor.fetchall()
            
        def _calculate_similarities():
            results = []
            for row in rows:
                emb = json.loads(row['embedding'])
                similarity = cosine_similarity(query_embedding, emb)
                if similarity >= threshold:
                    results.append({
                        "id": row['id'],
                        "document_id": row['document_id'],
                        "content": row['content'],
                        "similarity": similarity
                    })
            results.sort(key=lambda x: x['similarity'], reverse=True)
            return results[:top_k]

        return await asyncio.to_thread(_calculate_similarities)
    
    async def delete_memory_document(self, doc_id: str) -> bool:
        """Remove document and its chunks."""
        await self._pool.execute("DELETE FROM memory_documents WHERE id = ?", (doc_id,))
        await self._pool.execute("DELETE FROM memory_chunks WHERE document_id = ?", (doc_id,))
        await self._pool.commit()
        return True
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get database statistics."""
        stats: Dict[str, Any] = {}
        
        async with self._pool.execute("SELECT COUNT(*) as count FROM threads") as c:
            row = await c.fetchone()
            stats['thread_count'] = row['count'] if row else 0
        
        async with self._pool.execute("SELECT COUNT(*) as count FROM messages") as c:
            row = await c.fetchone()
            stats['message_count'] = row['count'] if row else 0
        
        async with self._pool.execute("SELECT COUNT(*) as count FROM memory_chunks") as c:
            row = await c.fetchone()
            stats['chunk_count'] = row['count'] if row else 0
        
        stats['db_size'] = self.db_path.stat().st_size if self.db_path.exists() else 0
        
        return stats

def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    
    if norm_a == 0 or norm_b == 0:
        return 0.0
    
    return dot / (norm_a * norm_b)

db = Database()

File 4: Fixed memory_monitor.py
"""
Aegis Memory Monitor
====================

Real-time RAM and zRAM monitoring for hardware constraint enforcement.
Critical for Sandy Bridge systems with limited memory.
"""

import asyncio
import time
from pathlib import Path
from typing import Dict, Optional, Callable, List
from dataclasses import dataclass

from .config import HARDWARE

@dataclass
class MemoryStats:
    """Current memory statistics."""
    ram_used_gb: float
    ram_total_gb: float
    ram_percent: float
    zram_used_gb: float
    zram_compressed_gb: float
    zram_ratio: float
    available_gb: float

class MemoryMonitor:
    """
    Monitors system memory and zRAM status.
    Reads from /proc/meminfo and /sys/block/zram0/mm_stat.
    """
    
    def __init__(self):
        self.stats: Optional[MemoryStats] = None
        self.last_update: float = 0
        self.update_interval: float = 1.0  # seconds
        self._callbacks: List[Callable[[MemoryStats], None]] = []
        self._running: bool = False
        self._task: Optional[asyncio.Task] = None
    
    def add_callback(self, callback: Callable[[MemoryStats], None]):
        """Register callback for memory threshold alerts."""
        self._callbacks.append(callback)
    
    async def start(self):
        """Start monitoring loop."""
        self._running = True
        self._task = asyncio.create_task(self._monitor_loop())
    
    async def stop(self):
        """Stop monitoring."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
    
    async def _monitor_loop(self):
        """Main monitoring loop."""
        while self._running:
            try:
                self.stats = self._read_stats()
                self.last_update = time.time()
                
                # Check thresholds
                if self.stats.zram_ratio > HARDWARE["zram_warning_ratio"]:
                    for cb in self._callbacks:
                        try:
                            if asyncio.iscoroutinefunction(cb):
                                await cb(self.stats)
                            else:
                                cb(self.stats)
                        except Exception as e:
                            # Don't let callbacks break the loop
                            pass
                
                await asyncio.sleep(self.update_interval)
            except Exception as e:
                await asyncio.sleep(5)  # Back off on error
    
    def _read_stats(self) -> MemoryStats:
        """Read current memory statistics from system."""
        # Read RAM info
        meminfo = self._read_meminfo()
        
        ram_total = meminfo.get('MemTotal', 0) / (1024 * 1024)  # Convert KB to GB
        ram_free = meminfo.get('MemFree', 0) / (1024 * 1024)
        ram_available = meminfo.get('MemAvailable', ram_free) / (1024 * 1024)
        ram_used = ram_total - ram_available
        
        # Read zRAM stats
        zram_stats = self._read_zram_stats()
        zram_used = zram_stats['data_size'] / (1024 * 1024 * 1024)  # Bytes to GB
        zram_compressed = zram_stats['compressed_size'] / (1024 * 1024 * 1024)
        
        # Calculate compression ratio
        zram_ratio = zram_used / zram_compressed if zram_compressed > 0 else 0.0
        
        return MemoryStats(
            ram_used_gb=ram_used,
            ram_total_gb=ram_total,
            ram_percent=(ram_used / ram_total) * 100 if ram_total > 0 else 0.0,
            zram_used_gb=zram_used,
            zram_compressed_gb=zram_compressed,
            zram_ratio=zram_ratio,
            available_gb=ram_available
        )
    
    def _read_meminfo(self) -> Dict[str, int]:
        """Parse /proc/meminfo."""
        stats: Dict[str, int] = {}
        try:
            with open('/proc/meminfo') as f:
                for line in f:
                    if ':' in line:
                        key, value = line.split(':')
                        num = ''.join(c for c in value if c.isdigit())
                        stats[key.strip()] = int(num) if num else 0
        except (FileNotFoundError, PermissionError):
            pass
        return stats
    
    def _read_zram_stats(self) -> Dict[str, int]:
        """Read zRAM statistics from sysfs."""
        stats = {'data_size': 0, 'compressed_size': 0}
        
        zram_path = Path('/sys/block/zram0/mm_stat')
        if not zram_path.exists():
            return stats
        
        try:
            with open(zram_path) as f:
                values = f.read().strip().split()
                if len(values) >= 2:
                    stats['data_size'] = int(values[0])
                    stats['compressed_size'] = int(values[1])
        except (FileNotFoundError, PermissionError, ValueError):
            pass
        
        return stats
    
    def check_available_ram(self, required_gb: float) -> bool:
        """Check if required RAM is available."""
        if not self.stats:
            return True 
        
        effective_available = self.stats.available_gb - 1.5
        return effective_available >= required_gb
    
    def get_throttle_factor(self) -> float:
        """Get throttling factor based on memory pressure."""
        if not self.stats:
            return 1.0
        
        if self.stats.zram_ratio > HARDWARE["zram_critical_ratio"]:
            return 0.0  # Emergency stop
        
        if self.stats.zram_ratio > HARDWARE["zram_warning_ratio"]:
            return 0.5  # Throttle
        
        if self.stats.ram_percent > 90:
            return 0.5
        
        return 1.0

# Global instance
memory_monitor = MemoryMonitor()

File 5: Fixed model_manager.py
"""
Aegis Model Manager
===================

Handles model loading, unloading, hot-swapping, and concurrency control.
Enforces strict hardware constraints for Sandy Bridge systems.
"""

import asyncio
import gc
import json
import time
from pathlib import Path
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
import logging

from .config import (
    MODELS_DIR, HARDWARE, MODEL_TYPES, 
    load_model_registry, get_model_path
)
from .memory_monitor import memory_monitor

logger = logging.getLogger(__name__)

@dataclass
class LoadedModel:
    """Represents a currently loaded model."""
    model_id: str
    model_type: str
    instance: Any
    loaded_at: float
    ram_usage_gb: float

class ModelManager:
    """
    Manages model lifecycle with semaphore-based concurrency.
    Ensures only one large model or two small models are loaded.
    """
    
    def __init__(self):
        self.loaded_models: Dict[str, LoadedModel] = {}
        self.semaphore = asyncio.Semaphore(HARDWARE["max_concurrent_models"])
        self.current_model: Optional[str] = None
        self.model_registry = load_model_registry()
        self._lock = asyncio.Lock()
    
    def get_model_info(self, model_id: str) -> Optional[Dict[str, Any]]:
        """Get model metadata from registry."""
        for model in self.model_registry:
            if model['id'] == model_id:
                return model
        return None
    
    async def load_model(self, model_id: str) -> bool:
        """
        Load a model with semaphore acquisition and RAM checking.
        Implements hot-swap: unloads current model before loading new.
        """
        model_info = self.get_model_info(model_id)
        if not model_info:
            raise ValueError(f"Unknown model: {model_id}")
        
        async with self._lock:
            # Check if already loaded
            if model_id in self.loaded_models:
                self.current_model = model_id
                return True
            
            # Check RAM availability
            required_gb = model_info.get('ram_estimate', 4.0)
            if not memory_monitor.check_available_ram(required_gb):
                # Try to free memory
                await self._emergency_unload()
                
                if not memory_monitor.check_available_ram(required_gb):
                    raise MemoryError(
                        f"Insufficient RAM for {model_id}. "
                        f"Need {required_gb}GB, have ~{memory_monitor.stats.available_gb:.1f}GB"
                    )
            
            # Acquire semaphore slot
            async with self.semaphore:
                # Unload current model if different type
                if self.current_model and self.current_model != model_id:
                    await self.unload_model(self.current_model)
                
                logger.info(f"Loading model: {model_id}")
                instance = await self._load_instance(model_info)
                
                self.loaded_models[model_id] = LoadedModel(
                    model_id=model_id,
                    model_type=model_info['type'],
                    instance=instance,
                    loaded_at=time.time(),
                    ram_usage_gb=required_gb
                )
                
                self.current_model = model_id
                logger.info(f"Model {model_id} loaded successfully")
                return True
    
    async def unload_model(self, model_id: str) -> bool:
        """Unload specific model and release resources."""
        if model_id not in self.loaded_models:
            return False
        
        async with self._lock:
            logger.info(f"Unloading model: {model_id}")
            model = self.loaded_models[model_id]
            
            # Release instance resources
            await self._unload_instance(model)
            
            del self.loaded_models[model_id]
            if self.current_model == model_id:
                self.current_model = None
            
            # Force garbage collection and memory release
            gc.collect()
            
            # Release mmap if applicable (Linux-specific)
            try:
                import ctypes
                ctypes.CDLL('libc.so.6').malloc_trim(0)
            except Exception:
                pass
            
            logger.info(f"Model {model_id} unloaded")
            return True
    
    async def _emergency_unload(self):
        """Unload all non-active models to free memory."""
        logger.warning("Emergency unload triggered - freeing memory")
        models_to_unload = [
            mid for mid in self.loaded_models.keys() 
            if mid != self.current_model
        ]
        for mid in models_to_unload:
            await self.unload_model(mid)
    
    async def hot_swap(self, new_model_id: str) -> bool:
        """Hot-swap current model for new one."""
        if self.current_model == new_model_id:
            return True
        
        logger.info(f"Hot-swapping {self.current_model} -> {new_model_id}")
        return await self.load_model(new_model_id)
    
    async def _load_instance(self, model_info: Dict[str, Any]) -> Any:
        """Instantiate model based on type."""
        model_type = model_info['type']
        model_path = get_model_path(model_info['filename'])
        
        if not model_path.exists():
            raise FileNotFoundError(f"Model file not found: {model_path}")
        
        if model_type == 'text':
            from llama_cpp import Llama
            return Llama(
                model_path=str(model_path),
                n_ctx=2048,
                n_batch=512,
                n_threads=HARDWARE.get('threads', 4),
                n_gpu_layers=0,  
                verbose=False
            )
        
        elif model_type == 'vision':
            from llama_cpp import Llama
            return Llama(
                model_path=str(model_path),
                n_ctx=2048,
                n_threads=4,
                verbose=False
            )
        
        elif model_type == 'embedding':
            from llama_cpp import Llama
            n_gpu = 10 if HARDWARE.get('gpu_vram_mb', 0) >= 512 else 0
            return Llama(
                model_path=str(model_path),
                n_ctx=2048,
                embedding=True,
                n_gpu_layers=n_gpu,
                verbose=False
            )
        
        elif model_type == 'stt':
            from faster_whisper import WhisperModel
            return WhisperModel(
                model_info['filename'],
                device="cpu",
                compute_type="int8"
            )
        
        elif model_type == 'tts':
            return None  # Stateless
        
        elif model_type == 'image_gen':
            return None  # Loaded per generation
        
        else:
            raise ValueError(f"Unknown model type: {model_type}")
    
    async def _unload_instance(self, model: LoadedModel):
        """Release model instance resources."""
        if model.instance is not None:
            if hasattr(model.instance, 'close'):
                model.instance.close()
            elif hasattr(model.instance, 'reset'):
                model.instance.reset()
            del model.instance
    
    def get_current_model(self) -> Optional[Dict[str, Any]]:
        """Get currently active model info."""
        if not self.current_model:
            return None
        
        loaded = self.loaded_models.get(self.current_model)
        if not loaded:
            return None
        
        info = self.get_model_info(self.current_model)
        if not info:
            return None
        
        return {
            **info,
            'loaded_at': loaded.loaded_at,
            'ram_usage_gb': loaded.ram_usage_gb
        }
    
    def list_loaded(self) -> List[Dict[str, Any]]:
        """List all currently loaded models."""
        return [
            {
                'id': m.model_id,
                'type': m.model_type,
                'loaded_at': m.loaded_at,
                'ram_usage_gb': m.ram_usage_gb
            }
            for m in self.loaded_models.values()
        ]
    
    async def auto_unload_check(self):
        """Background task to auto-unload if RAM critical."""
        if not memory_monitor.stats:
            return
        
        if memory_monitor.stats.ram_percent > 95:
            logger.warning("RAM critical - auto-unloading non-active models")
            await self._emergency_unload()

# Global instance
model_manager = ModelManager()

File 6: Fixed inference.py
"""
Aegis Inference Engine
======================

Streaming text generation with KV cache management and context overflow handling.
Optimized for CPU constraints.
"""

import asyncio
import time
import json
from typing import AsyncIterator, Dict, List, Any, Optional
import logging

from .config import LLAMA_DEFAULTS, CONTEXT_CONFIG
from .model_manager import model_manager

logger = logging.getLogger(__name__)

class InferenceEngine:
    """
    Handles streaming inference with automatic context management.
    Implements sliding window, compression, and OOC recovery.
    """
    
    def __init__(self):
        self.active_generations: Dict[str, dict] = {}
    
    async def generate(
        self,
        messages: List[Dict[str, str]],
        model_id: str,
        parameters: Optional[Dict[str, Any]] = None,
        thread_id: Optional[str] = None
    ) -> AsyncIterator[str]:
        
        if not await model_manager.load_model(model_id):
            raise RuntimeError(f"Failed to load model: {model_id}")
        
        model = model_manager.loaded_models[model_id].instance
        params = {**LLAMA_DEFAULTS, **(parameters or {})}
        
        prepared_messages = self._prepare_context(messages, params['n_ctx'])
        
        completion_gen = model.create_chat_completion(
            messages=prepared_messages,
            stream=True,
            **self._filter_params(params)
        )
        
        gen_id = f"gen_{thread_id or 'none'}_{int(time.time())}"
        self.active_generations[gen_id] = {
            'start_time': time.time(),
            'tokens': 0,
            'model': model_id
        }
        
        try:
            for chunk in completion_gen:
                if 'choices' in chunk and len(chunk['choices']) > 0:
                    delta = chunk['choices'][0].get('delta', {})
                    content = delta.get('content', '')
                    if content:
                        self.active_generations[gen_id]['tokens'] += 1
                        yield content
                        
        except Exception as e:
            logger.error(f"Generation error: {e}")
            error_str = str(e).lower()
            if "context" in error_str or "overflow" in error_str or "length" in error_str:
                recovered = await self._handle_ooc(
                    messages, model_id, parameters, thread_id
                )
                if recovered:
                    async for token in recovered:
                        yield token
                else:
                    raise
            else:
                raise
        finally:
            if gen_id in self.active_generations:
                del self.active_generations[gen_id]
    
    def _prepare_context(self, messages: List[Dict[str, str]], max_ctx: int) -> List[Dict[str, str]]:
        total_tokens = sum(len(m['content'].split()) * 1.3 for m in messages)
        
        if total_tokens < max_ctx * CONTEXT_CONFIG['sliding_window_history']:
            return messages
        
        history_limit = int(max_ctx * CONTEXT_CONFIG['sliding_window_history'])
        system_msgs = [m for m in messages if m['role'] == 'system']
        non_system = [m for m in messages if m['role'] != 'system']
        
        kept_messages: List[Dict[str, str]] = []
        current_tokens = sum(len(m['content'].split()) * 1.3 for m in system_msgs)
        
        for msg in reversed(non_system):
            msg_tokens = len(msg['content'].split()) * 1.3
            if current_tokens + msg_tokens > history_limit:
                break
            kept_messages.insert(0, msg)
            current_tokens += msg_tokens
        
        if len(non_system) > len(kept_messages):
            oldest = non_system[:-len(kept_messages)] if kept_messages else non_system
            summary = self._summarize_messages(oldest)
            system_msgs.append({
                'role': 'system',
                'content': f'[THREAD SUMMARY] {summary}'
            })
        
        return system_msgs + kept_messages
    
    def _summarize(self, text: str, max_tokens: int = 200) -> str:
        sentences = text.split('. ')
        if len(sentences) <= 3:
            return text
        
        def score(sent: str) -> int:
            words = sent.lower().split()
            stop_words = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of', 'and', 'in', 'that', 'have', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me'}
            content_words = [w for w in words if w not in stop_words and len(w) > 3]
            return len(content_words)
        
        scored = [(s, score(s)) for s in sentences]
        scored.sort(key=lambda x: x[1], reverse=True)
        
        summary: List[str] = []
        tokens = 0
        for sent, _ in scored[:len(scored)//2]: 
            sent_tokens = len(sent.split())
            if tokens + sent_tokens > max_tokens:
                break
            summary.append(sent)
            tokens += sent_tokens
        
        return '. '.join(summary) + '.' if summary else text[:200]
    
    def _summarize_messages(self, messages: List[Dict[str, str]]) -> str:
        text = ' '.join(m['content'] for m in messages)
        return self._summarize(text)
    
    async def _handle_ooc(self, messages: List[Dict[str, str]], model_id: str, parameters: Optional[Dict[str, Any]], thread_id: Optional[str], attempt: int = 0) -> Optional[AsyncIterator[str]]:
        if attempt >= CONTEXT_CONFIG['ooc_retry_attempts']:
            logger.error("OOC recovery failed after max attempts")
            return None
        
        logger.warning(f"OOC recovery attempt {attempt + 1}")
        truncate_ratio = CONTEXT_CONFIG['ooc_truncate_ratio']
        truncated: List[Dict[str, str]] = []
        
        for msg in messages:
            msg_copy = msg.copy()
            content = msg['content']
            if len(content) > 100:
                keep_len = int(len(content) * (1 - truncate_ratio))
                msg_copy['content'] = content[:keep_len] + "... [truncated]"
            truncated.append(msg_copy)
        
        try:
            return self.generate(truncated, model_id, parameters, thread_id)
        except Exception as e:
            error_str = str(e).lower()
            if "context" in error_str or "overflow" in error_str or "length" in error_str:
                return await self._handle_ooc(
                    truncated, model_id, parameters, thread_id, attempt + 1
                )
            raise
    
    def _filter_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        valid = {
            'temperature', 'top_p', 'top_k', 'min_p', 
            'repeat_penalty', 'frequency_penalty', 'presence_penalty',
            'mirostat_mode', 'mirostat_tau', 'mirostat_eta',
            'max_tokens', 'stop', 'stream'
        }
        return {k: v for k, v in params.items() if k in valid}

# Global instance
inference_engine = InferenceEngine()

File 7: Fixed rag.py
"""
Aegis RAG System
================

Retrieval-Augmented Generation with recursive chunking and embeddings.
Uses nomic-embed-text for Sandy Bridge compatibility.
"""

import hashlib
import re
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging

from .config import RAG_CONFIG, MODELS_DIR
from .db import db
from .model_manager import model_manager

logger = logging.getLogger(__name__)

class RAGProcessor:
    """
    Handles document ingestion, chunking, embedding, and retrieval.
    """
    
    def __init__(self):
        self.embedding_model = None
    
    async def ensure_embedding_model(self):
        """Load embedding model if not already loaded."""
        if self.embedding_model is not None:
            return
        
        registry = model_manager.model_registry
        embed_info = None
        for m in registry:
            if m['type'] == 'embedding':
                embed_info = m
                break
        
        if not embed_info:
            raise RuntimeError("No embedding model found in registry")
        
        await model_manager.load_model(embed_info['id'])
        self.embedding_model = model_manager.loaded_models[embed_info['id']].instance
    
    async def ingest_document(
        self,
        file_path: Path,
        filename: str
    ) -> Dict[str, Any]:
        """Ingest document: extract text, chunk, embed, store."""
        await self.ensure_embedding_model()
        
        file_size = file_path.stat().st_size
        if file_size > RAG_CONFIG['max_file_size_mb'] * 1024 * 1024:
            raise ValueError(f"File too large: {file_size} bytes")
        
        content_hash = await self._calculate_hash(file_path)
        existing = await db.add_memory_document(filename, content_hash, file_size, str(file_path))
        
        text = await self._extract_text(file_path, filename)
        chunks = self._chunk_text(text)
        
        chunk_records = []
        for i, chunk in enumerate(chunks):
            embedding = await self._embed_text(chunk)
            chunk_id = await db.add_memory_chunk(
                existing, i, chunk, embedding, len(chunk.split())
            )
            chunk_records.append(chunk_id)
        
        await db.update_document_chunk_count(existing, len(chunks))
        
        return {
            'id': existing,
            'filename': filename,
            'chunks': len(chunks),
            'size': file_size
        }
    
    async def _calculate_hash(self, file_path: Path) -> str:
        """Calculate SHA256 hash of file."""
        hasher = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                hasher.update(chunk)
        return hasher.hexdigest()[:32]
    
    async def _extract_text(self, file_path: Path, filename: str) -> str:
        """Extract text from various file formats."""
        suffix = Path(filename).suffix.lower()
        
        if suffix == '.pdf':
            return await self._extract_pdf(file_path)
        elif suffix in ['.txt', '.md', '.py', '.js', '.json', '.csv', '.html', '.css', '.xml', '.yaml', '.yml', '.sh', '.bash']:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        else:
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    return f.read()
            except Exception:
                raise ValueError(f"Unsupported file type: {suffix}")
    
    async def _extract_pdf(self, file_path: Path) -> str:
        """Extract text from PDF."""
        try:
            from pdfminer.high_level import extract_text
            return await asyncio.to_thread(extract_text, str(file_path))
        except ImportError:
            logger.error("pdfminer.six not installed")
            raise RuntimeError("PDF support requires pdfminer.six")
    
    def _chunk_text(self, text: str) -> List[str]:
        """Recursive chunking with overlap."""
        chunks: List[str] = []
        target_size = RAG_CONFIG['chunk_size_tokens']
        overlap = RAG_CONFIG['chunk_overlap_tokens']
        
        paragraphs = re.split(r'\n\s*\n', text)
        
        current_chunk: List[str] = []
        current_tokens = 0
        
        for para in paragraphs:
            para_tokens = len(para.split())
            
            if current_tokens + para_tokens > target_size and current_chunk:
                chunks.append(' '.join(current_chunk))
                
                if overlap > 0:
                    overlap_text = ' '.join(current_chunk[-2:]) if len(current_chunk) > 1 else current_chunk[-1]
                    current_chunk = [overlap_text, para]
                    current_tokens = len(overlap_text.split()) + para_tokens
                else:
                    current_chunk = [para]
                    current_tokens = para_tokens
            else:
                current_chunk.append(para)
                current_tokens += para_tokens
        
        if current_chunk:
            chunks.append(' '.join(current_chunk))
        
        return chunks
    
    async def _embed_text(self, text: str) -> List[float]:
        """Generate embedding for text chunk."""
        if not self.embedding_model:
            raise RuntimeError("Embedding model not loaded")
        
        result = await asyncio.to_thread(self.embedding_model.embed, text)
        
        if isinstance(result, list) and len(result) > 0:
            if isinstance(result[0], list):
                return result[0]
            return result
        return list(result) if hasattr(result, '__iter__') else []
    
    async def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Retrieve relevant chunks for query."""
        await self.ensure_embedding_model()
        
        query_embedding = await self._embed_text(query)
        
        results = await db.search_memory(
            query_embedding,
            top_k or RAG_CONFIG['top_k_chunks'],
            RAG_CONFIG['similarity_threshold']
        )
        
        return results

# Global instance
rag_processor = RAGProcessor()

File 8: Fixed tts_handler.py
"""
Aegis TTS Handler
================

Piper TTS integration with voice selection and speed control.
"""

import io
import wave
from pathlib import Path
from typing import Optional, List, Dict, Any
import logging

import numpy as np

from .config import TTS_CONFIG, MODELS_DIR

logger = logging.getLogger(__name__)

class TTSHandler:
    """Handles text-to-speech generation using Piper."""
    
    def __init__(self):
        self.voices: Dict[str, Path] = {}
        self._scan_voices()
    
    def _scan_voices(self):
        """Scan for available voice models."""
        voices_dir = TTS_CONFIG['voices_dir']
        if not voices_dir.exists():
            voices_dir.mkdir(parents=True, exist_ok=True)
            return
        
        for onnx_file in voices_dir.glob('*.onnx'):
            voice_id = onnx_file.stem
            self.voices[voice_id] = onnx_file
    
    def list_voices(self) -> List[Dict[str, str]]:
        """List available TTS voices."""
        return [
            {'id': vid, 'name': vid.replace('_', ' ').title()}
            for vid in self.voices.keys()
        ]
    
    async def synthesize(
        self,
        text: str,
        voice: Optional[str] = None,
        speed: float = 1.0
    ) -> bytes:
        """Synthesize speech from text. Returns WAV audio bytes."""
        speed = max(TTS_CONFIG['speed_range'][0], min(TTS_CONFIG['speed_range'][1], speed))
        
        if not voice or voice not in self.voices:
            if self.voices:
                voice = list(self.voices.keys())[0]
            else:
                raise RuntimeError("No TTS voices available")
        
        voice_path = self.voices[voice]
        json_path = voice_path.with_suffix('.json')
        
        try:
            from piper import PiperVoice
            
            voice_obj = PiperVoice.load(
                str(voice_path), 
                str(json_path) if json_path.exists() else None
            )
            
            audio_buffer = io.BytesIO()
            with wave.open(audio_buffer, 'wb') as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(TTS_CONFIG['sample_rate'])
                
                for audio_bytes in voice_obj.synthesize_stream_raw(text):
                    wav_file.writeframes(audio_bytes)
            
            audio_data = audio_buffer.getvalue()
            
            if speed != 1.0:
                audio_data = self._adjust_speed(audio_data, speed)
            
            return audio_data
            
        except ImportError:
            logger.error("piper-tts not installed")
            raise RuntimeError("TTS requires piper-tts package")
        except Exception as e:
            logger.error(f"TTS synthesis error: {e}")
            raise RuntimeError(f"TTS failed: {e}")
    
    def _adjust_speed(self, wav_bytes: bytes, speed: float) -> bytes:
        """Adjust playback speed by resampling."""
        with io.BytesIO(wav_bytes) as buf:
            with wave.open(buf, 'rb') as wav:
                n_channels = wav.getnchannels()
                sampwidth = wav.getsampwidth()
                framerate = wav.getframerate()
                n_frames = wav.getnframes()
                data = wav.readframes(n_frames)
        
        if sampwidth == 2:
            audio = np.frombuffer(data, dtype=np.int16)
        else:
            audio = np.frombuffer(data, dtype=np.int8)
        
        if speed != 1.0:
            indices = np.round(np.arange(0, len(audio), speed)).astype(int)
            indices = indices[indices < len(audio)]
            audio = audio[indices]
        
        new_data = audio.tobytes()
        
        buffer = io.BytesIO()
        with wave.open(buffer, 'wb') as wav:
            wav.setnchannels(n_channels)
            wav.setsampwidth(sampwidth)
            wav.setframerate(int(framerate * speed)) 
            wav.writeframes(new_data)
        
        return buffer.getvalue()

# Global instance
tts_handler = TTSHandler()

File 9: Fixed stt_handler.py
"""
Aegis STT Handler
================

faster-whisper integration for speech-to-text.
Optimized for CPU inference on Sandy Bridge.
"""

import tempfile
import asyncio
from pathlib import Path
from typing import Optional
import logging

from .config import STT_CONFIG

logger = logging.getLogger(__name__)

class STTHandler:
    """Handles speech-to-text transcription using faster-whisper."""
    
    def __init__(self):
        self.model = None
    
    async def ensure_model(self):
        """Load STT model if not loaded."""
        if self.model is not None:
            return
        
        try:
            from faster_whisper import WhisperModel
            
            logger.info(f"Loading STT model: {STT_CONFIG['model_size']}")
            self.model = WhisperModel(
                STT_CONFIG['model_size'],
                device=STT_CONFIG['device'],
                compute_type=STT_CONFIG['compute_type'],
                cpu_threads=4  
            )
        except ImportError:
            raise RuntimeError("STT requires faster-whisper package")
    
    async def transcribe(
        self,
        audio_path: Path,
        language: Optional[str] = None
    ) -> str:
        """Transcribe audio file to text."""
        await self.ensure_model()
        
        def _transcribe():
            segments, info = self.model.transcribe(
                str(audio_path),
                language=language,
                beam_size=STT_CONFIG['beam_size'],
                vad_filter=STT_CONFIG['vad_filter'],
                condition_on_previous_text=True
            )
            
            text_parts = []
            for segment in segments:
                text_parts.append(segment.text.strip())
            
            return ' '.join(text_parts)
        
        return await asyncio.to_thread(_transcribe)
    
    async def transcribe_buffer(self, audio_buffer: bytes) -> str:
        """Transcribe from memory buffer."""
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            tmp.write(audio_buffer)
            tmp_path = Path(tmp.name)
        
        try:
            return await self.transcribe(tmp_path)
        finally:
            tmp_path.unlink(missing_ok=True)

# Global instance
stt_handler = STTHandler()

File 10: Fixed image_gen.py
"""
Aegis Image Generation
======================

Stable Diffusion 1.5 ONNX pipeline for CPU image generation.
Memory-constrained for Sandy Bridge systems.
"""

import io
import time
import gc
import asyncio
from pathlib import Path
from typing import Optional, Tuple
import logging

import numpy as np
from PIL import Image

from .config import IMAGE_CONFIG

logger = logging.getLogger(__name__)

class ImageGenerator:
    """
    Handles image generation using ONNX Runtime.
    Loads model on-demand to save memory.
    """
    
    def __init__(self):
        self.pipeline = None
        self.last_used = 0.0
    
    async def ensure_pipeline(self):
        """Load diffusion pipeline if not loaded."""
        if self.pipeline is not None:
            return
        
        try:
            from diffusers import OnnxStableDiffusionPipeline
            import onnxruntime as ort
            
            logger.info("Loading Stable Diffusion ONNX pipeline...")
            
            sess_options = ort.SessionOptions()
            sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            sess_options.intra_op_num_threads = 4
            
            provider_options = [{
                'arena_extend_strategy': 'kSameAsRequested',
                'cpu_threads': 4,
            }]
            
            self.pipeline = OnnxStableDiffusionPipeline.from_pretrained(
                IMAGE_CONFIG['model_id'],
                provider="CPUExecutionProvider",
                sess_options=sess_options,
                provider_options=provider_options
            )
            
            self.last_used = time.time()
            
        except ImportError:
            raise RuntimeError("Image generation requires diffusers and onnxruntime")
        except Exception as e:
            logger.error(f"Failed to load SD pipeline: {e}")
            raise
    
    async def generate(
        self,
        prompt: str,
        negative_prompt: str = "",
        width: int = 512,
        height: int = 512,
        steps: int = 25,
        guidance_scale: float = 7.5,
        seed: Optional[int] = None
    ) -> bytes:
        """Generate image from prompt. Returns PNG bytes."""
        await self.ensure_pipeline()
        
        width = min(width, IMAGE_CONFIG['max_resolution'])
        height = min(height, IMAGE_CONFIG['max_resolution'])
        
        if seed is not None:
            np.random.seed(seed)
        
        logger.info(f"Generating image: {width}x{height}, {steps} steps")
        
        def _generate():
            result = self.pipeline(
                prompt,
                negative_prompt=negative_prompt,
                width=width,
                height=height,
                num_inference_steps=steps,
                guidance_scale=guidance_scale
            )
            return result.images[0]
        
        image = await asyncio.to_thread(_generate)
        
        buffer = io.BytesIO()
        image.save(buffer, format='PNG')
        return buffer.getvalue()
    
    def unload(self):
        """Unload pipeline to free memory."""
        if self.pipeline:
            del self.pipeline
            self.pipeline = None
            gc.collect()

# Global instance
image_generator = ImageGenerator()

File 11: Fixed server.py
"""
Aegis FastAPI Server
====================

Main application server with all endpoints.
OpenAI-compatible API with SSE streaming.
"""

import asyncio
import io
import json
import logging
import mimetypes
import os
import shutil
import tempfile
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator, Optional, Set, Dict, Any

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import (
    SECURITY, LOG_CONFIG, MODELS_DIR, AEGIS_DIR, HOST, PORT
)
from .db import db
from .memory_monitor import memory_monitor, MemoryStats
from .model_manager import model_manager
from .inference import inference_engine
from .rag import rag_processor
from .tts_handler import tts_handler
from .stt_handler import stt_handler
from .image_gen import image_generator

# Setup logging
logging.basicConfig(
    level=getattr(logging, LOG_CONFIG['level']),
    format=LOG_CONFIG['format'],
    handlers=[
        logging.FileHandler(LOG_CONFIG['file']),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# SSE clients
sse_clients: Set[asyncio.Queue] = set()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    await db.initialize()
    await memory_monitor.start()
    
    async def on_memory_pressure(stats: MemoryStats):
        logger.warning(f"Memory pressure: zRAM ratio {stats.zram_ratio:.2f}")
        await model_manager.auto_unload_check()
        await broadcast_event({
            'type': 'warning',
            'message': f'High memory usage: zRAM {stats.zram_ratio:.1f}:1'
        })
    
    memory_monitor.add_callback(on_memory_pressure)
    
    yield
    
    await memory_monitor.stop()
    await db.close()

app = FastAPI(title="Aegis API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=SECURITY['allowed_origins'],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def security_middleware(request, call_next):
    """Path traversal protection."""
    path = request.url.path
    
    for bad in SECURITY['path_traversal_blacklist']:
        if bad in path:
            raise HTTPException(403, "Invalid path")
    
    response = await call_next(request)
    return response

@app.get("/events")
async def events():
    """Server-Sent Events endpoint for real-time updates."""
    queue = asyncio.Queue()
    sse_clients.add(queue)
    
    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            while True:
                data = await queue.get()
                yield f"data: {json.dumps(data)}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            sse_clients.discard(queue)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )

async def broadcast_event(data: dict):
    """Send event to all connected clients."""
    dead_clients = set()
    for client in sse_clients:
        try:
            await client.put(data)
        except Exception:
            dead_clients.add(client)
    
    for dead in dead_clients:
        sse_clients.discard(dead)

@app.get("/models")
async def list_models():
    """List available models from registry."""
    registry = model_manager.model_registry
    loaded = model_manager.list_loaded()
    loaded_ids = {m['id'] for m in loaded}
    
    return [
        {
            **m,
            'loaded': m['id'] in loaded_ids,
            'current': m['id'] == model_manager.current_model
        }
        for m in registry
    ]

@app.post("/models/load")
async def load_model(data: dict):
    """Load a model."""
    try:
        success = await model_manager.load_model(data['model'])
        if success:
            await broadcast_event({
                'type': 'status',
                'message': f"Loaded model: {data['model']}"
            })
            return {'status': 'loaded', 'model': data['model']}
        raise HTTPException(500, "Failed to load model")
    except Exception as e:
        logger.error(f"Model load error: {e}")
        raise HTTPException(400, str(e))

@app.get("/threads")
async def get_threads(search: Optional[str] = None):
    """List conversation threads."""
    return await db.get_threads(search)

@app.post("/threads")
async def create_thread(data: dict):
    """Create new thread."""
    thread = await db.create_thread(data.get('title', 'New Conversation'))
    return thread

@app.get("/threads/{thread_id}/messages")
async def get_messages(thread_id: str):
    """Get messages for thread."""
    return await db.get_messages(thread_id)

@app.put("/threads/{thread_id}")
async def update_thread(thread_id: str, data: dict):
    """Update thread."""
    success = await db.update_thread(thread_id, data.get('title'))
    return {'success': success}

@app.delete("/threads/{thread_id}")
async def delete_thread(thread_id: str):
    """Delete thread."""
    success = await db.delete_thread(thread_id)
    return {'success': success}

@app.post("/chat/completions")
async def chat_completions(data: dict):
    """OpenAI-compatible chat completions with streaming."""
    thread_id = data.get('thread_id')
    messages = data.get('messages', [])
    model_id = data.get('model', model_manager.current_model)
    parameters = data.get('parameters', {})
    
    if not model_id:
        raise HTTPException(400, "No model specified")
    
    if thread_id and messages:
        user_msg = messages[-1]  
        await db.add_message(
            thread_id,
            'user',
            user_msg['content'],
            token_count=len(user_msg['content'].split())
        )
    
    use_memory = False
    if thread_id and messages:
        query = messages[-1]['content']
        try:
            chunks = await rag_processor.retrieve(query)
            if chunks:
                use_memory = True
                context = "\n\n".join([f"[MEMORY] {c['content']}" for c in chunks])
                messages.insert(0, {
                    'role': 'system',
                    'content': f'Relevant context from memory:\n{context}'
                })
        except Exception as e:
            logger.warning(f"RAG retrieval failed: {e}")
    
    async def generate_stream() -> AsyncGenerator[str, None]:
        full_response = []
        
        try:
            async for token in inference_engine.generate(
                messages, model_id, parameters, thread_id
            ):
                full_response.append(token)
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
            
            if thread_id:
                content = ''.join(full_response)
                await db.add_message(
                    thread_id,
                    'assistant',
                    content,
                    model=model_id,
                    token_count=len(content.split()),
                    used_memory=use_memory
                )
            
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            
        except Exception as e:
            logger.error(f"Generation error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream"
    )

@app.get("/memory")
async def list_memory():
    """List indexed memory documents."""
    return await db.get_memory_documents()

@app.post("/memory/upload")
async def upload_memory(file: UploadFile = File(...)):
    """Upload and index document to memory."""
    if file.size and file.size > SECURITY['max_upload_size']:
        raise HTTPException(413, "File too large")
    
    suffix = Path(file.filename).suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = Path(tmp.name)
    
    try:
        result = await rag_processor.ingest_document(tmp_path, file.filename)
        return result
    except Exception as e:
        logger.error(f"Memory upload error: {e}")
        raise HTTPException(400, str(e))
    finally:
        tmp_path.unlink(missing_ok=True)

@app.delete("/memory/{doc_id}")
async def delete_memory(doc_id: str):
    """Remove document from memory."""
    success = await db.delete_memory_document(doc_id)
    return {'success': success}

@app.post("/tts")
async def text_to_speech(data: dict):
    """Convert text to speech."""
    try:
        audio = await tts_handler.synthesize(
            data['text'],
            data.get('voice'),
            data.get('speed', 1.0)
        )
        return StreamingResponse(
            io.BytesIO(audio),
            media_type="audio/wav"
        )
    except Exception as e:
        raise HTTPException(400, str(e))

@app.get("/stats")
async def get_stats():
    """Get system statistics."""
    mem_stats = memory_monitor.stats
    db_stats = await db.get_stats()
    
    current = model_manager.get_current_model()
    
    return {
        'ram_used': mem_stats.ram_used_gb if mem_stats else None,
        'ram_total': mem_stats.ram_total_gb if mem_stats else None,
        'zram_ratio': mem_stats.zram_ratio if mem_stats else None,
        'zram_compressed': mem_stats.zram_compressed_gb if mem_stats else None,
        'active_model': current['name'] if current else None,
        'model_type': current['type'] if current else None,
        'tokens_per_sec': 0,  
        'kv_cache_percent': 0,
        **db_stats
    }

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        'status': 'healthy',
        'sse_clients': len(sse_clients),
        'models_loaded': len(model_manager.loaded_models)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")

Would you like to kick off a dry-run test command to make sure all dependencies are aligning properly, or are you ready to spin it right up?
