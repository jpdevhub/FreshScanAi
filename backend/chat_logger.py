import sqlite3
from pathlib import Path
from datetime import datetime, timezone

DB_DIR = Path(__file__).parent / "data"
DB_PATH = DB_DIR / "chat_logs.db"

def init_db():
    """Initializes the SQLite database and creates chat_logs table if it doesn't exist."""
    DB_DIR.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_logs (
            id TEXT PRIMARY KEY,
            question TEXT NOT NULL,
            response TEXT NOT NULL,
            current_page TEXT,
            current_feature TEXT,
            timestamp TEXT NOT NULL,
            feedback TEXT
        )
    """)
    conn.commit()
    conn.close()

def log_chat_message(
    msg_id: str,
    question: str,
    response: str,
    current_page: str = None,
    current_feature: str = None
):
    """Logs a generated Q&A exchange to the database."""
    init_db()  # Ensure DB and table are initialized

    timestamp = datetime.now(timezone.utc).isoformat()

    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO chat_logs (
                id, question, response, current_page, current_feature,
                timestamp, feedback
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                msg_id,
                question,
                response,
                current_page,
                current_feature,
                timestamp,
                None,
            )
        )
        conn.commit()
    except Exception as e:
        print(f"ChatLogger Error logging message: {e}")
    finally:
        conn.close()

def update_chat_feedback(msg_id: str, feedback: str):
    """Updates feedback (e.g., 'up' or 'down') for a specific message ID."""
    init_db()  # Ensure DB and table are initialized

    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            UPDATE chat_logs
            SET feedback = ?
            WHERE id = ?
            """,
            (feedback, msg_id)
        )
        conn.commit()
    except Exception as e:
        print(f"ChatLogger Error updating feedback: {e}")
    finally:
        conn.close()
