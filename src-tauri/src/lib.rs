mod keychain;
mod oauth_listener;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_process::init())
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
      #[cfg(desktop)]
      {
        app
          .handle()
          .plugin(tauri_plugin_updater::Builder::new().build())?;

        if let Some(window) = app.get_webview_window("main") {
          let _ = window.set_icon(tauri::include_image!("./icons/128x128@2x.png"));
        }
      }
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
