// Desktop OAuth credentials — embedded in the binary, not truly secret.
// Google requires client_secret for Desktop app credentials as a protocol
// formality. Security comes from PKCE + user consent + loopback redirect,
// not from these values. This is the standard Google-endorsed approach
// for desktop apps (same as gcloud CLI, VS Code extensions, etc.).
export const GOOGLE_CLIENT_ID =
  "231988464401-0ig2vko6md6pnj6l0r9ljr283ve1uqds.apps.googleusercontent.com";

export const GOOGLE_CLIENT_SECRET = "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";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
];
