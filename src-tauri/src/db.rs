use aes_gcm::{
    aead::{Aead, KeyInit, Payload},
    Aes256Gcm, Nonce,
};
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use rand_core::{OsRng, RngCore};
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;
use std::sync::{Mutex, OnceLock};

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
    pub db_verified: bool,
}

pub struct DbState {
    pub content_conn: Mutex<Connection>,
    pub user_conn: Mutex<Connection>,
    pub db_sha256: String,
    pub db_verified: bool,
}

/// Formats a Unix timestamp (seconds) as RFC 3339 UTC, e.g. 2026-11-26T08:43:00Z.
pub fn rfc3339_utc(secs: i64) -> String {
    let days = secs.div_euclid(86_400);
    let rem = secs.rem_euclid(86_400);
    // Howard Hinnant's civil-from-days algorithm
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + if m <= 2 { 1 } else { 0 };
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y,
        m,
        d,
        rem / 3_600,
        (rem % 3_600) / 60,
        rem % 60
    )
}

pub fn rfc3339_now() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    rfc3339_utc(secs)
}

/// Empty in-memory stand-in used when the bundled content DB cannot be opened,
/// so the UI can fall back to its bundled JSON instead of the app crashing.
pub fn open_empty_content_db() -> Connection {
    let conn = Connection::open_in_memory().expect("in-memory SQLite unavailable");
    let _ = conn.execute_batch(
        "CREATE TABLE items (
            id TEXT PRIMARY KEY, category TEXT NOT NULL, title_bn TEXT NOT NULL,
            emotion_tag TEXT NOT NULL, arabic_uthmani TEXT NOT NULL, bangla_pronunciation TEXT,
            bangla_meaning TEXT NOT NULL, fazilat_text TEXT NOT NULL, story_title TEXT,
            story_context TEXT, primary_source TEXT NOT NULL, hadith_grade TEXT NOT NULL,
            recommended_count INTEGER NOT NULL, alim_note TEXT
        );
        CREATE VIRTUAL TABLE items_fts USING fts5(
            id UNINDEXED, title_bn, bangla_meaning, fazilat_text, story_context
        );",
    );
    conn
}

// ---------------------------------------------------------------------------
// Field-level encryption at rest (AES-256-GCM, key supplied from the OS keychain)
// ---------------------------------------------------------------------------

static DATA_KEY: OnceLock<[u8; 32]> = OnceLock::new();
const ENC_PREFIX: &str = "enc1:";

pub fn init_data_key(key: [u8; 32]) {
    let _ = DATA_KEY.set(key);
}

pub fn encryption_active() -> bool {
    DATA_KEY.get().is_some()
}

fn seal_field(plain: &str, aad: &str) -> Result<String, String> {
    let Some(key) = DATA_KEY.get() else {
        return Ok(plain.to_string());
    };
    if plain.is_empty() {
        return Ok(String::new());
    }
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let ct = cipher
        .encrypt(
            Nonce::from_slice(&nonce_bytes),
            Payload { msg: plain.as_bytes(), aad: aad.as_bytes() },
        )
        .map_err(|_| "এনক্রিপ্ট করতে সমস্যা হয়েছে".to_string())?;
    let mut blob = Vec::with_capacity(12 + ct.len());
    blob.extend_from_slice(&nonce_bytes);
    blob.extend_from_slice(&ct);
    Ok(format!("{}{}", ENC_PREFIX, hex::encode(blob)))
}

fn open_field(stored: &str, aad: &str) -> Result<String, String> {
    let Some(rest) = stored.strip_prefix(ENC_PREFIX) else {
        return Ok(stored.to_string()); // legacy plaintext row
    };
    let key = DATA_KEY.get().ok_or_else(|| "ডেটা key পাওয়া যায়নি".to_string())?;
    let blob = hex::decode(rest).map_err(|_| "ক্ষতিগ্রস্ত এনক্রিপ্টেড ডেটা".to_string())?;
    if blob.len() < 12 + 16 {
        return Err("ক্ষতিগ্রস্ত এনক্রিপ্টেড ডেটা".to_string());
    }
    let (nonce_bytes, ct) = blob.split_at(12);
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;
    let plain = cipher
        .decrypt(Nonce::from_slice(nonce_bytes), Payload { msg: ct, aad: aad.as_bytes() })
        .map_err(|_| "ডিক্রিপ্ট ব্যর্থ".to_string())?;
    String::from_utf8(plain).map_err(|_| "ক্ষতিগ্রস্ত ডেটা".to_string())
}

