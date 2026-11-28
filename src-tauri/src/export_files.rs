use std::path::{Component, Path, PathBuf};
use tauri::Manager;

fn resolve_export_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let docs = app
    .path()
    .document_dir()
    .map_err(|e| format!("Failed to locate Documents folder: {e}"))?;
  let export_dir = docs.join("SwoosPugsBalancer").join("export");
  std::fs::create_dir_all(&export_dir)
    .map_err(|e| format!("Failed to create export folder: {e}"))?;
  Ok(export_dir)
}

fn sanitize_csv_filename(filename: &str) -> Result<String, String> {
  let trimmed = filename.trim();
  if trimmed.is_empty() {
    return Err("Export filename cannot be empty".into());
  }
  let mut components = Path::new(trimmed).components();
  let single = match (components.next(), components.next()) {
    (Some(Component::Normal(name)), None) => name.to_string_lossy().into_owned(),
    _ => return Err("Invalid export filename".into()),
  };
  if !single.to_lowercase().ends_with(".csv") {
    return Err("Export file must have a .csv extension".into());
  }
  Ok(single)
}

#[tauri::command]
pub fn export_csv_file(
  app: tauri::AppHandle,
  filename: String,
  content: String,
) -> Result<String, String> {
  let export_dir = resolve_export_dir(&app)?;
  let safe_name = sanitize_csv_filename(&filename)?;
  let target = export_dir.join(safe_name);
  std::fs::write(&target, content)
    .map_err(|e| format!("Failed to write exported CSV: {e}"))?;
  Ok(target.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn open_export_folder(app: tauri::AppHandle) -> Result<String, String> {
  let export_dir = resolve_export_dir(&app)?;

  #[cfg(target_os = "windows")]
  std::process::Command::new("explorer")
    .arg(&export_dir)
    .spawn()
    .map_err(|e| format!("Failed to open Explorer: {e}"))?;

  #[cfg(target_os = "macos")]
  std::process::Command::new("open")
    .arg(&export_dir)
    .spawn()
    .map_err(|e| format!("Failed to open Finder: {e}"))?;

  #[cfg(all(unix, not(target_os = "macos")))]
  std::process::Command::new("xdg-open")
    .arg(&export_dir)
    .spawn()
    .map_err(|e| format!("Failed to open file manager: {e}"))?;

  Ok(export_dir.to_string_lossy().into_owned())
}
