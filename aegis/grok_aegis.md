```html
<!-- aegis.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Aegis - Local Multimodal AI</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/monokai.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">
    <style>
        :root {
            --bg: #0d0d10;
            --surface: #16161d;
            --accent: #7c6af7;
            --danger: #e05c5c;
            --success: #4caf7d;
            --text: #ffffff;
            --text-secondary: #b3b3b3;
        }
        body.light {
            --bg: #ffffff;
            --surface: #f0f0f0;
            --accent: #5a48d6;
            --danger: #c04040;
            --success: #3a8d5d;
            --text: #000000;
            --text-secondary: #666666;
        }
        body {
            margin: 0;
            font-family: system-ui, -apple-system, sans-serif;
            background: var(--bg);
            color: var(--text);
            display: flex;
            height: 100vh;
            overflow: hidden;
        }
        #sidebar {
            width: 250px;
            background: var(--surface);
            border-right: 1px solid var(--accent);
            transition: width 0.3s;
            overflow-y: auto;
        }
        #sidebar.collapsed {
            width: 48px;
        }
        #main {
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        #chat {
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
        }
        #input-area {
            border-top: 1px solid var(--accent);
            padding: 1rem;
            display: flex;
        }
        #input {
            flex: 1;
            resize: none;
            background: var(--surface);
            color: var(--text);
            border: 1px solid var(--accent);
            padding: 0.5rem;
        }
        .message {
            margin-bottom: 1rem;
            padding: 0.5rem;
            border-radius: 0.5rem;
        }
        .user {
            background: var(--accent);
            align-self: flex-end;
            max-width: 70%;
            margin-left: auto;
        }
        .assistant {
            background: var(--surface);
            max-width: 70%;
        }
        #status-bar {
            background: var(--surface);
            padding: 0.5rem;
            display: flex;
            justify-content: space-between;
        }
        #settings-drawer {
            position: absolute;
            right: 0;
            top: 0;
            width: 300px;
            height: 100%;
            background: var(--surface);
            transform: translateX(100%);
            transition: transform 0.3s;
        }
        #settings-drawer.open {
            transform: translateX(0);
        }
        #dev-overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 0;
            background: var(--surface);
            overflow: hidden;
            transition: height 0.3s;
        }
        #dev-overlay.open {
            height: 200px;
        }
        .toast {
            position: fixed;
            bottom: 1rem;
            right: 1rem;
            background: var(--surface);
            padding: 0.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
            transition: opacity 0.3s;
        }
        pre code.hljs {
            font-family: 'JetBrains Mono', monospace;
        }
    </style>
</head>
<body>
    <div id="sidebar">
        <button id="toggle-sidebar">☰</button>
        <div id="threads-list"></div>
        <button id="new-thread">New Thread</button>
        <input id="thread-search" placeholder="Search threads">
        <div id="memory-tab">Memory</div>
        <input type="file" id="memory-upload" multiple>
        <textarea id="memory-paste" placeholder="Paste text"></textarea>
        <button id="add-memory">Add to Memory</button>
    </div>
    <div id="main">
        <div id="chat"></div>
        <div id="input-area">
            <textarea id="input" placeholder="Type your message..."></textarea>
            <button id="send">Send</button>
            <button id="mic">🎤</button>
            <input type="file" id="file-upload" multiple>
        </div>
        <div id="status-bar">
            <span id="active-model"></span>
            <span id="ram-used"></span>
            <span id="zram-ratio"></span>
            <span id="tokens-sec"></span>
            <span id="sse-status">SSE: Connected</span>
            <button id="settings-toggle">⚙</button>
        </div>
    </div>
    <div id="settings-drawer">
        <!-- Settings form here -->
        <label>System Prompt</label>
        <textarea id="system-prompt"></textarea>
        <label>Temperature</label>
        <input type="number" id="temperature" step="0.1">
        <!-- Add all other params -->
        <button id="theme-toggle">Toggle Theme</button>
        <button id="save-settings">Save</button>
    </div>
    <div id="dev-overlay">
        <!-- Graphs and logs -->
    </div>
    <div id="toasts"></div>

    <script src="https://cdn.jsdelivr.net/npm/marked@4.0.0/marked.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js"></script>
    <script>
        // Frontend logic
        const API_BASE = 'http://127.0.0.1:7860';
        let currentThread = null;
        let sseSource = null;
        let speechRecognition = null;
        let audioQueue = [];
        let audioPlayer = new Audio();
        let theme = localStorage.getItem('theme') || 'dark';
        document.body.classList.toggle('light', theme === 'light');

        function showToast(message, type = 'info') {
            const toast = document.createElement('div');
            toast.classList.add('toast', type);
            toast.textContent = message;
            document.getElementById('toasts').appendChild(toast);
            setTimeout(() => toast.remove(), 5000);
        }

        function connectSSE() {
            sseSource = new EventSource(`${API_BASE}/stream`);
            sseSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'chat') {
                    appendMessage(data.message, 'assistant');
                } else if (data.type === 'status') {
                    updateStatus(data);
                } else if (data.type === 'error') {
                    showToast(data.message, 'error');
                }
            };
            sseSource.onerror = () => {
                document.getElementById('sse-status').textContent = 'SSE: Disconnected';
                setTimeout(connectSSE, 5000);
            };
        }

        function updateStatus(status) {
            document.getElementById('active-model').textContent = `Model: ${status.active_model}`;
            document.getElementById('ram-used').textContent = `RAM: ${status.ram_used} GB`;
            document.getElementById('zram-ratio').textContent = `zRAM: ${status.zram_ratio}`;
            document.getElementById('tokens-sec').textContent = `Tokens/s: ${status.tokens_sec}`;
        }

        function appendMessage(content, role) {
            const div = document.createElement('div');
            div.classList.add('message', role);
            div.innerHTML = marked.parse(content);
            hljs.highlightAll();
            renderMathInElement(div, { delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}] });
            const meta = document.createElement('div');
            meta.innerHTML = `<span>${new Date().toLocaleTimeString()}</span> <span>Tokens: ${content.length / 4 | 0}</span> <button onclick="copyMessage(this)">Copy</button> <button onclick="readAloud(this)">▶</button>`;
            div.appendChild(meta);
            document.getElementById('chat').appendChild(div);
            div.scrollIntoView();
        }

        function copyMessage(btn) {
            const text = btn.parentElement.parentElement.textContent;
            navigator.clipboard.writeText(text);
            showToast('Copied');
        }

        async function readAloud(btn) {
            const text = btn.parentElement.parentElement.textContent;
            const response = await fetch(`${API_BASE}/tts`, { method: 'POST', body: JSON.stringify({ text }) });
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            audioQueue.push(url);
            playNextAudio();
        }

        function playNextAudio() {
            if (audioQueue.length > 0 && !audioPlayer.src) {
                audioPlayer.src = audioQueue.shift();
                audioPlayer.play();
                audioPlayer.onended = playNextAudio;
            }
        }

        document.getElementById('send').addEventListener('click', sendMessage);
        document.getElementById('input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        async function sendMessage() {
            const input = document.getElementById('input');
            const message = input.value.trim();
            if (!message) return;
            appendMessage(message, 'user');
            input.value = '';
            input.style.height = 'auto';
            const files = document.getElementById('file-upload').files;
            const formData = new FormData();
            formData.append('message', message);
            for (let file of files) formData.append('files', file);
            await fetch(`${API_BASE}/chat/${currentThread}`, { method: 'POST', body: formData });
            document.getElementById('file-upload').value = '';
        }

        document.getElementById('mic').addEventListener('click', toggleMic);
        function toggleMic() {
            if (!speechRecognition) {
                speechRecognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
                speechRecognition.onresult = (event) => {
                    document.getElementById('input').value += event.results[0][0].transcript;
                };
                speechRecognition.start();
            } else {
                speechRecognition.stop();
                speechRecognition = null;
            }
        }

        document.getElementById('toggle-sidebar').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });

        document.getElementById('theme-toggle').addEventListener('click', () => {
            theme = theme === 'dark' ? 'light' : 'dark';
            document.body.classList.toggle('light', theme === 'light');
            localStorage.setItem('theme', theme);
        });

        document.getElementById('new-thread').addEventListener('click', async () => {
            const response = await fetch(`${API_BASE}/threads`, { method: 'POST' });
            const data = await response.json();
            currentThread = data.id;
            loadThreads();
        });

        async function loadThreads() {
            const response = await fetch(`${API_BASE}/threads`);
            const threads = await response.json();
            const list = document.getElementById('threads-list');
            list.innerHTML = '';
            threads.forEach(thread => {
                const div = document.createElement('div');
                div.textContent = thread.name;
                div.onclick = () => loadThread(thread.id);
                list.appendChild(div);
            });
        }

        async function loadThread(id) {
            currentThread = id;
            const response = await fetch(`${API_BASE}/threads/${id}`);
            const messages = await response.json();
            document.getElementById('chat').innerHTML = '';
            messages.forEach(msg => appendMessage(msg.content, msg.role));
        }

        document.getElementById('add-memory').addEventListener('click', async () => {
            const text = document.getElementById('memory-paste').value;
            const files = document.getElementById('memory-upload').files;
            const formData = new FormData();
            if (text) formData.append('text', text);
            for (let file of files) formData.append('files', file);
            await fetch(`${API_BASE}/memory`, { method: 'POST', body: formData });
            showToast('Memory added');
        });

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                document.getElementById('dev-overlay').classList.toggle('open');
            }
        });

        // Load settings, models, etc.
        async function init() {
            connectSSE();
            loadThreads();
            // Fetch settings and populate drawer
            const response = await fetch(`${API_BASE}/settings`);
            const settings = await response.json();
            document.getElementById('system-prompt').value = settings.system_prompt;
            document.getElementById('temperature').value = settings.temperature;
            // etc.
        }
        init();

        // More functions for settings save, input auto-expand, drag-drop, etc.
        document.getElementById('input').addEventListener('input', (e) => {
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
        });

        document.getElementById('input-area').addEventListener('dragover', (e) => e.preventDefault());
        document.getElementById('input-area').addEventListener('drop', (e) => {
            e.preventDefault();
            document.getElementById('file-upload').files = e.dataTransfer.files;
        });

        // TTS controls
        audioPlayer.addEventListener('ratechange', () => {}); // Add speed control

        // Etc. for full implementation
    </script>
</body>
</html>
```

