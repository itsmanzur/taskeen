use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;

fn main() {
    let db_path = Path::new("resources/taskeen.db");
    println!("cargo:rerun-if-changed=resources/taskeen.db");
    let expected_hash = if let Ok(bytes) = fs::read(db_path) {
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        hex::encode(hasher.finalize())
    } else {
        "missing".to_string()
    };
    println!("cargo:rustc-env=TASKEEN_DB_SHA256={}", expected_hash);
    tauri_build::build()
}
