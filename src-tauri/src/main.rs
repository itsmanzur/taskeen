#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod keystore;

use db::{
    compute_sha256, delete_kv, export_encrypted_backup, get_all_items, get_all_kv, get_item_count,
    get_user_logs, hash_pin, import_encrypted_backup, init_data_key, init_user_tables,
    migrate_plaintext_to_encrypted, open_empty_content_db, file_has_encrypted_rows, rfc3339_now, save_user_log, search_items_fts, set_kv, verify_pin, DbState, DbStatus, TaskeenItem, UserKvRow, UserLogRow,
};
use keystore::KeyError;
use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, LogicalSize, Manager, Size, State, WindowEvent};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

struct TrayNextPrayerItem(Mutex<Option<MenuItem<tauri::Wry>>>);

#[derive(Clone, Serialize)]
struct CryptoStatus {
    /// Personal data is sealed with AES-256-GCM using a key held in the OS keychain.
    enabled: bool,
    error: Option<String>,
    /// The keychain key was missing, so the old (unreadable) data file was set aside.
    recovered: bool,
}

#[tauri::command]
fn get_crypto_status(status: State<CryptoStatus>) -> CryptoStatus {
    status.inner().clone()
}

#[tauri::command]
fn delete_user_kv(key: String, state: State<DbState>) -> Result<(), String> {
    let conn = state.user_conn.lock().map_err(|e| e.to_string())?;
    delete_kv(&conn, &key)
}

fn archive_user_db(path: &PathBuf) {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    for suffix in ["", "-wal", "-shm"] {
        let src = PathBuf::from(format!("{}{}", path.display(), suffix));
        if src.exists() {
            let dst = PathBuf::from(format!("{}{}.locked-{}", path.display(), suffix, ts));
            let _ = fs::rename(&src, &dst);
        }
    }
}

/// True only when a tray icon exists, so hide-on-close can never strand the app.
struct TrayAvailable(AtomicBool);

fn http_agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(10))
        .timeout(Duration::from_secs(25))
        .build()
}

#[tauri::command]
fn get_app_status(state: State<DbState>) -> Result<DbStatus, String> {
    let conn = state.content_conn.lock().map_err(|e| e.to_string())?;
    let item_count = get_item_count(&conn)?;
    Ok(DbStatus {
        version: "0.4.2".to_string(),
        item_count,
        db_sha256: state.db_sha256.clone(),
        db_verified: state.db_verified,
    })
}

#[tauri::command]
fn fetch_items(state: State<DbState>) -> Result<Vec<TaskeenItem>, String> {
    let conn = state.content_conn.lock().map_err(|e| e.to_string())?;
    get_all_items(&conn)
}

#[tauri::command]
fn search_items(query: String, state: State<DbState>) -> Result<Vec<TaskeenItem>, String> {
    let conn = state.content_conn.lock().map_err(|e| e.to_string())?;
    search_items_fts(&conn, &query)
}

#[tauri::command]
fn load_user_logs(state: State<DbState>) -> Result<Vec<UserLogRow>, String> {
    let conn = state.user_conn.lock().map_err(|e| e.to_string())?;
    get_user_logs(&conn)
}

#[tauri::command]
fn upsert_user_log(
    item_id: String,
    tasbih_count: i64,
    is_favorite: bool,
    tadabbur_note: String,
    state: State<DbState>,
) -> Result<(), String> {
    let conn = state.user_conn.lock().map_err(|e| e.to_string())?;
    save_user_log(&conn, &item_id, tasbih_count, is_favorite, &tadabbur_note)
}

#[tauri::command]
fn load_user_kv(state: State<DbState>) -> Result<Vec<UserKvRow>, String> {
    let conn = state.user_conn.lock().map_err(|e| e.to_string())?;
    get_all_kv(&conn)
}

#[tauri::command]
fn upsert_user_kv(key: String, value: String, state: State<DbState>) -> Result<(), String> {
    let conn = state.user_conn.lock().map_err(|e| e.to_string())?;
    set_kv(&conn, &key, &value)
}

#[tauri::command(async)]
fn export_backup(passphrase: String, state: State<DbState>) -> Result<String, String> {
    let conn = state.user_conn.lock().map_err(|e| e.to_string())?;
    export_encrypted_backup(&conn, &passphrase)
}

#[tauri::command(async)]
fn import_backup(content: String, passphrase: String, state: State<DbState>) -> Result<usize, String> {
    let conn = state.user_conn.lock().map_err(|e| e.to_string())?;
    import_encrypted_backup(&conn, &content, &passphrase)
}

#[tauri::command]
fn send_reminder_notification(title: String, body: String, app: tauri::AppHandle) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn update_tray_next_prayer(
    label: String,
    tray_state: State<TrayNextPrayerItem>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    if let Ok(guard) = tray_state.0.lock() {
        if let Some(item) = guard.as_ref() {
            let _ = item.set_text(&label);
        }
    }
    if let Some(tray) = app.tray_by_id("taskeen-tray") {
        let _ = tray.set_tooltip(Some(&format!("তাসকীন — {}", label)));
    }
    Ok(())
}