/// True when the user DB file already contains rows sealed with a data key.
pub fn file_has_encrypted_rows(path: &Path) -> bool {
    if !path.exists() {
        return false;
    }
    let Ok(conn) = Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY) else {
        return false;
    };
    let kv: i64 = conn
        .query_row("SELECT COUNT(*) FROM user_kv WHERE value LIKE 'enc1:%'", [], |r| r.get(0))
        .unwrap_or(0);
    let logs: i64 = conn
        .query_row("SELECT COUNT(*) FROM user_logs WHERE tadabbur_note LIKE 'enc1:%'", [], |r| r.get(0))
        .unwrap_or(0);
    kv + logs > 0
}

/// Seals every legacy plaintext row in place, then scrubs freed pages.
pub fn migrate_plaintext_to_encrypted(conn: &Connection) -> Result<usize, String> {
    if !encryption_active() {
        return Ok(0);
    }
    let mut migrated = 0usize;

    let kv_rows: Vec<(String, String)> = {
        let mut stmt = conn
            .prepare("SELECT key, value FROM user_kv WHERE value NOT LIKE 'enc1:%'")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };
    for (k, v) in kv_rows {
        let sealed = seal_field(&v, &format!("kv:{}", k))?;
        conn.execute("UPDATE user_kv SET value = ?1 WHERE key = ?2", params![sealed, k])
            .map_err(|e| e.to_string())?;
        migrated += 1;
    }

    let log_rows: Vec<(String, String)> = {
        let mut stmt = conn
            .prepare("SELECT item_id, tadabbur_note FROM user_logs WHERE tadabbur_note != '' AND tadabbur_note NOT LIKE 'enc1:%'")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };
    for (id, note) in log_rows {
        let sealed = seal_field(&note, &format!("log:{}", id))?;
        conn.execute("UPDATE user_logs SET tadabbur_note = ?1 WHERE item_id = ?2", params![sealed, id])
            .map_err(|e| e.to_string())?;
        migrated += 1;
    }

    if migrated > 0 {
        // Drop plaintext remnants from the WAL and free pages.
        let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;");
    }
    Ok(migrated)
}

