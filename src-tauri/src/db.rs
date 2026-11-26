use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskeenItem {
    pub id: String,
    pub category: String,
    pub title_bn: String,
    pub emotion_tag: String,
    pub arabic_uthmani: String,
    pub bangla_pronunciation: Option<String>,
    pub bangla_meaning: String,
    pub fazilat_text: String,
    pub story_title: Option<String>,
    pub story_context: Option<String>,
    pub primary_source: String,
    pub hadith_grade: String,
    pub recommended_count: i64,
    pub verified: bool,
    pub alim_note: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserLogRow {
    pub item_id: String,
    pub tasbih_count: i64,
    pub is_favorite: bool,
    pub tadabbur_note: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserKvRow {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Serialize)]
pub struct DbStatus {
    pub version: String,
    pub item_count: usize,
    pub db_sha256: String,
}

pub struct DbState {
    pub content_conn: Mutex<Connection>,
    pub user_conn: Mutex<Connection>,
    pub db_sha256: String,
}

pub fn compute_sha256(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    Ok(hex::encode(hasher.finalize()))
}

pub fn init_user_tables(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS user_logs (
            item_id TEXT PRIMARY KEY,
            tasbih_count INTEGER NOT NULL DEFAULT 0,
            is_favorite INTEGER NOT NULL DEFAULT 0,
            tadabbur_note TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS user_kv (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );"
    )
}

pub fn get_all_items(conn: &Connection) -> Result<Vec<TaskeenItem>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, category, title_bn, emotion_tag, arabic_uthmani, bangla_pronunciation,
                    bangla_meaning, fazilat_text, story_title, story_context, primary_source,
                    hadith_grade, recommended_count, alim_note
             FROM items"
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(TaskeenItem {
                id: row.get(0)?,
                category: row.get(1)?,
                title_bn: row.get(2)?,
                emotion_tag: row.get(3)?,
                arabic_uthmani: row.get(4)?,
                bangla_pronunciation: row.get(5)?,
                bangla_meaning: row.get(6)?,
                fazilat_text: row.get(7)?,
                story_title: row.get(8)?,
                story_context: row.get(9)?,
                primary_source: row.get(10)?,
                hadith_grade: row.get(11)?,
                recommended_count: row.get(12)?,
                verified: true,
                alim_note: row.get(13)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn search_items_fts(conn: &Connection, query: &str) -> Result<Vec<TaskeenItem>, String> {
    let clean = query.trim();
    if clean.is_empty() {
        return get_all_items(conn);
    }
    let like_pattern = format!("%{}%", clean);
    let safe_token = clean.replace('"', "").replace('*', "");
    let fts_query = format!("\"{}\"*", safe_token);

    let mut stmt = conn
        .prepare(
            "SELECT i.id, i.category, i.title_bn, i.emotion_tag, i.arabic_uthmani, i.bangla_pronunciation,
                    i.bangla_meaning, i.fazilat_text, i.story_title, i.story_context, i.primary_source,
                    i.hadith_grade, i.recommended_count, i.alim_note
             FROM items i
             WHERE i.id IN (SELECT id FROM items_fts WHERE items_fts MATCH ?1)
                OR i.title_bn LIKE ?2
                OR i.primary_source LIKE ?2
                OR i.bangla_pronunciation LIKE ?2
                OR i.bangla_meaning LIKE ?2
                OR i.hadith_grade LIKE ?2"
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![fts_query, like_pattern], |row| {
            Ok(TaskeenItem {
                id: row.get(0)?,
                category: row.get(1)?,
                title_bn: row.get(2)?,
                emotion_tag: row.get(3)?,
                arabic_uthmani: row.get(4)?,
                bangla_pronunciation: row.get(5)?,
                bangla_meaning: row.get(6)?,
                fazilat_text: row.get(7)?,
                story_title: row.get(8)?,
                story_context: row.get(9)?,
                primary_source: row.get(10)?,
                hadith_grade: row.get(11)?,
                recommended_count: row.get(12)?,
                verified: true,
                alim_note: row.get(13)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn get_user_logs(conn: &Connection) -> Result<Vec<UserLogRow>, String> {
    let mut stmt = conn
        .prepare("SELECT item_id, tasbih_count, is_favorite, tadabbur_note FROM user_logs")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let fav: i64 = row.get(2)?;
            Ok(UserLogRow {
                item_id: row.get(0)?,
                tasbih_count: row.get(1)?,
                is_favorite: fav != 0,
                tadabbur_note: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn save_user_log(
    conn: &Connection,
    item_id: &str,
    tasbih_count: i64,
    is_favorite: bool,
    tadabbur_note: &str,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO user_logs (item_id, tasbih_count, is_favorite, tadabbur_note, updated_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))
         ON CONFLICT(item_id) DO UPDATE SET
           tasbih_count = excluded.tasbih_count,
           is_favorite = excluded.is_favorite,
           tadabbur_note = excluded.tadabbur_note,
           updated_at = excluded.updated_at",
        params![item_id, tasbih_count, if is_favorite { 1 } else { 0 }, tadabbur_note],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_all_kv(conn: &Connection) -> Result<Vec<UserKvRow>, String> {
    let mut stmt = conn
        .prepare("SELECT key, value FROM user_kv")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(UserKvRow {
                key: row.get(0)?,
                value: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn set_kv(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO user_kv (key, value, updated_at)
         VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
struct FullBackupPayload {
    version: u8,
    logs: Vec<UserLogRow>,
    kv: Vec<UserKvRow>,
}

#[derive(Debug, Serialize, Deserialize)]
struct EncryptedBackupEnvelope {
    format: String,
    salt: String,
    tag: String,
    data: String,
}

fn derive_key(passphrase: &str, salt: &[u8]) -> [u8; 32] {
    let mut state = [0u8; 32];
    let mut hasher = Sha256::new();
    hasher.update(salt);
    hasher.update(passphrase.as_bytes());
    state.copy_from_slice(&hasher.finalize());
    for _ in 0..1024 {
        let mut h = Sha256::new();
        h.update(&state);
        h.update(salt);
        state.copy_from_slice(&h.finalize());
    }
    state
}

fn xor_stream(key: &[u8; 32], salt: &[u8], input: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(input.len());
    let mut counter: u64 = 0;
    for chunk in input.chunks(32) {
        let mut h = Sha256::new();
        h.update(key);
        h.update(salt);
        h.update(&counter.to_le_bytes());
        let block = h.finalize();
        for (i, b) in chunk.iter().enumerate() {
            out.push(b ^ block[i]);
        }
        counter += 1;
    }
    out
}

fn compute_tag(key: &[u8; 32], salt: &[u8], ciphertext: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(key);
    h.update(salt);
    h.update(ciphertext);
    hex::encode(h.finalize())
}

pub fn export_encrypted_backup(conn: &Connection, passphrase: &str) -> Result<String, String> {
    if passphrase.trim().len() < 4 {
        return Err("পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে".to_string());
    }
    let logs = get_user_logs(conn)?;
    let kv = get_all_kv(conn)?;
    let full = FullBackupPayload {
        version: 2,
        logs,
        kv,
    };
    let payload = serde_json::to_vec(&full).map_err(|e| e.to_string())?;

    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let mut salt_hasher = Sha256::new();
    salt_hasher.update(&nanos.to_le_bytes());
    salt_hasher.update(passphrase.as_bytes());
    let salt_full = salt_hasher.finalize();
    let salt = &salt_full[..16];

    let key = derive_key(passphrase, salt);
    let ciphertext = xor_stream(&key, salt, &payload);
    let tag = compute_tag(&key, salt, &ciphertext);

    let env = EncryptedBackupEnvelope {
        format: "taskeen-backup-v1".to_string(),
        salt: hex::encode(salt),
        tag,
        data: hex::encode(ciphertext),
    };
    serde_json::to_string_pretty(&env).map_err(|e| e.to_string())
}

pub fn import_encrypted_backup(conn: &Connection, content: &str, passphrase: &str) -> Result<usize, String> {
    let env: EncryptedBackupEnvelope =
        serde_json::from_str(content).map_err(|_| "অবৈধ ব্যাকআপ ফাইল ফরম্যাট".to_string())?;
    if env.format != "taskeen-backup-v1" {
        return Err("অসমর্থিত ব্যাকআপ ভার্সন".to_string());
    }
    let salt = hex::decode(&env.salt).map_err(|_| "ব্যাকআপ ফাইল ক্ষতিগ্রস্ত".to_string())?;
    let ciphertext = hex::decode(&env.data).map_err(|_| "ব্যাকআপ ফাইল ক্ষতিগ্রস্ত".to_string())?;
    let key = derive_key(passphrase, &salt);
    let expected_tag = compute_tag(&key, &salt, &ciphertext);
    if expected_tag != env.tag {
        return Err("ভুল পাসওয়ার্ড অথবা ব্যাকআপ ফাইল পরিবর্তিত হয়েছে".to_string());
    }
    let plaintext = xor_stream(&key, &salt, &ciphertext);

    if let Ok(full) = serde_json::from_slice::<FullBackupPayload>(&plaintext) {
        let total = full.logs.len() + full.kv.len();
        for log in full.logs {
            save_user_log(conn, &log.item_id, log.tasbih_count, log.is_favorite, &log.tadabbur_note)?;
        }
        for row in full.kv {
            set_kv(conn, &row.key, &row.value)?;
        }
        return Ok(total);
    }

    let logs: Vec<UserLogRow> =
        serde_json::from_slice(&plaintext).map_err(|_| "ডিক্রিপ্ট করতে সমস্যা হয়েছে".to_string())?;
    let count = logs.len();
    for log in logs {
        save_user_log(conn, &log.item_id, log.tasbih_count, log.is_favorite, &log.tadabbur_note)?;
    }
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_logs_kv_and_encrypted_backup_roundtrip() {
        let conn = Connection::open_in_memory().unwrap();
        init_user_tables(&conn).unwrap();

        save_user_log(&conn, "dua_01", 33, true, "সকালের দোয়া").unwrap();
        set_kv(&conn, "amalify_state", r#"{"zakatWealth":50000}"#).unwrap();

        let backup = export_encrypted_backup(&conn, "secret123").unwrap();

        // Wrong passphrase must fail
        assert!(import_encrypted_backup(&conn, &backup, "wrong").is_err());

        // Restore into a fresh DB
        let conn2 = Connection::open_in_memory().unwrap();
        init_user_tables(&conn2).unwrap();
        let restored = import_encrypted_backup(&conn2, &backup, "secret123").unwrap();
        assert_eq!(restored, 2);

        let logs = get_user_logs(&conn2).unwrap();
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].tasbih_count, 33);
        assert!(logs[0].is_favorite);

        let kv = get_all_kv(&conn2).unwrap();
        assert_eq!(kv.len(), 1);
        assert_eq!(kv[0].key, "amalify_state");
    }
}