#[tauri::command(async)]
fn hash_app_pin(pin: String) -> Result<String, String> {
    hash_pin(&pin)
}

#[tauri::command(async)]
fn verify_app_pin(pin: String, stored_hash: String) -> bool {
    verify_pin(&pin, &stored_hash)
}

#[tauri::command]
fn open_external_url(url: String, app: tauri::AppHandle) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("শুধুমাত্র HTTPS লিংক খোলা যাবে".to_string());
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command(async)]
fn cloud_sync_push(
    url: String,
    api_key: String,
    sync_id: String,
    passphrase: String,
    state: State<DbState>,
) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("ক্লাউড সিঙ্কের জন্য অবশ্যই https:// URL ব্যবহার করুন".to_string());
    }
    let encrypted = {
        let conn = state.user_conn.lock().map_err(|e| e.to_string())?;
        export_encrypted_backup(&conn, &passphrase)?
    };
    let mut req = http_agent()
        .post(&url)
        .set("Content-Type", "application/json")
        .set("Prefer", "resolution=merge-duplicates");
    let key = api_key.trim();
    if !key.is_empty() {
        req = req
            .set("apikey", key)
            .set("Authorization", &format!("Bearer {}", key));
    }
    let body = serde_json::json!({
        "id": if sync_id.trim().is_empty() { "taskeen-main" } else { sync_id.trim() },
        "payload": encrypted,
        "updated_at": rfc3339_now(),
    });
    req.send_json(body).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(async)]
fn cloud_sync_pull(
    url: String,
    api_key: String,
    passphrase: String,
    state: State<DbState>,
) -> Result<usize, String> {
    if !url.starts_with("https://") {
        return Err("ক্লাউড সিঙ্কের জন্য অবশ্যই https:// URL ব্যবহার করুন".to_string());
    }
    let mut req = http_agent().get(&url);
    let key = api_key.trim();
    if !key.is_empty() {
        req = req
            .set("apikey", key)
            .set("Authorization", &format!("Bearer {}", key));
    }
    let resp = req.call().map_err(|e| e.to_string())?;
    let json: serde_json::Value = resp.into_json().map_err(|e| e.to_string())?;
    let payload = if let Some(arr) = json.as_array() {
        arr.first()
            .and_then(|v| v.get("payload"))
            .and_then(|v| v.as_str())
    } else {
        json.get("payload").and_then(|v| v.as_str())
    }
    .ok_or_else(|| "ক্লাউডে কোনো ব্যাকআপ পাওয়া যায়নি".to_string())?;

    let conn = state.user_conn.lock().map_err(|e| e.to_string())?;
    import_encrypted_backup(&conn, payload, &passphrase)
}

/// Native "Save As": shows the OS save dialog and writes the chosen file.
/// Returns the saved path, or None when the user cancels.
#[tauri::command(async)]
fn save_file(
    default_name: String,
    filter_name: String,
    extensions: Vec<String>,
    content: String,
    is_base64: bool,
    app: tauri::AppHandle,
) -> Result<Option<String>, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use tauri_plugin_dialog::DialogExt;

    const MAX_BYTES: usize = 50 * 1024 * 1024;
    if content.len() > MAX_BYTES * 2 {
        return Err("ফাইল অনেক বড়".to_string());
    }
    let bytes = if is_base64 {
        STANDARD.decode(content.as_bytes()).map_err(|e| e.to_string())?
    } else {
        content.into_bytes()
    };
    if bytes.len() > MAX_BYTES {
        return Err("ফাইল অনেক বড়".to_string());
    }

    let safe_name: String = default_name
        .chars()
        .map(|c| if matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') { '_' } else { c })
        .collect();
    let exts: Vec<&str> = extensions.iter().map(|s| s.as_str()).collect();

    let picked = app
        .dialog()
        .file()
        .set_file_name(&safe_name)
        .add_filter(&filter_name, &exts)
        .blocking_save_file();
    let Some(file_path) = picked else {
        return Ok(None);
    };
    let path = file_path.into_path().map_err(|e| e.to_string())?;
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(Some(path.display().to_string()))
}

