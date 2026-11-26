#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;

use db::{
    compute_sha256, export_encrypted_backup, get_all_items, get_all_kv, get_item_count,
    get_user_logs, hash_pin, import_encrypted_backup, init_user_tables, save_user_log,
    search_items_fts, set_kv, verify_pin, DbState, DbStatus, TaskeenItem, UserKvRow, UserLogRow,
};
use rusqlite::{Connection, OpenFlags};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, LogicalSize, Manager, Size, State, WindowEvent};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

struct TrayNextPrayerItem(Mutex<Option<MenuItem<tauri::Wry>>>);

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

#[tauri::command]
fn export_backup(passphrase: String, state: State<DbState>) -> Result<String, String> {
    let conn = state.user_conn.lock().map_err(|e| e.to_string())?;
    export_encrypted_backup(&conn, &passphrase)
}

#[tauri::command]
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

#[tauri::command]
fn hash_app_pin(pin: String) -> Result<String, String> {
    hash_pin(&pin)
}

#[tauri::command]
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

#[tauri::command]
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
    let mut req = ureq::post(&url)
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
        "updated_at": format!("{:?}", std::time::SystemTime::now()),
    });
    req.send_json(body).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn cloud_sync_pull(
    url: String,
    api_key: String,
    passphrase: String,
    state: State<DbState>,
) -> Result<usize, String> {
    if !url.starts_with("https://") {
        return Err("ক্লাউড সিঙ্কের জন্য অবশ্যই https:// URL ব্যবহার করুন".to_string());
    }
    let mut req = ureq::get(&url);
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
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .setup(|app| {
            let content_db_path = resolve_content_db(app);
            let db_sha256 = compute_sha256(&content_db_path).unwrap_or_else(|_| "missing".to_string());
            let expected_sha256 = env!("TASKEEN_DB_SHA256");
            let db_verified = db_sha256 != "missing" && db_sha256 == expected_sha256;
            let content_conn = Connection::open_with_flags(&content_db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
                .expect("Failed to open taskeen.db content database in read-only mode");

            let data_dir = app.path().app_data_dir().expect("Failed to resolve app_data_dir");
            fs::create_dir_all(&data_dir).expect("Failed to create app data directory");
            let user_db_path = data_dir.join("taskeen_user.db");
            let user_conn = Connection::open(&user_db_path)
                .expect("Failed to open taskeen_user.db");
            init_user_tables(&user_conn).expect("Failed to initialize user_logs table");

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
            }

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
            set_mini_mode
        ])
        .run(tauri::generate_context!())
        .expect("error while running Taskeen application");
}