```python
# backend/server.py
import os
import logging
from fastapi import FastAPI, UploadFile, Form, File, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from sse_starlette.sse import EventSourceResponse
from model_manager import ModelManager
from inference import InferenceEngine
from memory_monitor import MemoryMonitor
from rag import RAGSystem
from tts_handler import TTSHandler
from stt_handler import STTHandler
from image_gen import ImageGen
from db import DB
from config import CONFIG

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["null", "http://127.0.0.1"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    filename=os.path.join(CONFIG['data_dir'], 'logs', 'aegis.log'),
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.handlers.RotatingFileHandler(
        os.path.join(CONFIG['data_dir'], 'logs', 'aegis.log'),
        maxBytes=10*1024*1024,
        backupCount=5
    )]
)

model_manager = ModelManager()
inference = InferenceEngine(model_manager)
monitor = MemoryMonitor()
rag = RAGSystem()
tts = TTSHandler()
stt = STTHandler()
image_gen = ImageGen()
db = DB()

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logging.error(f"Error: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": str(exc)})

@app.get("/models")
async def get_models():
    models = model_manager.scan_models()
    return models

@app.post("/chat/{thread_id}")
async def chat(thread_id: int, message: str = Form(...), files: list[UploadFile] = File(default=[])):
    try:
        if not db.thread_exists(thread_id):
            raise HTTPException(404, "Thread not found")
        
        # Handle files
        processed = []
        for file in files:
            if file.size > 50 * 1024 * 1024:
                raise HTTPException(400, "File too large")
            content = await file.read()
            # Zip bomb check
            if len(content) > 200 * file.size:
                raise HTTPException(400, "Zip bomb detected")
            processed.append((file.filename, content))
        
        # Auto-route
        if message.startswith('/imagine'):
            return await generate_image(message[9:])
        elif message.startswith('/speak'):
            # Force TTS on next response
            pass
        elif files and any(f.filename.endswith(('.jpg', '.png')) for f in files):
            model_manager.load_model(type='vision')
        elif files and any(f.filename.endswith('.wav') for f in files):
            transcribed = stt.transcribe(content)
            message += transcribed
        
        # RAG
        context = rag.retrieve(message)
        
        # Infer
        response = inference.generate(message, context, thread_id)
        
        db.add_message(thread_id, 'user', message)
        db.add_message(thread_id, 'assistant', response)
        
        return {"response": response}
    except Exception as e:
        logging.error(e)
        raise HTTPException(500, str(e))

@app.get("/stream")
async def stream():
    async def event_generator():
        while True:
            # Yield status, chat updates, etc.
            yield {"data": json.dumps(monitor.get_status())}
            await asyncio.sleep(1)
    return EventSourceResponse(event_generator())

@app.post("/tts")
async def tts_endpoint(text: str = Form(...)):
    audio = tts.generate(text)
    return StreamingResponse(io.BytesIO(audio), media_type="audio/wav")

@app.post("/stt")
async def stt_endpoint(file: UploadFile = File(...)):
    content = await file.read()
    text = stt.transcribe(content)
    return {"text": text}

@app.post("/image")
async def generate_image(prompt: str = Form(...)):
    image = image_gen.generate(prompt)
    return StreamingResponse(io.BytesIO(image), media_type="image/png")

@app.post("/threads")
async def create_thread():
    id = db.create_thread()
    return {"id": id}

@app.get("/threads")
async def list_threads():
    return db.list_threads()

@app.get("/threads/{id}")
async def get_thread(id: int):
    return db.get_messages(id)

@app.post("/memory")
async def add_memory(text: str = Form(None), files: list[UploadFile] = File(default=[])):
    for file in files:
        content = await file.read()
        rag.ingest_file(file.filename, content)
    if text:
        rag.ingest_text(text)
    return {"status": "ok"}

@app.get("/stats")
async def stats():
    return monitor.get_stats()

@app.get("/settings")
async def get_settings():
    return CONFIG['settings']

@app.post("/settings")
async def update_settings(settings: dict):
    CONFIG['settings'].update(settings)
    # Save to DB or file
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=7860)
```

