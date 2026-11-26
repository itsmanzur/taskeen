//! OS-keychain backed data key for field-level encryption of personal data.
//! Windows: Credential Manager · macOS: Keychain · Linux: Secret Service.

use rand_core::{OsRng, RngCore};

const SERVICE: &str = "com.taskeen.desktop";
const ACCOUNT: &str = "user-data-key-v1";

pub enum KeyError {
    /// The keychain is reachable but holds no key (deleted, new OS user, new machine).
    Missing,
    /// Keychain unavailable, locked, or returned garbage.
    Other(String),
}

fn entry() -> Result<keyring::Entry, KeyError> {
    keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| KeyError::Other(e.to_string()))
}

fn decode_key(s: &str) -> Result<[u8; 32], KeyError> {
    let bytes = hex::decode(s.trim()).map_err(|_| KeyError::Other("কীচেইনে রাখা key ক্ষতিগ্রস্ত".into()))?;
    if bytes.len() != 32 {
        return Err(KeyError::Other("কীচেইনে রাখা key-র দৈর্ঘ্য ভুল".into()));
    }
    let mut key = [0u8; 32];
    key.copy_from_slice(&bytes);
    Ok(key)
}

/// Reads the existing key. If none exists and `allow_create` is true, creates and stores one.
pub fn load_or_create_key(allow_create: bool) -> Result<[u8; 32], KeyError> {
    let entry = entry()?;
    match entry.get_password() {
        Ok(s) => decode_key(&s),
        Err(keyring::Error::NoEntry) => {
            if allow_create {
                create_key()
            } else {
                Err(KeyError::Missing)
            }
        }
        Err(e) => Err(KeyError::Other(e.to_string())),
    }
}

/// Generates a fresh random key and stores it, verifying it can be read back.
pub fn create_key() -> Result<[u8; 32], KeyError> {
    let entry = entry()?;
    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);
    entry
        .set_password(&hex::encode(key))
        .map_err(|e| KeyError::Other(e.to_string()))?;
    let back = entry.get_password().map_err(|e| KeyError::Other(e.to_string()))?;
    if decode_key(&back)? != key {
        return Err(KeyError::Other("কীচেইনে key সেভ যাচাই ব্যর্থ".into()));
    }
    Ok(key)
}
