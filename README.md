# whisper-web

GPU 加速的自架影音轉錄服務，基於 [faster-whisper](https://github.com/SYSTRAN/faster-whisper)，支援繁體中文輸出。上傳影片或音訊，即時串流顯示逐字稿，並匯出 TXT / SRT 字幕檔。

## 功能

- 支援任意影片 / 音訊格式（ffmpeg 負責轉換）
- 即時 WebSocket 進度串流
- 簡繁轉換（opencc）
- 多 GPU 自動分配、任務佇列
- 暫停 / 繼續轉錄
- 批次下載（ZIP）
- 深色主題純 HTML/JS 前端，無框架依賴

## 需求

- Docker + Docker Compose
- NVIDIA GPU，驅動已安裝，支援 CUDA 12.1
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)

## 快速開始

```bash
git clone https://github.com/elvisdragonmao/whisper-web.git
cd whisper-web
docker compose up -d --build
```

開啟瀏覽器前往 `http://localhost:8000`。

轉錄結果與上傳檔案存放於 `./data/`（容器外掛載，重建容器不會遺失）。

## 設定

目前所有參數寫在 `app/worker.py` 的 `WhisperRunner` 內，可直接修改後重新 build：

| 參數 | 預設值 | 說明 |
|------|--------|------|
| `model_name` | `large-v3-turbo` | Whisper 模型 |
| `compute_type` | `float16` | 推論精度（`int8` 可降低 VRAM 用量） |
| `language` | `zh` | 辨識語言 |
| `beam_size` | `5` | Beam search 寬度 |
| `vad_filter` | `True` | 靜音過濾 |

## API

| Method | Path | 說明 |
|--------|------|------|
| `GET` | `/` | 前端介面 |
| `GET` | `/jobs` | 列出所有任務 |
| `GET` | `/gpus` | GPU 狀態 |
| `POST` | `/upload` | 上傳並開始轉錄（`file`, `traditional` form fields） |
| `GET` | `/download/{job_id}.{ext}` | 下載結果（`txt` 或 `srt`） |
| `GET` | `/download-batch?job_ids=...` | 批次下載 ZIP |
| `DELETE` | `/job/{job_id}` | 刪除任務與檔案 |
| `POST` | `/job/{job_id}/pause` | 暫停 |
| `POST` | `/job/{job_id}/resume` | 繼續（建立新任務） |
| `WS` | `/ws/{job_id}` | 即時轉錄事件串流 |

## 開發

### 環境設定

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pre-commit install
```

### 常用指令

```bash
make fix      # 自動修正 lint + 格式化
make check    # CI 用，只檢查不修改
```

## 架構

```
whisper-web/
├── app/
│   ├── main.py                 # FastAPI 應用程式（路由、GPU 池、任務管理）
│   ├── worker.py               # WhisperRunner（音訊轉換、推論、輸出檔案）
│   ├── whisper_worker_entry.py # Worker subprocess 進入點
│   ├── requirements.txt        # Python 執行依賴
│   └── static/
│       ├── index.html
│       ├── app.js
│       └── style.css
├── Dockerfile
├── docker-compose.yml
├── pyproject.toml
├── Makefile
└── .pre-commit-config.yaml
```

每個轉錄任務在獨立的 subprocess 中執行，由父程式透過 `CUDA_VISIBLE_DEVICES` 控制 GPU 分配。Subprocess 以 JSON Lines 格式將 `segment` / `done` / `error` / `paused` 事件寫到 stdout，父程式讀取後透過 WebSocket 轉送給前端。

## License

Apache 2.0