pub fn delete_kv(conn: &Connection, key: &str) -> Result<(), String> {
    conn.execute("DELETE FROM user_kv WHERE key = ?1", params![key])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn compute_sha256(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    Ok(hex::encode(hasher.finalize()))
}

pub fn init_user_tables(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA synchronous=NORMAL;
         PRAGMA secure_delete=ON;
         CREATE TABLE IF NOT EXISTS user_logs (
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

pub fn get_item_count(conn: &Connection) -> Result<usize, String> {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM items", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    Ok(count.max(0) as usize)
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

fn strip_arabic_diacritics(s: &str) -> String {
    s.chars()
        .filter(|&c| !('\u{064B}'..='\u{065F}').contains(&c) && c != '\u{0670}' && c != '\u{0640}')
        .collect()
}

fn escape_like(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

pub fn search_items_fts(conn: &Connection, query: &str) -> Result<Vec<TaskeenItem>, String> {
    let clean = query.trim();
    if clean.is_empty() {
        return get_all_items(conn);
    }
    let like_pattern = format!("%{}%", escape_like(clean));
    let safe_token = clean.replace('"', "").replace('*', "");
    let fts_query = format!("\"{}\"*", safe_token);

    let mut stmt = conn
        .prepare(
            "SELECT i.id, i.category, i.title_bn, i.emotion_tag, i.arabic_uthmani, i.bangla_pronunciation,
                    i.bangla_meaning, i.fazilat_text, i.story_title, i.story_context, i.primary_source,
                    i.hadith_grade, i.recommended_count, i.alim_note
             FROM items i
             WHERE i.id IN (SELECT id FROM items_fts WHERE items_fts MATCH ?1)
                OR i.title_bn LIKE ?2 ESCAPE '\\'
                OR i.primary_source LIKE ?2 ESCAPE '\\'
                OR i.bangla_pronunciation LIKE ?2 ESCAPE '\\'
                OR i.bangla_meaning LIKE ?2 ESCAPE '\\'
                OR i.hadith_grade LIKE ?2 ESCAPE '\\'
                OR i.arabic_uthmani LIKE ?2 ESCAPE '\\'"
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

    let mut results = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    // If query contains Arabic characters and direct match missed harakat, search normalized Arabic
    let norm_q = strip_arabic_diacritics(clean);
    if !norm_q.is_empty() && norm_q.chars().any(|c| ('\u{0600}'..='\u{06FF}').contains(&c)) {
        let all = get_all_items(conn)?;
        for item in all {
            if !results.iter().any(|r| r.id == item.id)
                && strip_arabic_diacritics(&item.arabic_uthmani).contains(&norm_q)
            {
                results.push(item);
            }
        }
    }

    Ok(results)
}

pub fn get_user_logs(conn: &Connection) -> Result<Vec<UserLogRow>, String> {
    let mut stmt = conn
        .prepare("SELECT item_id, tasbih_count, is_favorite, tadabbur_note FROM user_logs")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let fav: i64 = row.get(2)?;
            let item_id: String = row.get(0)?;
            let stored_note: String = row.get(3)?;
            let note = open_field(&stored_note, &format!("log:{}", item_id)).unwrap_or_else(|e| {
                eprintln!("note for {} unreadable: {}", item_id, e);
                String::new()
            });
            Ok(UserLogRow {
                item_id,
                tasbih_count: row.get(1)?,
                is_favorite: fav != 0,
                tadabbur_note: note,
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
    let sealed_note = seal_field(tadabbur_note, &format!("log:{}", item_id))?;
    conn.execute(
        "INSERT INTO user_logs (item_id, tasbih_count, is_favorite, tadabbur_note, updated_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))
         ON CONFLICT(item_id) DO UPDATE SET
           tasbih_count = excluded.tasbih_count,
           is_favorite = excluded.is_favorite,
           tadabbur_note = excluded.tadabbur_note,
           updated_at = excluded.updated_at",
        params![item_id, tasbih_count, if is_favorite { 1 } else { 0 }, sealed_note],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_all_kv(conn: &Connection) -> Result<Vec<UserKvRow>, String> {
    let mut stmt = conn
        .prepare("SELECT key, value FROM user_kv")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;
    let raw = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    let mut out = Vec::with_capacity(raw.len());
    for (key, stored) in raw {
        match open_field(&stored, &format!("kv:{}", key)) {
            Ok(value) => out.push(UserKvRow { key, value }),
            Err(e) => eprintln!("kv row {} skipped: {}", key, e),
        }
    }
    Ok(out)
}

pub fn set_kv(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    let value = &seal_field(value, &format!("kv:{}", key))?;
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
struct EncryptedBackupEnvelopeV1 {
    format: String,
    salt: String,
    tag: String,
    data: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct EncryptedBackupEnvelopeV2 {
    format: String,
    salt: String,
    nonce: String,
    data: String,
}

fn derive_key_v1(passphrase: &str, salt: &[u8]) -> [u8; 32] {
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

fn xor_stream_v1(key: &[u8; 32], salt: &[u8], input: &[u8]) -> Vec<u8> {
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

fn compute_tag_v1(key: &[u8; 32], salt: &[u8], ciphertext: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(key);
    h.update(salt);
    h.update(ciphertext);
    hex::encode(h.finalize())
}

fn derive_key_argon2(passphrase: &str, salt: &[u8]) -> Result<[u8; 32], String> {
    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(passphrase.as_bytes(), salt, &mut key)
        .map_err(|e| e.to_string())?;
    Ok(key)
}

pub fn hash_pin(pin: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(pin.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| e.to_string())
}

pub fn verify_pin(pin: &str, stored_hash: &str) -> bool {
    if let Ok(parsed) = PasswordHash::new(stored_hash) {
        Argon2::default().verify_password(pin.as_bytes(), &parsed).is_ok()
    } else {
        false
    }
}

pub fn export_encrypted_backup(conn: &Connection, passphrase: &str) -> Result<String, String> {
    if passphrase.trim().len() < 10 {
        return Err("নিরাপত্তার জন্য পাসওয়ার্ড কমপক্ষে ১০ অক্ষরের হতে হবে".to_string());
    }
    let logs = get_user_logs(conn)?;
    let kv = get_all_kv(conn)?;
    let full = FullBackupPayload {
        version: 2,
        logs,
        kv,
    };
    let payload = serde_json::to_vec(&full).map_err(|e| e.to_string())?;

    let mut salt = [0u8; 16];
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce_bytes);

    let key = derive_key_argon2(passphrase, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, payload.as_ref())
        .map_err(|_| "এনক্রিপ্ট করতে সমস্যা হয়েছে".to_string())?;

    let env = EncryptedBackupEnvelopeV2 {
        format: "taskeen-backup-v2".to_string(),
        salt: hex::encode(salt),
        nonce: hex::encode(nonce_bytes),
        data: hex::encode(ciphertext),
    };
    serde_json::to_string_pretty(&env).map_err(|e| e.to_string())
}

pub fn import_encrypted_backup(conn: &Connection, content: &str, passphrase: &str) -> Result<usize, String> {
    let val: serde_json::Value =
        serde_json::from_str(content).map_err(|_| "অবৈধ ব্যাকআপ ফাইল ফরম্যাট".to_string())?;
    let format = val.get("format").and_then(|v| v.as_str()).unwrap_or("");

    let plaintext = if format == "taskeen-backup-v2" {
        let env: EncryptedBackupEnvelopeV2 =
            serde_json::from_value(val).map_err(|_| "অবৈধ v2 ব্যাকআপ ফাইল".to_string())?;
        let salt = hex::decode(&env.salt).map_err(|_| "ব্যাকআপ ফাইল ক্ষতিগ্রস্ত".to_string())?;
        let nonce_bytes = hex::decode(&env.nonce).map_err(|_| "ব্যাকআপ ফাইল ক্ষতিগ্রস্ত".to_string())?;
        let ciphertext = hex::decode(&env.data).map_err(|_| "ব্যাকআপ ফাইল ক্ষতিগ্রস্ত".to_string())?;
        if nonce_bytes.len() != 12 {
            return Err("ব্যাকআপ ফাইল ক্ষতিগ্রস্ত".to_string());
        }
        let key = derive_key_argon2(passphrase, &salt)?;
        let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
        let nonce = Nonce::from_slice(&nonce_bytes);
        cipher
            .decrypt(nonce, ciphertext.as_ref())
            .map_err(|_| "ভুল পাসওয়ার্ড অথবা ব্যাকআপ ফাইল পরিবর্তিত হয়েছে".to_string())?
    } else if format == "taskeen-backup-v1" {
        let env: EncryptedBackupEnvelopeV1 =
            serde_json::from_value(val).map_err(|_| "অবৈধ v1 ব্যাকআপ ফাইল".to_string())?;
        let salt = hex::decode(&env.salt).map_err(|_| "ব্যাকআপ ফাইল ক্ষতিগ্রস্ত".to_string())?;
        let ciphertext = hex::decode(&env.data).map_err(|_| "ব্যাকআপ ফাইল ক্ষতিগ্রস্ত".to_string())?;
        let key = derive_key_v1(passphrase, &salt);
        let expected_tag = compute_tag_v1(&key, &salt, &ciphertext);
        if expected_tag != env.tag {
            return Err("ভুল পাসওয়ার্ড অথবা ব্যাকআপ ফাইল পরিবর্তিত হয়েছে".to_string());
        }
        xor_stream_v1(&key, &salt, &ciphertext)
    } else {
        return Err("অসমর্থিত ব্যাকআপ ভার্সন".to_string());
    };

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
    fn test_field_encryption_at_rest_and_migration() {
        let conn = Connection::open_in_memory().unwrap();
        init_user_tables(&conn).unwrap();

        // Legacy plaintext rows written before a key exists.
        conn.execute(
            "INSERT INTO user_kv (key, value, updated_at) VALUES ('ls:taskeen_notes_v1', '[\"গোপন নোট\"]', 'x')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO user_logs (item_id, tasbih_count, is_favorite, tadabbur_note, updated_at) VALUES ('dua_9', 5, 0, 'গোপন তাদাব্বুর', 'x')",
            [],
        )
        .unwrap();

        init_data_key([7u8; 32]);
        assert!(encryption_active());
        assert_eq!(migrate_plaintext_to_encrypted(&conn).unwrap(), 2);
        assert_eq!(migrate_plaintext_to_encrypted(&conn).unwrap(), 0);

        let raw_kv: String = conn
            .query_row("SELECT value FROM user_kv WHERE key='ls:taskeen_notes_v1'", [], |r| r.get(0))
            .unwrap();
        let raw_note: String = conn
            .query_row("SELECT tadabbur_note FROM user_logs WHERE item_id='dua_9'", [], |r| r.get(0))
            .unwrap();
        assert!(raw_kv.starts_with("enc1:") && !raw_kv.contains("গোপন"));
        assert!(raw_note.starts_with("enc1:") && !raw_note.contains("গোপন"));

        // Reads return plaintext; counts stay plain.
        let kv = get_all_kv(&conn).unwrap();
        assert_eq!(kv[0].value, "[\"গোপন নোট\"]");
        let logs = get_user_logs(&conn).unwrap();
        assert_eq!(logs[0].tadabbur_note, "গোপন তাদাব্বুর");
        assert_eq!(logs[0].tasbih_count, 5);

        // New writes are sealed, and rows are bound to their key via AAD.
        set_kv(&conn, "a", "secret-a").unwrap();
        let raw_a: String = conn.query_row("SELECT value FROM user_kv WHERE key='a'", [], |r| r.get(0)).unwrap();
        assert!(raw_a.starts_with("enc1:"));
        conn.execute("UPDATE user_kv SET value = ?1 WHERE key='ls:taskeen_notes_v1'", params![raw_a]).unwrap();
        assert!(get_all_kv(&conn).unwrap().iter().all(|r| r.key != "ls:taskeen_notes_v1"));

        // Tampering is detected.
        let mut tampered = raw_a.clone();
        tampered.pop();
        tampered.push(if raw_a.ends_with('0') { '1' } else { '0' });
        assert!(open_field(&tampered, "kv:a").is_err());

        delete_kv(&conn, "a").unwrap();
        assert!(get_all_kv(&conn).unwrap().iter().all(|r| r.key != "a"));
    }

    #[test]
    fn test_user_logs_kv_and_encrypted_backup_roundtrip() {
        let conn = Connection::open_in_memory().unwrap();
        init_user_tables(&conn).unwrap();

        save_user_log(&conn, "dua_01", 33, true, "সকালের দোয়া").unwrap();
        set_kv(&conn, "amalify_state", r#"{"zakatWealth":50000}"#).unwrap();

        assert!(export_encrypted_backup(&conn, "short").is_err());
        let backup = export_encrypted_backup(&conn, "strongpass123").unwrap();
        assert!(backup.contains("taskeen-backup-v2"));

        // Wrong passphrase must fail
        assert!(import_encrypted_backup(&conn, &backup, "wrongpass123").is_err());

        // Restore into a fresh DB
        let conn2 = Connection::open_in_memory().unwrap();
        init_user_tables(&conn2).unwrap();
        let restored = import_encrypted_backup(&conn2, &backup, "strongpass123").unwrap();
        assert_eq!(restored, 2);

        let logs = get_user_logs(&conn2).unwrap();
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].tasbih_count, 33);
        assert!(logs[0].is_favorite);

        let kv = get_all_kv(&conn2).unwrap();
        assert_eq!(kv.len(), 1);
        assert_eq!(kv[0].key, "amalify_state");

        assert_eq!(rfc3339_utc(0), "1970-01-01T00:00:00Z");
        assert_eq!(rfc3339_utc(1_795_682_291), "2026-11-26T08:38:11Z");
        assert_eq!(rfc3339_utc(951_782_400), "2000-02-29T00:00:00Z");

        // PIN Argon2 hash/verify roundtrip
        let hashed = hash_pin("123456").unwrap();
        assert!(verify_pin("123456", &hashed));
        assert!(!verify_pin("654321", &hashed));
    }
}