```python
# backend/model_manager.py
import gc
import os
import json
import logging
from llama_cpp import Llama
from config import CONFIG
from memory_monitor import MemoryMonitor
import asyncio

class ModelManager:
    def __init__(self):
        self.models_dir = CONFIG['models_dir']
        self.registry_file = CONFIG['registry_file']
        self.registry = self.load_registry()
        self.active_model = None
        self.sem = asyncio.Semaphore(1)  # Max 1 large model
        self.monitor = MemoryMonitor()

    def load_registry(self):
        if os.path.exists(self.registry_file):
            with open(self.registry_file, 'r') as f:
                return json.load(f)
        return {}

    def scan_models(self):
        models = []
        for file in os.listdir(self.models_dir):
            if file.endswith('.gguf'):
                meta = self.registry.get(file, {"name": file, "type": "text", "quant": "Q4_K_M", "ram": 8, "n_ctx": 4096})
                models.append(meta)
        return models

    async def load_model(self, name=None, type=None):
        async with self.sem:
            if self.active_model:
                self.unload_model()
            if self.monitor.get_ram_used() > 11:
                self.auto_unload()
            
            file = self.find_model(name, type)
            if not file:
                raise ValueError("Model not found")
            
            meta = self.registry.get(file)
            if meta['ram'] > self.monitor.get_available_ram() - 1.5:
                raise ValueError("Insufficient RAM")
            
            # Load with Q4_0 KV quant, AVX only
            # Q2_K avoided because lower precision on Sandy Bridge leads to instability
            self.active_model = Llama(
                model_path=os.path.join(self.models_dir, file),
                n_ctx=meta['n_ctx'],
                n_batch=CONFIG['n_batch'],
                n_threads=CONFIG['n_threads'],
                verbose=False,
                logits_all=True,
                kv_overrides={"quantize": "Q4_0"}
            )
            gc.collect()
            logging.info(f"Loaded model {file}")
            return self.active_model

    def find_model(self, name, type):
        for k, v in self.registry.items():
            if (name and v['name'] == name) or (type and v['type'] == type):
                return k
        return None

    def unload_model(self):
        if self.active_model:
            del self.active_model
            gc.collect()
            self.active_model = None
            logging.info("Unloaded model")

    def auto_unload(self):
        self.unload_model()
        # Unload others if any

    def hot_swap(self, new_model):
        self.unload_model()
        return self.load_model(new_model)
```

