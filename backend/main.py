import json
import math
import os
import random
import sqlite3
import subprocess
import tempfile
import uuid
import asyncio
import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from backend.ml_service import MLServiceClient, MLServiceError

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = Path(os.getenv("DB_PATH", str(DATA_DIR / "app.db")))
PUBLIC_DIR = BASE_DIR / "public"

ML_URL = os.getenv("ML_URL", "https://ml.fastclass.ru")
ML_API_KEY = os.getenv("ML_API_KEY", "")
AUDIO_SAMPLE_RATE = int(os.getenv("AUDIO_SAMPLE_RATE", "16000"))
AUDIO_CHUNK_SECONDS = int(os.getenv("AUDIO_CHUNK_SECONDS", "480"))
AUDIO_CHUNK_MIN_SECONDS = int(os.getenv("AUDIO_CHUNK_MIN_SECONDS", "300"))
AUDIO_CHUNK_MAX_SECONDS = int(os.getenv("AUDIO_CHUNK_MAX_SECONDS", "600"))
AUDIO_CHUNK_OVERLAP_SECONDS = int(os.getenv("AUDIO_CHUNK_OVERLAP_SECONDS", "0"))
AUDIO_SILENCE_NOISE_DB = os.getenv("AUDIO_SILENCE_NOISE_DB", "-35dB")
AUDIO_SILENCE_MIN_SECONDS = float(os.getenv("AUDIO_SILENCE_MIN_SECONDS", "0.7"))
TRANSCRIBE_BATCH_SIZE = max(1, int(os.getenv("TRANSCRIBE_BATCH_SIZE", "2")))

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SESSION_SECRET", "dev-secret-change-me"), same_site="lax", https_only=False, max_age=60 * 60 * 24 * 30)
WS_CONNECTIONS = {}


def db_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = db_conn()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS generations (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          creator_id TEXT NOT NULL DEFAULT '',
          file_name TEXT NOT NULL,
          status TEXT NOT NULL,
          progress_percent REAL NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          transcript_json TEXT NOT NULL,
          summary_json TEXT NOT NULL,
          quiz_json TEXT NOT NULL,
          analytics_json TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """
    )
    cols = [r[1] for r in conn.execute("PRAGMA table_info(generations)").fetchall()]
    if "creator_id" not in cols:
        conn.execute("ALTER TABLE generations ADD COLUMN creator_id TEXT NOT NULL DEFAULT ''")
        conn.execute(
            """
            UPDATE generations
            SET creator_id = CASE
                WHEN creator_id IS NULL OR trim(creator_id) = '' THEN user_id
                ELSE creator_id
            END
            WHERE creator_id IS NULL OR trim(creator_id) = ''
            """
        )
    cols = [r[1] for r in conn.execute("PRAGMA table_info(generations)").fetchall()]
    if "error_message" not in cols:
        conn.execute("ALTER TABLE generations ADD COLUMN error_message TEXT NOT NULL DEFAULT ''")
    cols = [r[1] for r in conn.execute("PRAGMA table_info(generations)").fetchall()]
    if "progress_percent" not in cols:
        conn.execute("ALTER TABLE generations ADD COLUMN progress_percent REAL NOT NULL DEFAULT 0")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS transcript_cache (
          content_hash TEXT PRIMARY KEY,
          transcript_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS student_attempts (
          id TEXT PRIMARY KEY,
          generation_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          answers_json TEXT NOT NULL,
          results_json TEXT NOT NULL,
          mastery_json TEXT NOT NULL,
          recommendation TEXT NOT NULL,
          subtopic_to_revise TEXT NOT NULL,
          FOREIGN KEY (generation_id) REFERENCES generations(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """
    )
    cols = [r[1] for r in conn.execute("PRAGMA table_info(student_attempts)").fetchall()]
    if "user_id" not in cols:
        conn.execute("ALTER TABLE student_attempts ADD COLUMN user_id TEXT NOT NULL DEFAULT ''")
    conn.execute(
        """
        UPDATE student_attempts
        SET user_id = CASE
            WHEN user_id IS NULL OR trim(user_id) = '' THEN 'legacy_' || id
            ELSE user_id
        END
        WHERE user_id IS NULL OR trim(user_id) = ''
        """
    )
    cleanup_student_attempt_duplicates(conn)
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_student_attempts_generation_user ON student_attempts(generation_id, user_id)")
    conn.commit()
    conn.close()


@app.on_event("startup")
async def startup() -> None:
    init_db()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_guest_user(request: Request) -> str:
    user_id = request.session.get("user_id")
    if user_id:
        return user_id

    user_id = f"guest_{uuid.uuid4().hex[:14]}"
    conn = db_conn()
    user_cols = {row["name"] for row in conn.execute("PRAGMA table_info(users)").fetchall()}
    if "role" in user_cols:
        conn.execute("INSERT INTO users (id, role, created_at) VALUES (?, ?, ?)", (user_id, "guest", now_iso()))
    else:
        conn.execute("INSERT INTO users (id, created_at) VALUES (?, ?)", (user_id, now_iso()))
    conn.commit()
    conn.close()
    request.session["user_id"] = user_id
    return user_id


def row_to_generation(row: sqlite3.Row) -> dict[str, Any]:
    creator_id = row["creator_id"] if "creator_id" in row.keys() else row["user_id"]
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "creator_id": creator_id,
        "file_name": row["file_name"],
        "status": row["status"],
        "progress_percent": float(row["progress_percent"]) if "progress_percent" in row.keys() and row["progress_percent"] is not None else 0,
        "created_at": row["created_at"],
        "transcript": json.loads(row["transcript_json"]),
        "summary": json.loads(row["summary_json"]),
        "quiz": json.loads(row["quiz_json"]),
        "analytics": json.loads(row["analytics_json"]),
        "error_message": row["error_message"] if "error_message" in row.keys() else "",
    }


