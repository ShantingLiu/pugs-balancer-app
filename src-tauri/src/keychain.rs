use keyring::Entry;
use tauri::command;

#[command]
pub fn keychain_set(service: &str, key: &str, value: &str) -> Result<(), String> {
    let entry = Entry::new(service, key).map_err(|e| e.to_string())?;
    entry.set_password(value).map_err(|e| e.to_string())
}

#[command]
pub fn keychain_get(service: &str, key: &str) -> Result<Option<String>, String> {
    let entry = Entry::new(service, key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pw) => Ok(Some(pw)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[command]
pub fn keychain_delete(service: &str, key: &str) -> Result<(), String> {
    let entry = Entry::new(service, key).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
