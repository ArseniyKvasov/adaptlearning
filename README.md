# Adaptive Learning App (FastAPI)

## Что сделано
- Backend полностью на FastAPI.
- Автоматическое создание `guest user` при первом входе.
- История генераций хранится в SQLite и привязана к guest user.
- ML вынесен в отдельный сервис:
  - основное приложение режет файл на короткие WAV-чанки и отправляет их в `POST /transcribe-chunk`, затем опрашивает `GET /tasks/{job_id}`
  - объединённый анализ чанка делается через `POST /chunk-analyze`; из его результата берутся `key_points` для конспекта и сигналы для анализа речи преподавателя
  - старые `POST /mini-summary` и `POST /teacher-analysis` остаются совместимыми, но внутри опираются на общий `chunk-analyze`
  - `key_points` из всех чанков собираются в один массив и отправляются в `POST /lesson-summary`
  - тест генерируется через `POST /quiz`
  - открытые ответы проверяются через `POST /grade-open-answers`
- Конспект и тест генерируются в формате Markdown + LaTeX.
- Реализована проверка теста:
  - endpoint `POST /api/student/{generation_id}/check`
  - multiple_choice проверяется детерминированно
  - open_ended проверяется через ML-сервис

## Запуск локально
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```
Для локального запуска нужен установленный `ffmpeg`.

## Docker
```bash
docker compose up -d --build
```

## URL
- Teacher: `http://localhost:8090/teacher/index.html`
- Student: `http://localhost:8090/material/<id>/`

## ENV
Используйте `.env.example` как шаблон.
Обязательные переменные: `ML_URL`, `ML_API_KEY`.