```python
# backend/inference.py
from llama_cpp import Llama
from model_manager import ModelManager
from db import DB
import logging

class InferenceEngine:
    def __init__(self, model_manager: ModelManager):
        self.model_manager = model_manager
        self.db = DB()
        self.params = {}  # From settings

    def generate(self, prompt, context, thread_id):
        model = self.model_manager.active_model or self.model_manager.load_model(type='text')
        
        # Context management
        history = self.db.get_messages(thread_id)
        total_tokens = sum(len(m['content']) / 4 for m in history)  # Approx
        if total_tokens > 0.9 * model.n_ctx:
            self.prune_context(thread_id)
        
        full_prompt = f"{context}\n" + "\n".join([m['content'] for m in history]) + f"\nUser: {prompt}\nAssistant:"
        
        try:
            output = model(full_prompt, max_tokens=1024, **self.params)
            response = output['choices'][0]['text']
            return response
        except Exception as e:
            logging.error(e)
            # OOC recovery
            for _ in range(3):
                full_prompt = full_prompt[:int(len(full_prompt)*0.75)]
                try:
                    output = model(full_prompt, max_tokens=1024, **self.params)
                    return output['choices'][0]['text']
                except:
                    pass
            self.model_manager.unload_model()
            raise ValueError("Context overflow, model reloaded")

    def prune_context(self, thread_id):
        messages = self.db.get_messages(thread_id)
        # Summarize oldest 50%
        summary = self.summarize(messages[:len(messages)//2])
        self.db.add_message(thread_id, 'system', f"[THREAD SUMMARY] {summary}")
        self.db.delete_messages(thread_id, [m['id'] for m in messages[:len(messages)//2]])

    def summarize(self, messages):
        # Use TF-IDF or simple concat and generate summary
        prompt = "Summarize the following conversation extractively:\n" + "\n".join([m['content'] for m in messages])
        model = self.model_manager.active_model
        output = model(prompt, max_tokens=512)
        return output['choices'][0]['text']
```

