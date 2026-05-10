# ML Service API Contract

Этот документ описывает контракт между основным приложением и отдельным ML-сервисом.
Сервис отвечает только за ML-операции: транскрибацию, мини-конспекты, итоговый конспект, генерацию теста и проверку открытых ответов.

## Общие правила

- Все endpoints, кроме `GET /health`, защищены заголовком:
  `Authorization: Bearer <ML_API_KEY>`
- Все текстовые поля и ответы сервиса — на русском языке.
- Формат данных — JSON.
- В ответах не должно быть пустых сущностей, если поле по смыслу обязательно.
- Для ошибок используется единый формат ответа.

### Формат ошибки

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Некорректный формат запроса."
  }
}
```

## Endpoints

### `GET /health`
Проверка доступности сервиса.

Request: нет

Response:
```json
{
  "ok": true,
  "service": "ml",
  "version": "1.0.0"
}
```

---

### `POST /transcribe-chunk`
Постановка задачи на транскрибацию одного аудио- или видео-чанка.

Request: `multipart/form-data`

Поля:
- `chunk_id` integer, required
- `start_ms` integer, required
- `end_ms` integer, required
- `audio_file` binary file, required

Пример:
```bash
curl -X POST "http://localhost:8000/transcribe-chunk" \
  -H "X-API-Key: your_service_api_key_here" \
  -F "chunk_id=1" \
  -F "start_ms=0" \
  -F "end_ms=15000" \
  -F "audio_file=@chunk_001.webm"
```

Response:
```json
{
  "job_id": "a1b2c3...",
  "task_type": "transcribe-chunk",
  "status": "queued"
}
```

---

### `POST /mini-summary`
Постановка задачи на мини-конспект.

Request: как и раньше.

Response:
```json
{
  "job_id": "a1b2c3...",
  "task_type": "mini-summary",
  "status": "queued"
}
```

---

### `POST /lesson-summary`
Постановка задачи на итоговый конспект.

Request: как и раньше.

Response:
```json
{
  "job_id": "a1b2c3...",
  "task_type": "lesson-summary",
  "status": "queued"
}
```

---

### `POST /quiz`
Постановка задачи на генерацию теста.

Request: как и раньше.

Response:
```json
{
  "job_id": "a1b2c3...",
  "task_type": "quiz",
  "status": "queued"
}
```

---

### `POST /grade-open-answers`
Постановка задачи на проверку открытых ответов.

Request: как и раньше.

Response:
```json
{
  "job_id": "a1b2c3...",
  "task_type": "grade-open-answers",
  "status": "queued"
}
```

---

### `GET /tasks/{job_id}`
Проверка статуса фоновой задачи.

Response:
```json
{
  "job_id": "a1b2c3...",
  "task_type": "transcribe-chunk",
  "status": "succeeded",
  "created_at": "2026-05-10T12:00:00Z",
  "updated_at": "2026-05-10T12:00:07Z",
  "started_at": "2026-05-10T12:00:01Z",
  "finished_at": "2026-05-10T12:00:07Z",
  "result": {...},
  "error": null
}
```

Статусы:
- `queued`
- `running`
- `succeeded`
- `failed`

## Рекомендуемый поток использования

1. Основное приложение режет исходный файл на чанки.
2. Для каждого чанка вызывает `POST /transcribe-chunk` и затем опрашивает `GET /tasks/{job_id}` до `succeeded`.
3. Для каждой группы транскрипта вызывает `POST /mini-summary` и затем опрашивает `GET /tasks/{job_id}`.
4. После сбора всех mini-summary вызывает `POST /lesson-summary` и опрашивает задачу до готовности.
5. Затем вызывает `POST /quiz` и опрашивает задачу до готовности.
6. При проверке открытых ответов вызывает `POST /grade-open-answers` и опрашивает задачу до готовности.

## Что сервис не делает

- Не хранит пользовательские материалы.
- Не управляет авторизацией.
- Не хранит историю генераций.
- Не занимается web UI.
- Не делает orchestration всего пайплайна одним запросом.
