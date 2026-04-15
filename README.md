# Adaptive Learning Prototype

## Quick Start (Docker)
```bash
docker compose up -d --build
```

Available locally:
- `http://localhost:8090/teacher/template.html`
- `http://localhost:8090/student/template.html`

## API Contract (Web Backend <-> ML Service)

### 1) Transcription (WebSocket)
**Endpoint (web backend -> ML service):**
- `ML_WS_URL/transcriber/ws/transcribe`

**Request payload (web backend -> ML service):**
- Session initialization:
```json
{"type":"init","config":{"language":null}}
```
- Binary audio stream (`bytes`)
- Control commands:
```json
{"type":"ping"}
{"type":"end"}
{"type":"cancel"}
```

**Response payload (ML service -> web backend):**
- `init_ack`
- `language_info`
- `transcript`
- `pong`
- `cancel_ack`
- `error`

**Response variants (ML service -> web backend):**

1. Init success
```json
{"type":"init_ack","status":"ready","session_id":"123"}
```
2. Language detection
```json
{"type":"language_info","detected_language":"en","confidence":0.98}
```
3. Transcript chunk
```json
{"type":"transcript","start_ms":0,"end_ms":2500,"text":"Hello","is_final":true}
```
4. Ping response
```json
{"type":"pong"}
```
5. Cancel acknowledgement
```json
{"type":"cancel_ack","status":"cancelled"}
```
6. ML processing error
```json
{"type":"error","code":"WHISPER_ERROR","message":"..."}
```

**Connection-level failure variants (must be handled by web backend):**

1. ML unavailable during websocket connect:
```json
{"type":"error","code":"ML_UNAVAILABLE"}
```
2. ML websocket disconnected during active session:
```json
{"type":"error","code":"ML_DISCONNECTED"}
```
3. Timeout while waiting ML websocket data:
```json
{"type":"error","code":"TIMEOUT"}
```

### 2) Summary Generation (HTTP)
**Endpoint (web backend -> ML service):**
- `POST http://178.253.39.234/summary/summarize`
- `GET  http://178.253.39.234/summary/health`

**Request payload (web backend -> ML service):**
```json
{
  "transcript": [
    {"start_ms": 0, "text": "..."}
  ]
}
```

**Response payload (ML service -> web backend):**
Success:
```json
{
  "summary": [
    {"subtopic": "...", "content": "..."}
  ]
}
```

**Response variants (ML service -> web backend):**

1. Success (`200 OK`)
```json
{
  "summary": [
    {"subtopic": "...", "content": "..."}
  ]
}
```
2. ML business error (`4xx/5xx`)
```json
{"type":"error","code":"SUMMARY_ERROR","message":"..."}
```
3. Healthcheck response (`GET /summary/health`, `200 OK`)
```json
{"status":"ok","llm_available":true}
```
or
```json
{"status":"degraded","llm_available":false}
```
4. Timeout (client-side, 60s): request is treated as failed by web backend.

### 3) Test Generation (HTTP)
**Endpoint (web backend -> ML service):**
- `POST http://178.253.39.234/test/generate`
- `GET  http://178.253.39.234/test/health`

**Request payload (web backend -> ML service):**
```json
{
  "summary": [
    {"subtopic": "...", "content": "..."}
  ]
}
```

**Response payload (ML service -> web backend):**
Success:
```json
{
  "test": [
    {
      "question_text": "...",
      "question_type": "multiple_choice",
      "options": ["..."],
      "correct_answer": 0,
      "explanation": "...",
      "subtopic": "..."
    }
  ]
}
```

**Response variants (ML service -> web backend):**

1. Success (`200 OK`)
```json
{
  "test": [
    {
      "question_text": "...",
      "question_type": "multiple_choice",
      "options": ["..."],
      "correct_answer": 0,
      "explanation": "...",
      "subtopic": "..."
    }
  ]
}
```
2. ML business error (`4xx/5xx`)
```json
{"type":"error","code":"TEST_GENERATION_ERROR","message":"..."}
```
3. Healthcheck response (`GET /test/health`, `200 OK`)
```json
{"status":"ok","llm_available":true}
```
or
```json
{"status":"degraded","llm_available":false}
```
4. Timeout (client-side, 180s): request is treated as failed by web backend.

### 4) Analytics / Answer Checking (HTTP)
**Endpoint (web backend -> ML service):**
- `POST http://178.253.39.234/test/check/`

**Request payload (web backend -> ML service):**
```json
{
  "answers": [
    {
      "question_id": "q_1",
      "question_type": "multiple_choice",
      "subtopic": "Тема",
      "is_correct": true
    },
    {
      "question_id": "q_2",
      "question_type": "open_question",
      "subtopic": "Тема",
      "question_text": "Вопрос",
      "correct_answer": "Правильный ответ",
      "student_answer": "Ответ ученика"
    }
  ]
}
```

**Evaluation logic (ML service):**
- `multiple_choice`: ML maps `is_correct` -> `score` (`true -> 1`, `false -> 0`)
- `open_question`: ML compares `student_answer` with `correct_answer` and returns `score`

**Response payload (ML service -> web backend):**
Success:
```json
{
  "results": [
    {
      "question_id": "q_1",
      "subtopic": "Тема",
      "score": 1
    },
    {
      "question_id": "q_2",
      "subtopic": "Тема",
      "score": 0
    }
  ],
  "recommendation": "Повторите подтему «Тема»."
}
```

**Score mapping:**
- `0` = incorrect
- `1` = correct

**Response variants (ML service -> web backend):**

1. Success (`200 OK`)
```json
{
  "results": [
    {
      "question_id": "q_1",
      "subtopic": "Тема",
      "score": 1
    }
  ],
  "recommendation": "..."
}
```
2. Validation error (`400 Bad Request`)
```json
{
  "error": "validation_error",
  "message": "..."
}
```
3. Internal ML error (`500 Internal Server Error`)
```json
{
  "error": "internal_error",
  "message": "..."
}
```
4. Model unavailable (`503 Service Unavailable`)
```json
{
  "error": "model_unavailable",
  "message": "..."
}
```