#[tauri::command]
fn set_mini_mode(mini: bool, window: tauri::WebviewWindow) -> Result<(), String> {
    if mini {
        window.set_always_on_top(true).map_err(|e| e.to_string())?;
        window
            .set_size(Size::Logical(LogicalSize::new(380.0, 460.0)))
            .map_err(|e| e.to_string())?;
    } else {
        window.set_always_on_top(false).map_err(|e| e.to_string())?;
        window
            .set_size(Size::Logical(LogicalSize::new(1220.0, 780.0)))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn resolve_content_db(app: &tauri::App) -> PathBuf {
    if let Ok(res_dir) = app.path().resource_dir() {
        let candidate = res_dir.join("resources").join("taskeen.db");
        if candidate.exists() {
            return candidate;
        }
        let direct = res_dir.join("taskeen.db");
        if direct.exists() {
            return direct;
        }
    }
    PathBuf::from("resources/taskeen.db")
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    let tray_ok = window
                        .try_state::<TrayAvailable>()
                        .map(|t| t.0.load(Ordering::Relaxed))
                        .unwrap_or(false);
                    if tray_ok {
                        let _ = window.hide();
                        api.prevent_close();
                    }
                }
            }
        })
        .setup(|app| {
            let content_db_path = resolve_content_db(app);
            let db_sha256 = compute_sha256(&content_db_path).unwrap_or_else(|_| "missing".to_string());
            let expected_sha256 = env!("TASKEEN_DB_SHA256");
            let db_verified = db_sha256 != "missing" && db_sha256 == expected_sha256;
            let content_conn = match Connection::open_with_flags(&content_db_path, OpenFlags::SQLITE_OPEN_READ_ONLY) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("taskeen.db could not be opened ({e}); using empty fallback, UI will use bundled JSON");
                    open_empty_content_db()
                }
            };
            let db_verified = db_verified && content_conn.query_row("SELECT COUNT(*) FROM items", [], |r| r.get::<_, i64>(0)).is_ok();

            let data_dir = app.path().app_data_dir().expect("Failed to resolve app_data_dir");
            fs::create_dir_all(&data_dir).expect("Failed to create app data directory");
            let user_db_path = data_dir.join("taskeen_user.db");

            // --- Data-at-rest encryption: key lives in the OS keychain ---
            let had_encrypted = file_has_encrypted_rows(&user_db_path);
            let mut crypto = CryptoStatus { enabled: false, error: None, recovered: false };
            let mut use_memory_db = false;
            match keystore::load_or_create_key(!had_encrypted) {
                Ok(key) => {
                    init_data_key(key);
                    crypto.enabled = true;
                }
                Err(KeyError::Missing) => {
                    // Encrypted data exists but its key is gone. Never overwrite it:
                    // set the old file aside and start fresh (restore from an encrypted backup).
                    archive_user_db(&user_db_path);
                    match keystore::create_key() {
                        Ok(key) => {
                            init_data_key(key);
                            crypto.enabled = true;
                            crypto.recovered = true;
                        }
                        Err(KeyError::Other(e)) => crypto.error = Some(e),
                        Err(KeyError::Missing) => crypto.error = Some("key তৈরি করা যায়নি".to_string()),
                    }
                }
                Err(KeyError::Other(e)) => {
                    crypto.error = Some(e);
                    // Encrypted rows exist but the keychain is unavailable: keep this session
                    // in memory so nothing on disk is clobbered.
                    if had_encrypted {
                        use_memory_db = true;
                    }
                }
            }

            let user_conn = if use_memory_db {
                Connection::open_in_memory().expect("Failed to open in-memory user database")
            } else {
                Connection::open(&user_db_path).expect("Failed to open taskeen_user.db")
            };
            init_user_tables(&user_conn).expect("Failed to initialize user_logs table");
            if crypto.enabled {
                match migrate_plaintext_to_encrypted(&user_conn) {
                    Ok(n) if n > 0 => eprintln!("{n} plaintext rows encrypted"),
                    Ok(_) => {}
                    Err(e) => crypto.error = Some(format!("মাইগ্রেশন ব্যর্থ: {e}")),
                }
            }
            app.manage(crypto);

            app.manage(DbState {
                content_conn: Mutex::new(content_conn),
                user_conn: Mutex::new(user_conn),
                db_sha256,
                db_verified,
            });

            // System Tray setup
            let next_prayer_item = MenuItem::with_id(app, "next_prayer", "পরবর্তী নামাজ লোড হচ্ছে...", false, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let show_item = MenuItem::with_id(app, "show", "তাসকীন খুলুন", true, None::<&str>)?;
            let mini_item = MenuItem::with_id(app, "mini", "মিনি তাসবীহ (Ctrl+Shift+T)", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "বন্ধ করুন", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&next_prayer_item, &sep, &show_item, &mini_item, &quit_item])?;

            app.manage(TrayNextPrayerItem(Mutex::new(Some(next_prayer_item))));

            let mut tray_built = false;
            if let Some(icon) = app.default_window_icon().cloned() {
                TrayIconBuilder::with_id("taskeen-tray")
                    .icon(icon)
                    .menu(&menu)
                    .tooltip("তাসকীন (Taskeen)")
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => {
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                        "mini" => {
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                                let _ = win.emit("toggle-mini-mode", ());
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            if let Some(win) = tray.app_handle().get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                    })
                    .build(app)?;
                tray_built = true;
            }
            app.manage(TrayAvailable(AtomicBool::new(tray_built)));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_status,
            fetch_items,
            search_items,
            load_user_logs,
            upsert_user_log,
            load_user_kv,
            upsert_user_kv,
            export_backup,
            import_backup,
            send_reminder_notification,
            update_tray_next_prayer,
            hash_app_pin,
            verify_app_pin,
            open_external_url,
            cloud_sync_push,
            cloud_sync_pull,
            get_crypto_status,
            delete_user_kv,
            save_file,
            set_mini_mode
        ])
        .run(tauri::generate_context!())
        .expect("error while running Taskeen application");
}
