import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { fetch } from "@tauri-apps/plugin-http";
import { useSheetStore } from "@store/sheetStore";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

let cachedTokens: AuthTokens | null = null;

// ---------------------------------------------------------------------------
// PKCE Utilities (§3.3)
// ---------------------------------------------------------------------------

export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

export function base64UrlEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// Token Exchange & Refresh (§3.6, §3.7)
// ---------------------------------------------------------------------------

async function exchangeCodeForTokens(
  authCode: string,
  codeVerifier: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
): Promise<AuthTokens> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: authCode,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token exchange failed: ${response.status} — ${body}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<AuthTokens> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!response.ok) {
    cachedTokens = null;
    throw new Error("TOKEN_REFRESH_FAILED");
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

// ---------------------------------------------------------------------------
// Public API (§3.2)
// ---------------------------------------------------------------------------

export async function signIn(clientId: string, clientSecret: string): Promise<void> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const port = await invoke<number>("bind_oauth_listener");
  const redirectUri = `http://127.0.0.1:${port}`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope:
      "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  });

  await open(`${GOOGLE_AUTH_URL}?${params.toString()}`);

  const authCode = await invoke<string>("await_oauth_redirect");

  const tokens = await exchangeCodeForTokens(
    authCode,
    codeVerifier,
    redirectUri,
    clientId,
    clientSecret,
  );

  await invoke("keychain_set", {
    service: "pugs-balancer",
    key: "google_refresh_token",
    value: tokens.refreshToken,
  });

  cachedTokens = tokens;
  useSheetStore.getState().setAuthenticated(true);
}

export async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedTokens && cachedTokens.expiresAt > Date.now() + 60_000) {
    return cachedTokens.accessToken;
  }

  const refreshToken = await invoke<string | null>("keychain_get", {
    service: "pugs-balancer",
    key: "google_refresh_token",
  });

  if (!refreshToken) {
    throw new Error("NOT_AUTHENTICATED");
  }

  const tokens = await refreshAccessToken(refreshToken, clientId, clientSecret);
  cachedTokens = tokens;
  return tokens.accessToken;
}

export async function signOut(): Promise<void> {
  if (cachedTokens) {
    try {
      await fetch(GOOGLE_REVOKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `token=${cachedTokens.refreshToken}`,
      });
    } catch {
      // Revocation failed (e.g., offline) — clear local tokens anyway
    }
  }

  await invoke("keychain_delete", {
    service: "pugs-balancer",
    key: "google_refresh_token",
  });

  cachedTokens = null;
  useSheetStore.getState().setAuthenticated(false);
}

export function isAuthenticated(): boolean {
  return cachedTokens !== null;
}

export function invalidateAccessToken(): void {
  cachedTokens = null;
}

export async function initAuth(clientId: string, clientSecret: string): Promise<void> {
  try {
    const refreshToken = await invoke<string | null>("keychain_get", {
      service: "pugs-balancer",
      key: "google_refresh_token",
    });

    if (!refreshToken) return;

    const tokens = await refreshAccessToken(refreshToken, clientId, clientSecret);
    cachedTokens = tokens;
    useSheetStore.getState().setAuthenticated(true);
  } catch {
    // Refresh failed (revoked, offline, etc.) — stay signed out
  }
}
