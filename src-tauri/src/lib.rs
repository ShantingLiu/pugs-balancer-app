mod keychain;
mod oauth_listener;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_http::init())
    .invoke_handler(tauri::generate_handler![
      keychain::keychain_set,
      keychain::keychain_get,
      keychain::keychain_delete,
      oauth_listener::bind_oauth_listener,
      oauth_listener::await_oauth_redirect,
    ])
    .manage(oauth_listener::OAuthListenerState(
      std::sync::Mutex::new(None),
    ))
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