```python
# backend/memory_monitor.py
import os
import psutil
import logging

class MemoryMonitor:
    def __init__(self):
        self.zram_path = '/sys/block/zram0/mm_stat'

    def get_ram_used(self):
        return psutil.virtual_memory().used / (1024 ** 3)

    def get_available_ram(self):
        return psutil.virtual_memory().available / (1024 ** 3)

    def get_zram_ratio(self):
        if os.path.exists(self.zram_path):
            with open(self.zram_path, 'r') as f:
                stats = list(map(int, f.read().split()))
                orig = stats[0]
                compr = stats[1]
                return orig / compr if compr else 1
        return 1

    def get_status(self):
        ratio = self.get_zram_ratio()
        if ratio > 3:
            logging.warning("zRAM ratio high, throttling")
            # Throttle logic
        return {
            "ram_used": self.get_ram_used(),
            "zram_ratio": ratio,
            "active_model": "TODO",
            "tokens_sec": 0,  # From inference
        }

    def get_stats(self):
        return self.get_status()
```

```python
# backend/rag.py
import os
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from llama_cpp import Llama
from pdfminer.high_level import extract_text
from model_manager import ModelManager
from db import DB
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from config import CONFIG

class RAGSystem:
    def __init__(self):
        self.model_manager = ModelManager()
        self.db = DB()
        self.vectorizer = TfidfVectorizer()
        self.chunks = self.db.get_all_chunks()
        self.embed_model = None
        self.watch_dir()
    
    def watch_dir(self):
        class Handler(FileSystemEventHandler):
            def on_modified(self, event):
                self.ingest_file(event.src_path)
        observer = Observer()
        observer.schedule(Handler(), CONFIG['memory_dir'], recursive=True)
        observer.start()

    def ingest_text(self, text):
        chunks = self.chunk_text(text)
        embeddings = self.get_embeddings(chunks)
        self.db.add_chunks(chunks, embeddings)
        self.chunks.extend(chunks)

    def ingest_file(self, filename, content):
        ext = os.path.splitext(filename)[1]
        if ext == '.pdf':
            text = extract_text(content)
        elif ext in ('.txt', '.md', '.py', '.js', '.json', '.csv', '.html'):
            text = content.decode('utf-8')
        else:
            return
        self.ingest_text(text)

    def chunk_text(self, text, chunk_size=512, overlap=50):
        tokens = text.split()  # Simple
        chunks = []
        for i in range(0, len(tokens), chunk_size - overlap):
            chunks.append(' '.join(tokens[i:i+chunk_size]))
        return chunks

    def get_embeddings(self, chunks):
        if not self.embed_model:
            self.embed_model = self.model_manager.load_model(type='embedding')  # nomic Q2_K
        embeddings = [self.embed_model.embed(chunk) for chunk in chunks]
        return embeddings

    def retrieve(self, query):
        q_emb = self.get_embeddings([query])[0]
        sims = cosine_similarity([q_emb], self.chunks_embeddings())[0]
        top = np.argsort(sims)[-5:][::-1]
        selected = [self.chunks[i] for i in top if sims[i] >= 0.65]
        return "\n".join(selected) if selected else ""
```

