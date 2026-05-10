import asyncio
import os
import time
from typing import Any, Optional

import httpx


class MLServiceError(Exception):
    def __init__(self, message: str, user_message: str) -> None:
        super().__init__(message)
        self.user_message = user_message


class MLServiceClient:
    def __init__(self, api_key: str, base_url: str = "https://ml.fastclass.ru") -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    def _headers(self, *, include_content_type: bool = True) -> dict[str, str]:
        if not self.api_key:
            raise MLServiceError("ML_API_KEY missing", "Не настроен ключ доступа к ML-сервису.")
        headers = {
            "X-API-Key": self.api_key,
        }
        if include_content_type:
            headers["Content-Type"] = "application/json"
        return headers

    @staticmethod
    def _http_user_message(status_code: int) -> str:
        if status_code == 429:
            return "ML-сервис временно перегружен. Попробуйте повторить запуск через минуту."
        if status_code in (401, 403):
            return "ML-сервис отклонил доступ. Проверьте настройки ключа."
        if status_code >= 500:
            return "ML-сервис временно недоступен. Попробуйте позже."
        return "Не удалось обработать запрос к ML-сервису."

    @staticmethod
    def _response_error_message(payload: Any) -> str:
        if isinstance(payload, dict):
            error = payload.get("error")
            if isinstance(error, dict):
                message = error.get("message")
                if isinstance(message, str) and message.strip():
                    return message.strip()
        return ""

    @staticmethod
    def _task_error_message(task: Any) -> str:
        if isinstance(task, dict):
            error = task.get("error")
            if isinstance(error, dict):
                message = error.get("message")
                if isinstance(message, str) and message.strip():
                    return message.strip()
            if isinstance(error, str) and error.strip():
                return error.strip()
        return ""

    @staticmethod
    def _task_result(task: Any) -> dict[str, Any]:
        if isinstance(task, dict):
            result = task.get("result")
            if isinstance(result, dict):
                return result
            return task
        return {}

    async def _post_json(self, path: str, payload: dict[str, Any], timeout_s: int) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=timeout_s) as client:
                resp = await client.post(url, headers=self._headers(), json=payload)
        except httpx.HTTPError as exc:
            raise MLServiceError(f"ML request failed: {exc}", "Не удалось связаться с ML-сервисом. Попробуйте позже.") from exc

        try:
            data = resp.json()
        except ValueError as exc:
            raise MLServiceError(
                f"ML returned invalid JSON ({resp.status_code}): {resp.text[:500]}",
                self._http_user_message(resp.status_code),
            ) from exc

        if resp.status_code >= 400:
            message = self._response_error_message(data) or self._http_user_message(resp.status_code)
            raise MLServiceError(f"ML HTTP error ({resp.status_code}): {data}", message)

        if not isinstance(data, dict):
            raise MLServiceError("ML response root is not an object", "Сервис вернул некорректный ответ.")
        return data

    async def _submit_task(self, path: str, payload: dict[str, Any], timeout_s: int) -> dict[str, Any]:
        task = await self._post_json(path, payload, timeout_s=timeout_s)
        job_id = task.get("job_id")
        task_type = task.get("task_type")
        status = task.get("status")
        if not isinstance(job_id, str) or not job_id.strip():
            raise MLServiceError("ML task response has no job_id", "Сервис вернул некорректную задачу. Попробуйте позже.")
        if not isinstance(task_type, str) or not task_type.strip():
            raise MLServiceError("ML task response has no task_type", "Сервис вернул некорректную задачу. Попробуйте позже.")
        if not isinstance(status, str) or not status.strip():
            raise MLServiceError("ML task response has no status", "Сервис вернул некорректную задачу. Попробуйте позже.")
        return task

    async def _submit_multipart_task(
        self,
        path: str,
        data: dict[str, Any],
        files: dict[str, tuple[str, bytes, str]],
        timeout_s: int,
    ) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=timeout_s) as client:
                resp = await client.post(url, headers=self._headers(include_content_type=False), data=data, files=files)
        except httpx.HTTPError as exc:
            raise MLServiceError(f"ML request failed: {exc}", "Не удалось связаться с ML-сервисом. Попробуйте позже.") from exc

        try:
            payload = resp.json()
        except ValueError as exc:
            raise MLServiceError(
                f"ML returned invalid JSON ({resp.status_code}): {resp.text[:500]}",
                self._http_user_message(resp.status_code),
            ) from exc

        if resp.status_code >= 400:
            message = self._response_error_message(payload) or self._http_user_message(resp.status_code)
            raise MLServiceError(f"ML HTTP error ({resp.status_code}): {payload}", message)

        if not isinstance(payload, dict):
            raise MLServiceError("ML response root is not an object", "Сервис вернул некорректный ответ.")

        job_id = payload.get("job_id")
        task_type = payload.get("task_type")
        status = payload.get("status")
        if not isinstance(job_id, str) or not job_id.strip():
            raise MLServiceError("ML task response has no job_id", "Сервис вернул некорректную задачу. Попробуйте позже.")
        if not isinstance(task_type, str) or not task_type.strip():
            raise MLServiceError("ML task response has no task_type", "Сервис вернул некорректную задачу. Попробуйте позже.")
        if not isinstance(status, str) or not status.strip():
            raise MLServiceError("ML task response has no status", "Сервис вернул некорректную задачу. Попробуйте позже.")
        return payload

    async def _get_task(self, job_id: str, timeout_s: int) -> dict[str, Any]:
        url = f"{self.base_url}/tasks/{job_id}"
        try:
            async with httpx.AsyncClient(timeout=timeout_s) as client:
                resp = await client.get(url, headers=self._headers())
        except httpx.HTTPError as exc:
            raise MLServiceError(f"ML task polling failed: {exc}", "Не удалось связаться с ML-сервисом. Попробуйте позже.") from exc

        try:
            data = resp.json()
        except ValueError as exc:
            raise MLServiceError(
                f"ML task returned invalid JSON ({resp.status_code}): {resp.text[:500]}",
                self._http_user_message(resp.status_code),
            ) from exc

        if resp.status_code >= 400:
            message = self._response_error_message(data) or self._http_user_message(resp.status_code)
            raise MLServiceError(f"ML task HTTP error ({resp.status_code}): {data}", message)

        if not isinstance(data, dict):
            raise MLServiceError("ML task response root is not an object", "Сервис вернул некорректный ответ.")
        return data

    async def _wait_for_task(self, task: dict[str, Any], timeout_s: int, poll_interval_s: float = 2.0) -> dict[str, Any]:
        job_id = str(task.get("job_id") or "").strip()
        task_type = str(task.get("task_type") or "").strip()
        deadline = time.monotonic() + timeout_s
        current = task

        while True:
            status = str(current.get("status") or "").strip().casefold()
            if status in {"succeeded", "failed"}:
                break
            if status not in {"queued", "running"}:
                raise MLServiceError(
                    f"ML task returned unexpected status: {current}",
                    "Сервис вернул некорректный статус задачи.",
                )
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise MLServiceError(
                    f"ML task timeout waiting for {task_type} ({job_id})",
                    "Превышено время ожидания ответа ML-сервиса. Попробуйте позже.",
                )
            await asyncio.sleep(min(poll_interval_s, max(0.2, remaining)))
            current = await self._get_task(job_id, timeout_s=min(30, max(1, int(remaining))))

        if str(current.get("status") or "").strip().casefold() == "failed":
            error_message = self._task_error_message(current) or "Не удалось выполнить задачу в ML-сервисе."
            raise MLServiceError(
                f"ML task failed ({task_type}, {job_id}): {current}",
                error_message,
            )
        return current

    async def transcribe_chunk(
        self,
        *,
        file_name: str,
        mime_type: str,
        audio_bytes: bytes,
        chunk_id: int,
        start_ms: int,
        end_ms: int,
    ) -> list[dict[str, Any]]:
        audio_preview = f"{len(audio_bytes)} bytes"
        if os.getenv("ML_DEBUG_TRANSCRIBE_REQUESTS", "0") == "1":
            print(
                "[ML transcribe_chunk] request payload",
                {
                    "file_name": file_name,
                    "mime_type": mime_type,
                    "chunk_id": chunk_id,
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                    "audio_file_preview": audio_preview,
                },
            )
        task = await self._submit_multipart_task(
            "/transcribe-chunk",
            data={
                "chunk_id": str(chunk_id),
                "start_ms": str(start_ms),
                "end_ms": str(end_ms),
            },
            files={
                "audio_file": (file_name, audio_bytes, mime_type),
            },
            timeout_s=300,
        )
        task = await self._wait_for_task(task, timeout_s=3600)
        data = self._task_result(task)
        transcript = data.get("transcript")
        if not isinstance(transcript, list) or not transcript:
            print(
                "[ML transcribe_chunk] unexpected response: transcript missing or empty",
                {
                    "file_name": file_name,
                    "chunk_id": chunk_id,
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                    "response": data,
                },
            )
            raise MLServiceError("Transcribe response has no transcript list", "Не удалось получить текст из аудио. Попробуйте другой файл.")

        normalized: list[dict[str, Any]] = []
        for item in transcript:
            if not isinstance(item, dict):
                continue
            text = str(item.get("text") or "").strip()
            if not text:
                continue
            try:
                start_value = int(item.get("start_ms", 0) or 0)
            except (TypeError, ValueError):
                start_value = 0
            normalized.append({"start_ms": start_value, "text": text})
        if not normalized:
            print(
                "[ML transcribe_chunk] unexpected response: transcript items have no usable text",
                {
                    "file_name": file_name,
                    "chunk_id": chunk_id,
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                    "response": data,
                    "transcript": transcript,
                },
            )
            raise MLServiceError("Transcribe response has no valid transcript items", "Не удалось получить текст из аудио. Попробуйте другой файл.")
        return normalized

    async def make_mini_summary(self, chunk_transcript: dict[str, Any]) -> dict[str, Any]:
        task = await self._submit_task("/mini-summary", chunk_transcript, timeout_s=120)
        task = await self._wait_for_task(task, timeout_s=3600)
        data = self._task_result(task)
        key_points_raw = data.get("key_points")
        key_points: list[str] = []
        if isinstance(key_points_raw, list):
            key_points = [str(item).strip() for item in key_points_raw if str(item).strip()]
        if not key_points:
            raise MLServiceError("Mini-summary response has no key_points", "Сервис вернул пустой мини-конспект. Попробуйте повторить генерацию.")
        return {
            "chunk_id": chunk_transcript.get("chunk_id"),
            "start_time": chunk_transcript.get("start_time"),
            "end_time": chunk_transcript.get("end_time"),
            "key_points": key_points,
            "terms": data.get("terms") if isinstance(data.get("terms"), list) else [],
            "examples": data.get("examples") if isinstance(data.get("examples"), list) else [],
        }

    async def make_lesson_summary(self, mini_summaries: list[dict[str, Any]], topic_hint: str = "") -> list[dict[str, Any]]:
        key_points: list[str] = []
        for mini_summary in mini_summaries:
            raw_points = mini_summary.get("key_points")
            if not isinstance(raw_points, list):
                continue
            for item in raw_points:
                point = str(item).strip()
                if point:
                    key_points.append(point)

        if not key_points:
            raise MLServiceError("Lesson summary request has no key_points", "Не удалось собрать ключевые тезисы для конспекта. Попробуйте повторить генерацию.")

        payload = {
            "topic_hint": topic_hint,
            "key_points": key_points,
        }
        task = await self._submit_task("/lesson-summary", payload, timeout_s=180)
        task = await self._wait_for_task(task, timeout_s=3600)
        data = self._task_result(task)
        summary = data.get("summary")
        if not isinstance(summary, list) or not summary:
            raise MLServiceError("Lesson summary response has no summary list", "Сервис вернул пустой конспект. Попробуйте повторить генерацию.")

        normalized: list[dict[str, Any]] = []
        for idx, item in enumerate(summary):
            if not isinstance(item, dict):
                continue
            subtopic = str(item.get("subtopic") or f"Раздел {idx + 1}").strip()
            content = str(item.get("content") or "").strip()
            if not subtopic or not content:
                continue
            normalized.append({"subtopic": subtopic, "content": content})
        if not normalized:
            raise MLServiceError("Lesson summary response has no valid sections", "Сервис вернул пустой конспект. Попробуйте повторить генерацию.")
        return normalized

    async def make_quiz(
        self,
        summary: list[dict[str, Any]],
        *,
        mcq_count: int = 5,
        open_count: int = 2,
    ) -> list[dict[str, Any]]:
        payload = {
            "summary": summary,
            "mcq_count": mcq_count,
            "open_count": open_count,
        }
        task = await self._submit_task("/quiz", payload, timeout_s=180)
        task = await self._wait_for_task(task, timeout_s=3600)
        data = self._task_result(task)
        quiz = data.get("quiz")
        if not isinstance(quiz, list) or not quiz:
            raise MLServiceError("Quiz response has no quiz list", "Сервис вернул некорректный тест. Попробуйте повторить генерацию.")

        normalized: list[dict[str, Any]] = []
        for idx, item in enumerate(quiz):
            if not isinstance(item, dict):
                continue
            question_text = str(item.get("question_text") or "").strip()
            if not question_text:
                continue
            question_type = str(item.get("question_type") or "multiple_choice").strip().casefold()
            subtopic = str(item.get("subtopic") or f"Раздел {idx + 1}").strip() or f"Раздел {idx + 1}"
            explanation = str(item.get("explanation") or "").strip()
            question_id = item.get("question_id")
            if question_id in (None, ""):
                question_id = idx + 1

            if question_type == "multiple_choice":
                options = item.get("options")
                if not isinstance(options, list) or len(options) < 2:
                    continue
                try:
                    correct_answer = int(item.get("correct_answer"))
                except (TypeError, ValueError):
                    continue
                if correct_answer < 0 or correct_answer >= len(options):
                    continue
                normalized.append(
                    {
                        "question_id": int(question_id),
                        "question_text": question_text,
                        "question_type": "multiple_choice",
                        "options": [str(option or "").strip() for option in options],
                        "correct_answer": correct_answer,
                        "explanation": explanation,
                        "subtopic": subtopic,
                    }
                )
                continue

            if question_type in {"open_ended", "open_question"}:
                correct_answer = str(item.get("correct_answer") or "").strip()
                if not correct_answer:
                    continue
                normalized.append(
                    {
                        "question_id": int(question_id),
                        "question_text": question_text,
                        "question_type": "open_ended",
                        "options": None,
                        "correct_answer": correct_answer,
                        "explanation": explanation,
                        "subtopic": subtopic,
                    }
                )

        if not normalized:
            raise MLServiceError("Quiz response has no valid question items", "Сервис вернул некорректный тест. Попробуйте повторить генерацию.")
        return normalized

    async def grade_open_answers(self, answers: list[dict[str, Any]]) -> dict[str, Any]:
        payload = {
            "answers": answers,
        }
        task = await self._submit_task("/grade-open-answers", payload, timeout_s=120)
        task = await self._wait_for_task(task, timeout_s=3600)
        data = self._task_result(task)
        scores = data.get("scores")
        if not isinstance(scores, list):
            raise MLServiceError("Open answer grading response has no scores list", "Не удалось проверить открытые ответы.")

        normalized_scores: list[dict[str, Any]] = []
        for item in scores:
            if not isinstance(item, dict):
                continue
            question_id = str(item.get("question_id") or "").strip()
            if not question_id:
                continue
            try:
                score = 1 if int(item.get("score", 0) or 0) else 0
            except (TypeError, ValueError):
                score = 0
            normalized_scores.append({"question_id": question_id, "score": score})

        if not normalized_scores:
            raise MLServiceError("Open answer grading response has no valid scores", "Не удалось проверить открытые ответы.")

        return {"scores": normalized_scores}
