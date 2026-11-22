/** App version injected from src-tauri/tauri.conf.json at build/test time. */
export const APP_VERSION =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";