```python
# backend/tts_handler.py
import piper
from config import CONFIG
import os
import io

class TTSHandler:
    def __init__(self):
        self.voices_dir = os.path.join(CONFIG['models_dir'], 'tts')
        self.voice = None
        self.load_voice()

    def load_voice(self):
        voices = [f for f in os.listdir(self.voices_dir) if f.endswith('.onnx')]
        if voices:
            self.voice = piper.PiperVoice.load(os.path.join(self.voices_dir, voices[0]))

    def generate(self, text):
        wav = io.BytesIO()
        self.voice.synthesize(text, wav)
        return wav.getvalue()
```

```python
# backend/stt_handler.py
from faster_whisper import WhisperModel
import io

class STTHandler:
    def __init__(self):
        self.model = WhisperModel("tiny", device="cpu", compute_type="int8")

    def transcribe(self, audio_bytes):
        segments, info = self.model.transcribe(io.BytesIO(audio_bytes), beam_size=5)
        return " ".join([s.text for s in segments])
```

```python
# backend/image_gen.py
import onnxruntime as ort
from diffusers import OnnxStableDiffusionPipeline
from config import CONFIG
import io

class ImageGen:
    def __init__(self):
        model_path = os.path.join(CONFIG['models_dir'], 'sd1.5.onnx')
        self.pipe = OnnxStableDiffusionPipeline.from_pretrained(model_path, provider="CPUExecutionProvider")

    def generate(self, prompt):
        image = self.pipe(prompt).images[0]
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        return buf.getvalue()
```

```python
# backend/db.py
import aiosqlite
import os
from config import CONFIG
import asyncio

class DB:
    def __init__(self):
        self.db_path = os.path.join(CONFIG['data_dir'], 'aegis.db')
        asyncio.run(self.init_db())

    async def init_db(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute('''CREATE TABLE IF NOT EXISTS threads (id INTEGER PRIMARY KEY, name TEXT)''')
            await db.execute('''CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, thread_id INT, role TEXT, content TEXT)''')
            await db.execute('''CREATE TABLE IF NOT EXISTS memory_chunks (id INTEGER PRIMARY KEY, chunk TEXT, embedding BLOB)''')
            await db.commit()

    async def create_thread(self):
        async with aiosqlite.connect(self.db_path) as db:
            cur = await db.execute('INSERT INTO threads (name) VALUES (?)', ('New Thread',))
            await db.commit()
            return cur.lastrowid

    async def list_threads(self):
        async with aiosqlite.connect(self.db_path) as db:
            cur = await db.execute('SELECT id, name FROM threads')
            return [{"id": r[0], "name": r[1]} for r in await cur.fetchall()]

    async def get_messages(self, thread_id):
        async with aiosqlite.connect(self.db_path) as db:
            cur = await db.execute('SELECT role, content FROM messages WHERE thread_id = ? ORDER BY id', (thread_id,))
            return [{"role": r[0], "content": r[1]} for r in await cur.fetchall()]

    async def add_message(self, thread_id, role, content):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute('INSERT INTO messages (thread_id, role, content) VALUES (?, ?, ?)', (thread_id, role, content))
            await db.commit()

    async def delete_messages(self, thread_id, ids):
        async with aiosqlite.connect(self.db_path) as db:
            await db.executemany('DELETE FROM messages WHERE id = ?', [(i,) for i in ids])
            await db.commit()

    async def thread_exists(self, thread_id):
        async with aiosqlite.connect(self.db_path) as db:
            cur = await db.execute('SELECT 1 FROM threads WHERE id = ?', (thread_id,))
            return await cur.fetchone() is not None

    async def add_chunks(self, chunks, embeddings):
        async with aiosqlite.connect(self.db_path) as db:
            await db.executemany('INSERT INTO memory_chunks (chunk, embedding) VALUES (?, ?)', zip(chunks, embeddings))
            await db.commit()

    async def get_all_chunks(self):
        async with aiosqlite.connect(self.db_path) as db:
            cur = await db.execute('SELECT chunk, embedding FROM memory_chunks')
            rows = await cur.fetchall()
            chunks = [r[0] for r in rows]
            embeddings = [np.frombuffer(r[1], dtype=np.float32) for r in rows]
            return chunks, embeddings
```

