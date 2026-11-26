import hashlib
import json
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
JSON_PATH = BASE_DIR / "data" / "tahqeeq" / "entries.json"
DB_PATH = BASE_DIR / "src-tauri" / "resources" / "taskeen.db"

def build():
    entries = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    verified = [e for e in entries if e.get("verified", True)]

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()

    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE items (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            title_bn TEXT NOT NULL,
            emotion_tag TEXT NOT NULL,
            arabic_uthmani TEXT NOT NULL,
            bangla_pronunciation TEXT,
            bangla_meaning TEXT NOT NULL,
            fazilat_text TEXT NOT NULL,
            story_title TEXT,
            story_context TEXT,
            primary_source TEXT NOT NULL,
            hadith_grade TEXT NOT NULL,
            recommended_count INTEGER NOT NULL,
            alim_note TEXT
        )
    """)
    conn.execute("""
        CREATE VIRTUAL TABLE items_fts USING fts5(
            id UNINDEXED, title_bn, bangla_meaning, fazilat_text, story_context
        )
    """)

    for item in verified:
        conn.execute(
            "INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                item["id"], item["category"], item["title_bn"], item["emotion_tag"],
                item["arabic_uthmani"], item.get("bangla_pronunciation", ""),
                item["bangla_meaning"], item["fazilat_text"],
                item.get("story_title", ""), item.get("story_context", ""),
                item["primary_source"], item["hadith_grade"],
                item.get("recommended_count", 33), item.get("alim_note", "")
            ),
        )
        conn.execute(
            "INSERT INTO items_fts VALUES (?,?,?,?,?)",
            (item["id"], item["title_bn"], item["bangla_meaning"], item["fazilat_text"], item.get("story_context", "")),
        )

    conn.commit()
    conn.close()

    digest = hashlib.sha256(DB_PATH.read_bytes()).hexdigest()
    print(f"Built {DB_PATH} with {len(verified)} verified items. SHA-256: {digest}")

if __name__ == "__main__":
    build()