def content_hash_for_bytes(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()


def sanitize_uploaded_filename(file_name: str) -> str:
    raw_name = str(file_name or "").strip()
    if not raw_name:
        return "media"

    path = Path(raw_name)
    suffix = path.suffix.lower()
    if suffix and not re.fullmatch(r"\.[a-z0-9]{1,8}", suffix):
        suffix = ""

    stem_source = path.name[:-len(suffix)] if suffix else path.stem
    stem = re.sub(r"[^0-9A-Za-zА-Яа-яЁё_-]+", "_", stem_source)
    stem = re.sub(r"_+", "_", stem).strip("_-")
    if not stem:
        stem = "media"
    stem = stem[:50]
    if not stem:
        stem = "media"
    return f"{stem}{suffix}"


def get_cached_transcript(content_hash: str) -> Optional[list[dict[str, Any]]]:
    conn = db_conn()
    row = conn.execute("SELECT transcript_json FROM transcript_cache WHERE content_hash = ?", (content_hash,)).fetchone()
    conn.close()
    if not row:
        return None
    try:
        transcript = json.loads(row["transcript_json"])
    except json.JSONDecodeError:
        return None
    return transcript if isinstance(transcript, list) else None


def store_cached_transcript(content_hash: str, transcript: list[dict[str, Any]]) -> None:
    conn = db_conn()
    conn.execute(
        """
        INSERT INTO transcript_cache (content_hash, transcript_json, created_at)
        VALUES (?, ?, ?)
        ON CONFLICT(content_hash) DO UPDATE SET
          transcript_json = excluded.transcript_json,
          created_at = excluded.created_at
        """,
        (content_hash, json.dumps(transcript, ensure_ascii=False), now_iso()),
    )
    conn.commit()
    conn.close()


def cleanup_student_attempt_duplicates(conn: sqlite3.Connection) -> None:
    rows = conn.execute(
        """
        SELECT rowid, generation_id, user_id, created_at, id
        FROM student_attempts
        ORDER BY generation_id, user_id, datetime(created_at) DESC, id DESC
        """
    ).fetchall()
    seen_pairs: set[tuple[str, str]] = set()
    for row in rows:
        pair = (str(row["generation_id"] or ""), str(row["user_id"] or ""))
        if pair in seen_pairs:
            conn.execute("DELETE FROM student_attempts WHERE rowid = ?", (row["rowid"],))
            continue
        seen_pairs.add(pair)


def get_generation(generation_id: str) -> Optional[dict[str, Any]]:
    conn = db_conn()
    row = conn.execute("SELECT * FROM generations WHERE id = ?", (generation_id,)).fetchone()
    conn.close()
    return row_to_generation(row) if row else None


def update_generation(generation_id: str, patch: dict[str, Any], broadcast_event_type: str = "generation_updated") -> None:
    current = get_generation(generation_id)
    if not current:
        return
    merged = {**current, **patch}
    conn = db_conn()
    conn.execute(
        """
        UPDATE generations
        SET status = ?, progress_percent = ?, transcript_json = ?, summary_json = ?, quiz_json = ?, analytics_json = ?, error_message = ?
        WHERE id = ?
        """,
        (
            merged["status"],
            float(merged.get("progress_percent", 0) or 0),
            json.dumps(merged.get("transcript", []), ensure_ascii=False),
            json.dumps(merged.get("summary", []), ensure_ascii=False),
            json.dumps(merged.get("quiz", []), ensure_ascii=False),
            json.dumps(merged.get("analytics", {}), ensure_ascii=False),
            merged.get("error_message", ""),
            generation_id,
        ),
    )
    conn.commit()
    conn.close()
    user_id = merged.get("creator_id") or merged.get("user_id")
    if user_id:
        try:
            loop = asyncio.get_running_loop()
            payload: dict[str, Any] = {
                "type": broadcast_event_type,
                "generation_id": generation_id,
                "status": merged.get("status", ""),
            }
            if broadcast_event_type == "generation_analytics_updated":
                analytics = merged.get("analytics", {}) if isinstance(merged.get("analytics"), dict) else {}
                payload["studentsCompleted"] = analytics.get("studentsCompleted", 0)
            loop.create_task(broadcast_to_user(user_id, payload))
        except RuntimeError:
            pass


def update_generation_progress(generation_id: str, progress_percent: float, broadcast_event_type: str = "generation_updated") -> None:
    current = get_generation(generation_id)
    if not current:
        return
    current["progress_percent"] = float(progress_percent)
    conn = db_conn()
    conn.execute(
        "UPDATE generations SET progress_percent = ? WHERE id = ?",
        (float(progress_percent), generation_id),
    )
    conn.commit()
    conn.close()
    user_id = current.get("creator_id") or current.get("user_id")
    if user_id:
        try:
            loop = asyncio.get_running_loop()
            payload: dict[str, Any] = {
                "type": broadcast_event_type,
                "generation_id": generation_id,
                "status": current.get("status", ""),
            }
            loop.create_task(broadcast_to_user(user_id, payload))
        except RuntimeError:
            pass


def make_user_error_message(exc: Exception) -> str:
    if isinstance(exc, MediaConversionError):
        return "Не удалось подготовить аудио из файла. Проверьте формат файла или попробуйте другой файл."
    if isinstance(exc, MLServiceError):
        return exc.user_message
    text = str(exc).lower()
    if "rate" in text or "429" in text:
        return "Сервис временно перегружен. Попробуйте повторить генерацию через минуту."
    if "timeout" in text:
        return "Превышено время ожидания ответа сервиса. Попробуйте позже."
    return "Не удалось завершить генерацию. Попробуйте позже."


class MediaConversionError(Exception):
    pass


def media_suffix(file_name: str) -> str:
    suffix = Path(file_name or "").suffix.lower()
    if not suffix or len(suffix) > 12:
        return ".media"
    return suffix


def convert_to_wav_audio(file_bytes: bytes, file_name: str) -> tuple[bytes, str, str]:
    safe_name = sanitize_uploaded_filename(file_name)
    with tempfile.TemporaryDirectory(prefix="upload_audio_", dir=DATA_DIR) as tmp_dir:
        input_path = Path(tmp_dir) / f"input{media_suffix(safe_name)}"
        output_path = Path(tmp_dir) / "audio.wav"
        input_path.write_bytes(file_bytes)

        cmd = [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(input_path),
            "-vn",
            "-ac",
            "1",
            "-ar",
            str(AUDIO_SAMPLE_RATE),
            "-c:a",
            "pcm_s16le",
            str(output_path),
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300, check=False)
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise MediaConversionError(f"ffmpeg conversion failed: {exc}") from exc

        if result.returncode != 0 or not output_path.exists() or output_path.stat().st_size == 0:
            raise MediaConversionError(f"ffmpeg conversion failed: {result.stderr.strip()}")

        return output_path.read_bytes(), f"{Path(safe_name or 'media').stem or 'media'}.wav", "audio/wav"


def format_timestamp(seconds: float) -> str:
    total_seconds = max(0, int(round(seconds)))
    minutes, secs = divmod(total_seconds, 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def media_duration_seconds(media_path: Path) -> float:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(media_path),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise MediaConversionError(f"ffprobe failed: {exc}") from exc

    if result.returncode != 0:
        raise MediaConversionError(f"ffprobe failed: {result.stderr.strip()}")

    try:
        duration = float(result.stdout.strip())
    except ValueError as exc:
        raise MediaConversionError(f"ffprobe returned invalid duration: {result.stdout.strip()}") from exc
    if duration <= 0:
        raise MediaConversionError("Audio duration is empty")
    return duration


def detect_silence_ranges(media_path: Path) -> list[tuple[float, float]]:
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "info",
        "-i",
        str(media_path),
        "-af",
        f"silencedetect=noise={AUDIO_SILENCE_NOISE_DB}:d={AUDIO_SILENCE_MIN_SECONDS}",
        "-f",
        "null",
        "-",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise MediaConversionError(f"ffmpeg silence detection failed: {exc}") from exc

    if result.returncode not in (0, 1) and result.stderr.strip():
        raise MediaConversionError(f"ffmpeg silence detection failed: {result.stderr.strip()}")

    silence_ranges: list[tuple[float, float]] = []
    silence_start: Optional[float] = None
    for line in result.stderr.splitlines():
        if "silence_start:" in line:
            try:
                silence_start = float(line.rsplit("silence_start:", 1)[1].strip().split()[0])
            except (IndexError, ValueError):
                silence_start = None
        elif "silence_end:" in line and silence_start is not None:
            try:
                silence_end = float(line.rsplit("silence_end:", 1)[1].strip().split()[0])
            except (IndexError, ValueError):
                continue
            if silence_end > silence_start:
                silence_ranges.append((silence_start, silence_end))
            silence_start = None
    return silence_ranges


def choose_chunk_end(
    start_seconds: float,
    duration_seconds: float,
    silence_ranges: list[tuple[float, float]],
    *,
    target_seconds: int,
    min_seconds: int,
    max_seconds: int,
) -> float:
    min_end = min(start_seconds + min_seconds, duration_seconds)
    max_end = min(start_seconds + max_seconds, duration_seconds)
    if max_end <= min_end:
        return duration_seconds

    target_end = min(start_seconds + target_seconds, max_end)
    best_boundary: Optional[float] = None
    best_score: Optional[float] = None

    for silence_start, silence_end in silence_ranges:
        if silence_end < min_end or silence_start > max_end:
            continue
        boundary = max(min_end, min(target_end, silence_end))
        boundary = max(boundary, silence_start)
        boundary = min(boundary, silence_end, max_end)
        if boundary < min_end or boundary > max_end:
            continue
        score = abs(boundary - target_end)
        if best_score is None or score < best_score:
            best_score = score
            best_boundary = boundary

    if best_boundary is not None:
        return best_boundary
    return target_end


def split_audio_into_chunks(audio_bytes: bytes, audio_name: str) -> list[dict[str, Any]]:
    chunk_seconds = max(AUDIO_CHUNK_MIN_SECONDS, min(AUDIO_CHUNK_SECONDS, AUDIO_CHUNK_MAX_SECONDS))
    min_seconds = max(10, min(AUDIO_CHUNK_MIN_SECONDS, chunk_seconds))
    max_seconds = max(min_seconds, min(AUDIO_CHUNK_MAX_SECONDS, 10 * 60))
    target_seconds = max(min_seconds, min(AUDIO_CHUNK_SECONDS, max_seconds))
    overlap_seconds = max(0, min(AUDIO_CHUNK_OVERLAP_SECONDS, 5, chunk_seconds - 1))

    with tempfile.TemporaryDirectory(prefix="audio_chunks_", dir=DATA_DIR) as tmp_dir:
        tmp_path = Path(tmp_dir)
        source_path = tmp_path / "source.wav"
        source_path.write_bytes(audio_bytes)
        duration = media_duration_seconds(source_path)
        silence_ranges = detect_silence_ranges(source_path)

        chunks = []
        start = 0.0
        chunk_id = 1
        while start < duration:
            remaining = duration - start
            if remaining <= max_seconds:
                end = duration
            else:
                end = choose_chunk_end(
                    start,
                    duration,
                    silence_ranges,
                    target_seconds=target_seconds,
                    min_seconds=min_seconds,
                    max_seconds=max_seconds,
                )
                if end < start + min_seconds:
                    end = min(start + target_seconds, start + max_seconds, duration)
                end = min(max(end, start + min_seconds), start + max_seconds, duration)
            chunk_path = tmp_path / f"chunk_{chunk_id:03d}.wav"
            cmd = [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-ss",
                f"{start:.3f}",
                "-i",
                str(source_path),
                "-t",
                f"{end - start:.3f}",
                "-vn",
                "-ac",
                "1",
                "-ar",
                str(AUDIO_SAMPLE_RATE),
                "-c:a",
                "pcm_s16le",
                str(chunk_path),
            ]
            try:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=300, check=False)
            except (OSError, subprocess.TimeoutExpired) as exc:
                raise MediaConversionError(f"ffmpeg chunking failed: {exc}") from exc

            if result.returncode != 0 or not chunk_path.exists() or chunk_path.stat().st_size == 0:
                raise MediaConversionError(f"ffmpeg chunking failed: {result.stderr.strip()}")

            chunks.append(
                {
                    "chunk_id": chunk_id,
                    "start_seconds": start,
                    "end_seconds": end,
                    "start_time": format_timestamp(start),
                    "end_time": format_timestamp(end),
                    "filename": f"{Path(audio_name).stem}_chunk_{chunk_id:03d}.wav",
                    "mime_type": "audio/wav",
                    "bytes": chunk_path.read_bytes(),
                }
            )

            if end >= duration:
                break
            start = max(0.0, end - overlap_seconds)
            chunk_id += 1

        return chunks


async def broadcast_to_user(user_id: str, payload: dict[str, Any]) -> None:
    clients = WS_CONNECTIONS.get(user_id, set()).copy()
    if not clients:
        return
    message = json.dumps(payload, ensure_ascii=False)
    for ws in clients:
        try:
            await ws.send_text(message)
        except Exception:
            WS_CONNECTIONS.get(user_id, set()).discard(ws)


def build_analytics(generation_id: str, quiz: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "studentLink": f"/material/{generation_id}/",
        "studentsCompleted": 0,
        "mastery": [],
        "recommendations": [],
    }


def quiz_subtopics(quiz: list[dict[str, Any]]) -> list[str]:
    subtopics: list[str] = []
    for idx, q in enumerate(quiz):
        if not isinstance(q, dict):
            continue
        subtopic = str(q.get("subtopic") or f"Подтема {idx + 1}").strip()
        if subtopic and subtopic not in subtopics:
            subtopics.append(subtopic)
    return subtopics


def build_mastery_from_results(results: list[dict[str, Any]], subtopics: Optional[
    list[str]] = None) -> list[dict[str, Any]]:
    stats: dict[str, dict[str, int]] = {subtopic: {"correct": 0, "total": 0} for subtopic in (subtopics or [])}
    for item in results:
        subtopic = str(item.get("subtopic") or "Без темы").strip() or "Без темы"
        if subtopics and subtopic not in stats:
            continue
        current = stats.setdefault(subtopic, {"correct": 0, "total": 0})
        current["correct"] += 1 if item.get("score") else 0
        current["total"] += 1
    ordered_subtopics = subtopics or list(stats.keys())
    return [
        {
            "subtopic": subtopic,
            "percent": round((stat["correct"] / stat["total"]) * 100) if stat["total"] else 0,
            "correct": stat["correct"],
            "total": stat["total"],
        }
        for subtopic in ordered_subtopics
        for stat in [stats.get(subtopic, {"correct": 0, "total": 0})]
    ]


def analytics_from_attempts(generation_id: str, quiz: list[dict[str, Any]], attempts: list[sqlite3.Row]) -> dict[str, Any]:
    subtopics = quiz_subtopics(quiz)

    stats = {subtopic: {"correct": 0, "total": 0} for subtopic in subtopics}
    for attempt in attempts:
        try:
            results = json.loads(attempt["results_json"])
        except (TypeError, json.JSONDecodeError):
            results = []
        for item in results if isinstance(results, list) else []:
            subtopic = str(item.get("subtopic") or "Без темы").strip() or "Без темы"
            if subtopics and subtopic not in stats:
                continue
            current = stats.setdefault(subtopic, {"correct": 0, "total": 0})
            current["correct"] += 1 if item.get("score") else 0
            current["total"] += 1

    mastery = [
        {
            "subtopic": subtopic,
            "percent": round((stat["correct"] / stat["total"]) * 100) if stat["total"] else 0,
            "correct": stat["correct"],
            "total": stat["total"],
        }
        for subtopic in subtopics
        for stat in [stats.get(subtopic, {"correct": 0, "total": 0})]
        if stat["total"] > 0
    ]
    recommendations = build_recommendations_from_mastery(mastery)

    return {
        "studentLink": f"/material/{generation_id}/",
        "studentsCompleted": len(attempts),
        "mastery": mastery,
        "recommendations": recommendations,
    }


def build_recommendations_from_mastery(mastery: list[dict[str, Any]]) -> list[dict[str, Any]]:
    recommendations: list[dict[str, Any]] = []
    for item in mastery:
        try:
            percent = int(item.get("percent", 0) or 0)
        except (TypeError, ValueError):
            percent = 0
        subtopic = str(item.get("subtopic") or "Без темы").strip() or "Без темы"
        if percent < 50:
            recommendations.append(
                {
                    "subtopic": subtopic,
                    "action": "Важно разобрать тему",
                    "priority": "high",
                    "percent": percent,
                }
            )
        elif percent < 80:
            recommendations.append(
                {
                    "subtopic": subtopic,
                    "action": "Стоит повторить тему",
                    "priority": "medium",
                    "percent": percent,
                }
            )

    recommendations.sort(
        key=lambda item: (
            0 if item.get("priority") == "high" else 1,
            int(item.get("percent", 0) or 0),
            str(item.get("subtopic") or "").strip().casefold(),
        )
    )
    return recommendations[:2]


def summarize_recommendations(recommendations: list[dict[str, Any]]) -> str:
    if not recommendations:
        return "Отлично: все подтемы теста освоены."
    return " ".join(
        str(item.get("action") or "").strip()
        for item in recommendations
        if str(item.get("action") or "").strip()
    )


def choose_subtopic_to_revise(recommendations: list[dict[str, Any]]) -> str:
    for item in recommendations:
        if item.get("priority") == "high":
            return str(item.get("subtopic") or "").strip()
    return str(recommendations[0].get("subtopic") or "").strip() if recommendations else ""


def refresh_generation_analytics(generation_id: str) -> dict[str, Any]:
    generation = get_generation(generation_id)
    if not generation:
        return {}
    conn = db_conn()
    attempts = conn.execute(
        "SELECT * FROM student_attempts WHERE generation_id = ? ORDER BY created_at DESC",
        (generation_id,),
    ).fetchall()
    conn.close()
    analytics = analytics_from_attempts(generation_id, generation.get("quiz", []), attempts)
    if not attempts and not analytics.get("mastery"):
        analytics = build_analytics(generation_id, generation.get("quiz", []))
        analytics["studentsCompleted"] = 0
        analytics["mastery"] = []
        analytics["recommendations"] = []
    update_generation(generation_id, {"analytics": analytics}, broadcast_event_type="generation_analytics_updated")
    return analytics


def save_student_attempt(
    generation_id: str,
    user_id: str,
    answers: list[dict[str, Any]],
    results: list[dict[str, Any]],
    recommendation: str,
    subtopic_to_revise: str,
) -> dict[str, Any]:
    generation = get_generation(generation_id)
    mastery = build_mastery_from_results(results, quiz_subtopics(generation.get("quiz", [])) if generation else [])
    conn = db_conn()
    conn.execute(
        """
        INSERT INTO student_attempts
        (id, generation_id, user_id, created_at, answers_json, results_json, mastery_json, recommendation, subtopic_to_revise)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(generation_id, user_id) DO UPDATE SET
          created_at = excluded.created_at,
          answers_json = excluded.answers_json,
          results_json = excluded.results_json,
          mastery_json = excluded.mastery_json,
          recommendation = excluded.recommendation,
          subtopic_to_revise = excluded.subtopic_to_revise
        """,
        (
            f"attempt_{uuid.uuid4().hex[:14]}",
            generation_id,
            user_id,
            now_iso(),
            json.dumps(answers, ensure_ascii=False),
            json.dumps(results, ensure_ascii=False),
            json.dumps(mastery, ensure_ascii=False),
            recommendation,
            subtopic_to_revise,
        ),
    )
    conn.commit()
    conn.close()
    refresh_generation_analytics(generation_id)
    return {"mastery": mastery}


def load_student_attempt(generation_id: str, user_id: str) -> Optional[dict[str, Any]]:
    conn = db_conn()
    attempt_row = conn.execute(
        "SELECT * FROM student_attempts WHERE generation_id = ? AND user_id = ?",
        (generation_id, user_id),
    ).fetchone()
    conn.close()
    if not attempt_row:
        return None
    return {
        "results": json.loads(attempt_row["results_json"]) if attempt_row["results_json"] else [],
        "mastery": json.loads(attempt_row["mastery_json"]) if attempt_row["mastery_json"] else [],
        "recommendation": attempt_row["recommendation"] or "",
        "subtopic_to_revise": attempt_row["subtopic_to_revise"] or "",
        "created_at": attempt_row["created_at"],
    }


def shuffle_quiz_options(quiz: list[dict[str, Any]]) -> list[dict[str, Any]]:
    special_option_patterns = (
        "all of the above",
        "none of the above",
        "all of above",
        "все вышеперечисленное",
        "все выше перечисленное",
        "все перечисленное выше",
        "ни одно из вышеперечисленного",
        "ничего из вышеперечисленного",
        "ни один из вышеперечисленных",
        "ни один из перечисленных",
        "ни один из вышеперечисленных вариантов",
    )

    def is_special_option(option: Any) -> bool:
        text = str(option or "").strip().casefold()
        if not text:
            return False
        return any(pattern in text for pattern in special_option_patterns)

    shuffled_quiz = []
    for question in quiz:
        q = dict(question) if isinstance(question, dict) else {}
        options = q.get("options")
        if q.get("question_type") != "multiple_choice" or not isinstance(options, list) or len(options) < 2:
            shuffled_quiz.append(q)
            continue

        try:
            correct_idx = int(q.get("correct_answer"))
        except (TypeError, ValueError):
            shuffled_quiz.append(q)
            continue
        if correct_idx < 0 or correct_idx >= len(options):
            shuffled_quiz.append(q)
            continue

        normal_options = [(idx, option) for idx, option in enumerate(options) if not is_special_option(option)]
        special_options = [(idx, option) for idx, option in enumerate(options) if is_special_option(option)]

        random.shuffle(normal_options)
        ordered_options = normal_options + special_options
        q["options"] = [option for _, option in ordered_options]
        q["correct_answer"] = next(new_idx for new_idx, (old_idx, _) in enumerate(ordered_options) if old_idx == correct_idx)
        shuffled_quiz.append(q)
    return shuffled_quiz


def summary_subtopics(summary: list[dict[str, Any]]) -> list[str]:
    subtopics = []
    for idx, section in enumerate(summary):
        if not isinstance(section, dict):
            continue
        subtopic = str(section.get("subtopic") or f"Раздел {idx + 1}").strip()
        if subtopic and subtopic not in subtopics:
            subtopics.append(subtopic)
    return subtopics


def matching_summary_subtopic(candidate: str, subtopics: list[str]) -> str:
    normalized_candidate = candidate.strip().casefold()
    if not normalized_candidate:
        return ""
    for subtopic in subtopics:
        if subtopic.strip().casefold() == normalized_candidate:
            return subtopic
    return ""


def weakest_summary_subtopic(results: list[dict[str, Any]], subtopics: list[str]) -> str:
    stats: dict[str, dict[str, int]] = {}
    for item in results:
        subtopic = matching_summary_subtopic(str(item.get("subtopic") or ""), subtopics)
        if not subtopic:
            continue
        current = stats.setdefault(subtopic, {"correct": 0, "total": 0})
        current["correct"] += 1 if item.get("score") else 0
        current["total"] += 1
    weak = [
        (subtopic, stat["correct"] / stat["total"])
        for subtopic, stat in stats.items()
        if stat["total"] and stat["correct"] < stat["total"]
    ]
    return min(weak, key=lambda item: item[1])[0] if weak else ""


def transcript_to_chunks(transcript: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[int, list[dict[str, Any]]] = {}
    for phrase in transcript:
        try:
            chunk_id = int(phrase.get("chunk_id") or 1)
        except (TypeError, ValueError):
            chunk_id = 1
        grouped.setdefault(chunk_id, []).append(phrase)

    chunks = []
    for chunk_id, phrases in sorted(grouped.items()):
        phrases = sorted(phrases, key=lambda item: int(item.get("start_ms", 0) or 0))
        if not phrases:
            continue
        start_ms = int(phrases[0].get("start_ms", 0) or 0)
        end_ms = int(phrases[-1].get("start_ms", start_ms) or start_ms)
        chunks.append(
            {
                "chunk_id": chunk_id,
                "start_time": format_timestamp(start_ms / 1000),
                "end_time": format_timestamp(end_ms / 1000),
                "start_ms": start_ms,
                "end_ms": end_ms,
                "transcript": [
                    {
                        "start_ms": int(item.get("start_ms", 0) or 0),
                        "start_time": item.get("start_time") or format_timestamp(int(item.get("start_ms", 0) or 0) / 1000),
                        "text": item.get("text", ""),
                    }
                    for item in phrases
                ],
            }
        )
    return chunks


def transcript_to_summary_groups(
    transcript_chunks: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    grouped_chunks: list[dict[str, Any]] = []
    sorted_chunks = sorted(transcript_chunks, key=lambda item: int(item.get("start_ms", 0) or 0))
    for chunk in sorted_chunks:
        if not chunk:
            continue
        transcript: list[dict[str, Any]] = []
        transcript.extend(chunk.get("transcript", []))
        transcript.sort(key=lambda item: int(item.get("start_ms", 0) or 0))
        start_ms = int(chunk.get("start_ms", 0) or 0)
        end_ms = int(chunk.get("end_ms", start_ms) or start_ms)
        grouped_chunks.append(
            {
                "chunk_id": int(chunk.get("chunk_id", 1) or 1),
                "start_time": format_timestamp(start_ms / 1000),
                "end_time": format_timestamp(end_ms / 1000),
                "start_ms": start_ms,
                "end_ms": end_ms,
                "transcript": transcript,
            }
        )
    return grouped_chunks


def log_summary_payload(summary_groups: list[dict[str, Any]], label: str) -> None:
    print(f"[summary] {label}: groups={len(summary_groups)}")
    for idx, group in enumerate(summary_groups, start=1):
        subtopic = str(group.get("subtopic") or f"Раздел {idx}").strip()
        transcript = group.get("transcript", [])
        if isinstance(transcript, list):
            preview_parts = []
            for item in transcript[:2]:
                if not isinstance(item, dict):
                    continue
                text = " ".join(str(item.get("text", "") or "").split())
                if text:
                    preview_parts.append(text[:140])
            preview = " | ".join(preview_parts)
        else:
            preview = ""
        print(
            f"[summary] {label} #{idx}: subtopic={subtopic!r}, "
            f"start_ms={group.get('start_ms', 0)}, end_ms={group.get('end_ms', 0)}, preview={preview!r}"
        )


def log_final_summary(summary: list[dict[str, Any]], label: str) -> None:
    print(f"[summary] {label}: sections={len(summary) if isinstance(summary, list) else 0}")
    if not isinstance(summary, list):
        return
    for idx, section in enumerate(summary, start=1):
        if not isinstance(section, dict):
            continue
        subtopic = str(section.get("subtopic") or f"Раздел {idx}").strip()
        content = " ".join(str(section.get("content", "") or "").split())
        print(f"[summary] {label} #{idx}: subtopic={subtopic!r}, content_preview={content[:220]!r}")


def transcript_from_transcription_results(transcription_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    transcript: list[dict[str, Any]] = []
    for chunk in transcription_results:
        transcript.extend(chunk.get("phrases", []))
    transcript.sort(key=lambda item: (int(item.get("start_ms", 0) or 0), int(item.get("chunk_id", 0) or 0)))
    return transcript


def expand_transcript_segment(
    *,
    chunk_id: int,
    chunk_start_ms: int,
    chunk_end_ms: int,
    start_ms: int,
    text: str,
) -> list[dict[str, Any]]:
    clean_text = " ".join((text or "").split()).strip()
    if not clean_text:
        return []

    chunk_duration_ms = max(0, chunk_end_ms - chunk_start_ms)
    if chunk_duration_ms <= 0:
        return [
            {
                "chunk_id": chunk_id,
                "start_ms": max(chunk_start_ms, start_ms),
                "start_time": format_timestamp(max(chunk_start_ms, start_ms) / 1000),
                "text": clean_text,
                "is_final": True,
            }
        ]

    sentence_parts = [
        part.strip()
        for part in re.split(r"(?<=[.!?…])\s+(?=[A-ZА-ЯЁ0-9(«\"'])", clean_text)
        if part.strip()
    ]
    if len(sentence_parts) < 2:
        sentence_parts = [
            part.strip()
            for part in re.split(r"[\n\r]+", clean_text)
            if part.strip()
        ]
    if len(sentence_parts) < 2:
        return [
            {
                "chunk_id": chunk_id,
                "start_ms": max(chunk_start_ms, start_ms),
                "start_time": format_timestamp(max(chunk_start_ms, start_ms) / 1000),
                "text": clean_text,
                "is_final": True,
            }
        ]

    total_weight = sum(max(1, len(part)) for part in sentence_parts)
    expanded: list[dict[str, Any]] = []
    consumed_weight = 0
    for index, part in enumerate(sentence_parts):
        part_weight = max(1, len(part))
        part_start_ms = chunk_start_ms + round(chunk_duration_ms * consumed_weight / total_weight)
        if index > 0 and expanded:
            prev_start_ms = int(expanded[-1].get("start_ms", chunk_start_ms) or chunk_start_ms)
            if part_start_ms <= prev_start_ms:
                part_start_ms = prev_start_ms + 1
        if part_start_ms < chunk_start_ms:
            part_start_ms = chunk_start_ms
        expanded.append(
            {
                "chunk_id": chunk_id,
                "start_ms": part_start_ms,
                "start_time": format_timestamp(part_start_ms / 1000),
                "text": part,
                "is_final": True,
            }
        )
        consumed_weight += part_weight

    return expanded


async def transcribe_audio_chunks(
    ml_client: MLServiceClient,
    audio_chunks: list[dict[str, Any]],
    audio_content_type: str,
    generation_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    async def animate_batch_progress(target_percent: int, stop_event: asyncio.Event) -> None:
        if not generation_id:
            return
        current_generation = get_generation(generation_id)
        current_percent = int(round(float(current_generation.get("progress_percent", 0) or 0))) if current_generation else 0
        current_percent = max(0, min(current_percent, target_percent))
        while current_percent < target_percent:
            if stop_event.is_set():
                return
            await asyncio.sleep(1)
            if stop_event.is_set():
                return
            current_percent += 1
            update_generation_progress(generation_id, current_percent)

    async def transcribe_one(chunk: dict[str, Any]) -> dict[str, Any]:
        chunk_start_ms = int(chunk["start_seconds"] * 1000)
        chunk_end_ms = int(chunk["end_seconds"] * 1000)
        chunk_duration_ms = max(0, chunk_end_ms - chunk_start_ms)
        chunk_segments = await ml_client.transcribe_chunk(
            file_name=chunk["filename"],
            mime_type=chunk.get("mime_type") or audio_content_type,
            audio_bytes=chunk["bytes"],
            chunk_id=chunk["chunk_id"],
            start_ms=chunk_start_ms,
            end_ms=chunk_end_ms,
        )
        chunk_phrases = []
        for segment in chunk_segments:
            phrase = str(segment.get("text", "")).strip()
            if not phrase:
                continue
            raw_start_ms = int(segment.get("start_ms", 0) or 0)
            if 0 <= raw_start_ms <= chunk_duration_ms + 5000:
                absolute_start_ms = chunk_start_ms + raw_start_ms
                if absolute_start_ms > chunk_end_ms + 2000:
                    absolute_start_ms = chunk_end_ms
            else:
                absolute_start_ms = raw_start_ms
            if absolute_start_ms < chunk_start_ms:
                absolute_start_ms = chunk_start_ms
            chunk_phrases.extend(
                expand_transcript_segment(
                    chunk_id=chunk["chunk_id"],
                    chunk_start_ms=chunk_start_ms,
                    chunk_end_ms=chunk_end_ms,
                    start_ms=absolute_start_ms,
                    text=phrase,
                )
            )
        transcript_chunk = {
            "chunk_id": chunk["chunk_id"],
            "start_time": chunk["start_time"],
            "end_time": chunk["end_time"],
            "start_ms": int(chunk["start_seconds"] * 1000),
            "end_ms": int(chunk["end_seconds"] * 1000),
            "transcript": [{"start_ms": phrase["start_ms"], "text": phrase["text"]} for phrase in chunk_phrases],
        }
        return {
            "chunk_id": chunk["chunk_id"],
            "transcript_chunk": transcript_chunk,
            "phrases": chunk_phrases,
        }

    results: list[dict[str, Any]] = []
    animated_progress = 0
    for batch_start in range(0, len(audio_chunks), TRANSCRIBE_BATCH_SIZE):
        batch = audio_chunks[batch_start:batch_start + TRANSCRIBE_BATCH_SIZE]
        batch_target = math.ceil(((batch_start + len(batch)) / len(audio_chunks)) * 100) if audio_chunks else 100
        batch_target = max(animated_progress, min(100, batch_target))
        stop_event = asyncio.Event()
        progress_task: Optional[asyncio.Task[None]] = None
        if generation_id:
            progress_task = asyncio.create_task(animate_batch_progress(batch_target, stop_event))
        try:
            batch_results = await asyncio.gather(*(transcribe_one(chunk) for chunk in batch))
        finally:
            if progress_task:
                stop_event.set()
                await progress_task
        results.extend(batch_results)
        if generation_id:
            animated_progress = batch_target
            update_generation(
                generation_id,
                {
                    "transcript": transcript_from_transcription_results(results),
                    "progress_percent": animated_progress,
                },
            )
    return sorted(results, key=lambda item: int(item.get("chunk_id", 0) or 0))


async def build_summary_and_quiz(
    ml_client: MLServiceClient,
    transcript_chunks: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    summary_groups = transcript_to_summary_groups([chunk["transcript_chunk"] for chunk in transcript_chunks])
    log_summary_payload(summary_groups, "build_summary_and_quiz")
    mini_summaries = await asyncio.gather(*(ml_client.make_mini_summary(chunk) for chunk in summary_groups))

    last_error: Exception = MLServiceError("Lesson summary failed", "Не удалось сгенерировать конспект.")
    summary: list[dict[str, Any]] = []
    for attempt in range(1, 4):
        try:
            summary = await ml_client.make_lesson_summary(list(mini_summaries))
            if summary:
                break
        except MLServiceError as e:
            last_error = e
            print(f"[build_summary_and_quiz] lesson summary attempt {attempt} failed, retrying...")
            if attempt < 3:
                await asyncio.sleep(1.5 * attempt)
    if not summary:
        raise last_error

    log_final_summary(summary, "build_summary_and_quiz")
    quiz = shuffle_quiz_options(await ml_client.make_quiz(summary))
    transcript: list[dict[str, Any]] = []
    for chunk in transcript_chunks:
        transcript.extend(chunk["phrases"])
    transcript.sort(key=lambda item: (int(item.get("start_ms", 0) or 0), int(item.get("chunk_id", 0) or 0)))
    return transcript, summary, quiz


async def run_ml_retry_pipeline(generation_id: str) -> None:
    try:
        current = get_generation(generation_id)
        if not current:
            return
        update_generation(generation_id, {"status": "processing", "progress_percent": 100, "error_message": ""})
        if not ML_API_KEY:
            raise RuntimeError("ML_API_KEY is empty")

        ml_client = MLServiceClient(api_key=ML_API_KEY, base_url=ML_URL)
        summary = current.get("summary", [])
        if not summary:
            transcript = current.get("transcript", [])
            summary_groups = transcript_to_summary_groups(transcript_to_chunks(transcript if isinstance(transcript, list) else []))
            if not summary_groups:
                raise MLServiceError(
                    "Retry requested without saved transcript",
                    "Не найден сохраненный транскрипт для повторной генерации. Загрузите файл заново.",
                )
            log_summary_payload(summary_groups, "run_ml_retry_pipeline")
            mini_summaries = await asyncio.gather(*(ml_client.make_mini_summary(chunk) for chunk in summary_groups))

            last_error: Exception = MLServiceError("Lesson summary failed", "Не удалось сгенерировать конспект.")
            for attempt in range(1, 4):
                try:
                    summary = await ml_client.make_lesson_summary(mini_summaries)
                    if summary:
                        break
                except MLServiceError as e:
                    last_error = e
                    print(f"[run_ml_retry_pipeline] lesson summary attempt {attempt} failed, retrying...")
                    if attempt < 3:
                        await asyncio.sleep(1.5 * attempt)
            if not summary:
                raise last_error

            log_final_summary(summary, "run_ml_retry_pipeline")
            update_generation(generation_id, {"summary": summary})

        quiz = shuffle_quiz_options(await ml_client.make_quiz(summary))
        update_generation(
            generation_id,
            {"status": "completed", "progress_percent": 100, "quiz": quiz, "analytics": build_analytics(generation_id, quiz), "error_message": ""},
        )
    except Exception as e:
        update_generation(generation_id, {"status": "failed", "error_message": make_user_error_message(e)})
        print("Generation retry failed:", e)


async def finalize_generation_from_transcript(generation_id: str, transcript: list[dict[str, Any]]) -> None:
    try:
        update_generation(
            generation_id,
            {
                "status": "processing",
                "progress_percent": 100,
                "transcript": transcript,
                "summary": [],
                "quiz": [],
                "analytics": {},
                "error_message": "",
            },
        )
        if not ML_API_KEY:
            raise RuntimeError("ML_API_KEY is empty")
        ml_client = MLServiceClient(api_key=ML_API_KEY, base_url=ML_URL)
        summary_groups = transcript_to_summary_groups(transcript_to_chunks(transcript if isinstance(transcript, list) else []))
        if not summary_groups:
            raise MLServiceError("Cached transcript is empty", "Не удалось получить транскрипт из файла. Попробуйте другой файл.")

        log_summary_payload(summary_groups, "finalize_generation_from_transcript")
        mini_summaries = await asyncio.gather(*(ml_client.make_mini_summary(chunk) for chunk in summary_groups))

        last_error: Exception = MLServiceError("Lesson summary failed", "Не удалось сгенерировать конспект.")
        summary: list[dict[str, Any]] = []
        for attempt in range(1, 4):
            try:
                summary = await ml_client.make_lesson_summary(mini_summaries)
                if summary:
                    break
            except MLServiceError as e:
                last_error = e
                print(f"[finalize_generation_from_transcript] lesson summary attempt {attempt} failed, retrying...")
                if attempt < 3:
                    await asyncio.sleep(1.5 * attempt)
        if not summary:
            raise last_error

        log_final_summary(summary, "finalize_generation_from_transcript")
        quiz = shuffle_quiz_options(await ml_client.make_quiz(summary))

        update_generation(
            generation_id,
            {
                "status": "completed",
                "progress_percent": 100,
                "transcript": transcript,
                "summary": summary,
                "quiz": quiz,
                "analytics": build_analytics(generation_id, quiz),
                "error_message": "",
            },
        )
    except Exception as e:
        update_generation(generation_id, {"status": "failed", "error_message": make_user_error_message(e)})
        print("Generation from transcript failed:", e)


async def run_generation_pipeline(generation_id: str, file_bytes: bytes, file_name: str, content_type: Optional[str], content_hash: Optional[str] = None) -> None:
    try:
        update_generation(generation_id, {"status": "processing", "progress_percent": 0, "transcript": [], "summary": [], "quiz": [], "analytics": {}, "error_message": ""})
        if not ML_API_KEY:
            raise RuntimeError("ML_API_KEY is empty")
        ml_client = MLServiceClient(api_key=ML_API_KEY, base_url=ML_URL)
        audio_bytes, audio_name, audio_content_type = await asyncio.to_thread(convert_to_wav_audio, file_bytes, file_name)
        audio_chunks = await asyncio.to_thread(split_audio_into_chunks, audio_bytes, audio_name)
        transcription_results = await transcribe_audio_chunks(ml_client, audio_chunks, audio_content_type, generation_id)
        if content_hash:
            store_cached_transcript(content_hash, transcript_from_transcription_results(transcription_results))

        transcript, summary, quiz = await build_summary_and_quiz(ml_client, transcription_results)

        update_generation(
            generation_id,
            {
                "status": "completed",
                "progress_percent": 100,
                "transcript": transcript,
                "summary": summary,
                "quiz": quiz,
                "analytics": build_analytics(generation_id, quiz),
                "error_message": "",
            },
        )
    except Exception as e:
        update_generation(generation_id, {"status": "failed", "error_message": make_user_error_message(e)})
        print("Generation failed:", e)


@app.get("/api/me")
async def api_me(request: Request):
    user_id = ensure_guest_user(request)
    return {"user_id": user_id}


@app.get("/api/generations")
async def api_generations(request: Request):
    user_id = ensure_guest_user(request)
    conn = db_conn()
    rows = conn.execute("SELECT * FROM generations WHERE COALESCE(creator_id, user_id) = ? ORDER BY created_at DESC LIMIT 20", (user_id,)).fetchall()
    conn.close()
    return {"items": [row_to_generation(r) for r in rows]}


@app.post("/api/generations/upload")
async def api_generations_upload(request: Request, background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    user_id = ensure_guest_user(request)
    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Empty file")
        if len(file_bytes) > 200 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large")
        safe_file_name = sanitize_uploaded_filename(file.filename or "media")

        generation_id = f"gen_{uuid.uuid4().hex[:14]}"
        conn = db_conn()
        conn.execute(
            """
            INSERT INTO generations
            (id, user_id, creator_id, file_name, status, created_at, transcript_json, summary_json, quiz_json, analytics_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (generation_id, user_id, user_id, safe_file_name, "processing", now_iso(), "[]", "[]", "[]", "{}"),
        )
        conn.commit()
        conn.close()

        content_hash = content_hash_for_bytes(file_bytes)
        cached_transcript = get_cached_transcript(content_hash)
        if cached_transcript:
            background_tasks.add_task(finalize_generation_from_transcript, generation_id, cached_transcript)
        else:
            background_tasks.add_task(run_generation_pipeline, generation_id, file_bytes, safe_file_name, file.content_type, content_hash)
        return JSONResponse(status_code=201, content={"id": generation_id, "content_hash": content_hash, "cache_hit": bool(cached_transcript)})
    finally:
        await file.close()


@app.post("/api/generations/{generation_id}/retry")
async def api_generation_retry(request: Request, background_tasks: BackgroundTasks, generation_id: str):
    user_id = ensure_guest_user(request)
    conn = db_conn()
    row = conn.execute("SELECT * FROM generations WHERE id = ? AND COALESCE(creator_id, user_id) = ?", (generation_id, user_id)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    generation = row_to_generation(row)
    if generation.get("status") == "processing":
        raise HTTPException(status_code=409, detail="Генерация уже выполняется.")
    if not generation.get("transcript"):
        raise HTTPException(status_code=400, detail="Нет сохраненного транскрипта для повторной генерации.")

    background_tasks.add_task(run_ml_retry_pipeline, generation_id)
    return {"ok": True}


@app.get("/api/generations/{generation_id}")
async def api_generation_get(request: Request, generation_id: str):
    user_id = ensure_guest_user(request)
    conn = db_conn()
    row = conn.execute("SELECT * FROM generations WHERE id = ? AND COALESCE(creator_id, user_id) = ?", (generation_id, user_id)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return row_to_generation(row)


@app.delete("/api/generations/{generation_id}")
async def api_generation_delete(request: Request, generation_id: str):
    user_id = ensure_guest_user(request)
    conn = db_conn()
    conn.execute("DELETE FROM generations WHERE id = ? AND COALESCE(creator_id, user_id) = ?", (generation_id, user_id))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.patch("/api/generations/{generation_id}")
async def api_generation_patch(request: Request, generation_id: str, payload: dict[str, Any]):
    user_id = ensure_guest_user(request)
    conn = db_conn()
    row = conn.execute("SELECT * FROM generations WHERE id = ? AND COALESCE(creator_id, user_id) = ?", (generation_id, user_id)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    current = row_to_generation(row)
    if isinstance(payload.get("summary"), list):
        current["summary"] = payload["summary"]
    if isinstance(payload.get("quiz"), list):
        current["quiz"] = payload["quiz"]
    if isinstance(payload.get("analytics"), dict):
        current["analytics"] = payload["analytics"]
    update_generation(generation_id, current)
    return {"ok": True}


@app.get("/api/student/{generation_id}")
async def api_student(request: Request, generation_id: str):
    user_id = ensure_guest_user(request)
    generation = get_generation(generation_id)
    if not generation or generation.get("status") != "completed":
        raise HTTPException(status_code=404, detail="Not found")
    attempt = load_student_attempt(generation_id, user_id)
    return {
        "summary": generation.get("summary", []),
        "quiz": generation.get("quiz", []),
        "generation_id": generation_id,
        "attempt": attempt,
    }


@app.post("/api/student/{generation_id}/check")
async def api_student_check(request: Request, generation_id: str, payload: dict[str, Any]):
    user_id = ensure_guest_user(request)
    generation = get_generation(generation_id)
    if not generation or generation.get("status") != "completed":
        raise HTTPException(status_code=404, detail="Материал недоступен.")

    existing_attempt = load_student_attempt(generation_id, user_id)
    if existing_attempt:
        return existing_attempt

    quiz = generation.get("quiz", [])
    quiz_subtopics_list = quiz_subtopics(quiz)
    answers = payload.get("answers", [])
    if not isinstance(answers, list):
        raise HTTPException(status_code=400, detail="Некорректный формат ответов.")

    answers_by_id = {}
    for item in answers:
        qid = str(item.get("question_id", ""))
        if qid:
            answers_by_id[qid] = item

    results = []
    open_payload = []
    open_subtopics_by_id: dict[str, str] = {}
    for idx, q in enumerate(quiz):
        qid = str(q.get("question_id", idx + 1))
        qtype = q.get("question_type", "multiple_choice")
        subtopic = (q.get("subtopic") or f"Подтема {idx + 1}").strip()
        user_answer = answers_by_id.get(qid, {})
        if not isinstance(user_answer, dict):
            user_answer = {"answer": user_answer}
        if qtype in ("open_ended", "open_question"):
            open_subtopics_by_id[qid] = subtopic
            open_payload.append(
                {
                    "question_id": qid,
                    "question_text": q.get("question_text", ""),
                    "correct_answer": q.get("correct_answer", ""),
                    "student_answer": user_answer.get("student_answer") if isinstance(user_answer.get("student_answer"), str) else str(user_answer.get("answer") or ""),
                }
            )
            continue

        if "is_correct" in user_answer:
            score = 1 if user_answer.get("is_correct") is True else 0
        else:
            try:
                ua = int(user_answer.get("answer"))
            except (TypeError, ValueError):
                ua = -1
            score = 1 if ua == int(q.get("correct_answer", -999)) else 0
        results.append({"question_id": qid, "subtopic": subtopic, "score": score})

    if open_payload:
        if not ML_API_KEY:
            raise HTTPException(status_code=500, detail="Сервис проверки не настроен.")
        ml_client = MLServiceClient(api_key=ML_API_KEY, base_url=ML_URL)
        try:
            graded = await ml_client.grade_open_answers(open_payload)
            for row in graded.get("scores", []):
                qid = str(row.get("question_id", ""))
                results.append(
                    {
                        "question_id": qid,
                        "subtopic": open_subtopics_by_id.get(qid, ""),
                        "score": int(row.get("score", 0)),
                    }
                )
        except MLServiceError as exc:
            raise HTTPException(status_code=500, detail=exc.user_message)

    mastery = build_mastery_from_results(results, quiz_subtopics_list)
    recommendations = build_recommendations_from_mastery(mastery)
    recommendation = summarize_recommendations(recommendations)
    subtopic_to_revise = choose_subtopic_to_revise(recommendations)

    attempt = save_student_attempt(generation_id, user_id, answers, results, recommendation, subtopic_to_revise)

    return {
        "results": results,
        "mastery": attempt["mastery"],
        "recommendation": recommendation,
        "subtopic_to_revise": subtopic_to_revise,
        "recommendations": recommendations,
    }


@app.get("/")
async def root_redirect():
    return FileResponse(PUBLIC_DIR / "teacher" / "index.html")


@app.get("/teacher/")
@app.get("/teacher/index.html")
async def teacher_redirect():
    return RedirectResponse(url="/")


@app.get("/student/index.html")
async def legacy_student_redirect(request: Request):
    generation_id = request.query_params.get("generation_id", "").strip()
    if generation_id:
        return RedirectResponse(url=f"/material/{generation_id}/")
    return FileResponse(PUBLIC_DIR / "student" / "index.html")


@app.get("/material/{generation_id}")
async def material_redirect(generation_id: str):
    return FileResponse(PUBLIC_DIR / "student" / "index.html")


@app.get("/material/{generation_id}/")
async def material_page(generation_id: str):
    return FileResponse(PUBLIC_DIR / "student" / "index.html")


@app.websocket("/ws/generations")
async def websocket_generations(websocket: WebSocket):
    user_id = websocket.query_params.get("user_id")
    if not user_id:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    WS_CONNECTIONS.setdefault(user_id, set()).add(websocket)
    try:
        await websocket.send_text(json.dumps({"type": "connected"}, ensure_ascii=False))
        while True:
            _ = await websocket.receive_text()
            await websocket.send_text(json.dumps({"type": "pong"}, ensure_ascii=False))
    except WebSocketDisconnect:
        pass
    finally:
        WS_CONNECTIONS.get(user_id, set()).discard(websocket)


app.mount("/", StaticFiles(directory=str(PUBLIC_DIR), html=True), name="static")