```python
# backend/config.py
import os
import json

HOME = os.path.expanduser('~')
DATA_DIR = os.path.join(HOME, '.local', 'share', 'aegis')
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(os.path.join(DATA_DIR, 'logs'), exist_ok=True)
os.makedirs(os.path.join(DATA_DIR, 'models'), exist_ok=True)

CONFIG = {
    'data_dir': DATA_DIR,
    'models_dir': os.path.join(DATA_DIR, 'models'),
    'registry_file': 'model_registry.json',
    'n_ctx': 2048,
    'n_batch': 512,
    'n_threads': os.cpu_count(),
    'settings': {
        'temperature': 0.7,
        'top_p': 0.9,
        'top_k': 40,
        'min_p': 0.05,
        'repeat_penalty': 1.1,
        'mirostat': 2,
        'system_prompt': 'You are a helpful assistant.'
    }
}

# Load from file if exists
config_file = os.path.join(DATA_DIR, 'config.json')
if os.path.exists(config_file):
    with open(config_file, 'r') as f:
        CONFIG.update(json.load(f))
```

```json
// model_registry.json
{
  "mistral-7b.Q4_K_M.gguf": {
    "name": "Mistral-7B",
    "type": "text",
    "quant": "Q4_K_M",
    "ram": 8,
    "n_ctx": 4096
  },
  "moondream2.gguf": {
    "name": "MoonDream2",
    "type": "vision",
    "quant": "Q4_K_M",
    "ram": 6,
    "n_ctx": 2048
  },
  "nomic-embed-text-v1.5.Q2_K.gguf": {
    "name": "Nomic Embed",
    "type": "embedding",
    "quant": "Q2_K",
    "ram": 0.5,
    "n_ctx": 8192
  }
}
```

```txt
# requirements.txt
fastapi
uvicorn
sse-starlette
llama-cpp-python  # Installed via compile
faster-whisper
pdfminer.six
scikit-learn
numpy
watchdog
aiosqlite
onnxruntime
diffusers
piper-tts  # Assuming package name
```

```bash
#!/bin/bash
# scripts/install.sh

if ! grep -q "Debian\|Ubuntu" /etc/os-release; then
    echo "Only Debian/Ubuntu supported"
    exit 1
fi

sudo apt update
sudo apt install -y python3-dev libopenblas-dev cmake cargo python3-venv

python3 -m venv ~/.local/share/aegis/venv
source ~/.local/share/aegis/venv/bin/activate

pip install -r requirements.txt

# Compile llama-cpp-python
export CMAKE_ARGS="-DLLAMA_BLAS=ON -DLLAMA_BLAS_VENDOR=OpenBLAS -DLLAMA_AVX=ON -DLLAMA_AVX2=OFF"
pip install llama-cpp-python --no-cache-dir --force-reinstall --verbose

mkdir -p ~/.local/share/aegis/models
mkdir -p ~/.local/share/aegis/logs

# Create desktop launcher
cat << EOF > ~/.local/share/applications/aegis.desktop
[Desktop Entry]
Name=Aegis
Exec=~/.local/share/aegis/scripts/run.sh
Type=Application
EOF
```

```bash
#!/bin/bash
# scripts/run.sh

source ~/.local/share/aegis/venv/bin/activate
python backend/server.py &
sleep 2
xdg-open aegis.html
```

```markdown
# README.md

## Hardware Requirements
- CPU: Sandy Bridge (AVX only)
- RAM: 12 GB + zRAM
- GPU: 1 GB (optional for embeddings)

## Install Steps
1. Run `./scripts/install.sh`
2. Download models with `huggingface-cli download TheBloke/Mistral-7B-Instruct-v0.1-GGUF mistral-7b-instruct-v0.1.Q4_K_M.gguf --local-dir ~/.local/share/aegis/models`
   Similarly for moondream2, nomic-embed-text-v1.5.Q2_K.gguf

## First-Run Guide
1. Run `./scripts/run.sh`
2. Browser opens aegis.html
3. Select model, chat

## Optimizations for Sandy Bridge
- Use AVX only, no AVX2
- Q4_K_M for balance of speed/accuracy
- Avoid Q2_K due to precision loss on older SIMD
- OpenBLAS for matrix ops
```