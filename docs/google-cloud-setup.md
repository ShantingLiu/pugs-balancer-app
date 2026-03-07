# Google Cloud Console Setup

This guide walks through setting up Google Cloud credentials for local development. You only need to do this once.

## 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown (top-left) → **New Project**
3. Name it something like `PUGs Balancer Dev`
4. Click **Create**

## 2. Enable APIs

In **APIs & Services → Library**, search for and enable:

- **Google Sheets API**
- **Google Drive API**

Both are required — Sheets API for reading/writing roster data, Drive API for creating new spreadsheets.

## 3. Configure OAuth Consent Screen

Go to **APIs & Services → OAuth consent screen**:

| Setting | Value |
|---------|-------|
| User type | **External** |
| App name | `PUGs Balancer` (or any name) |
| User support email | Your email |
| Developer contact | Your email |

On the **Scopes** step, add:

| Scope | Purpose |
|-------|---------|
| `https://www.googleapis.com/auth/spreadsheets` | Read/write sheet data |
| `https://www.googleapis.com/auth/drive.file` | Create new spreadsheets |

On the **Test users** step, add the Google accounts that will use the app. While the app is unverified, only test users can sign in.

## 4. Create OAuth Credentials

Go to **APIs & Services → Credentials**:

1. Click **Create Credentials → OAuth client ID**
2. Application type: **Desktop app**
3. Name: `PUGs Balancer Desktop` (or any name)
4. Click **Create**
5. Copy the **Client ID** (looks like `123456789-abc...xyz.apps.googleusercontent.com`)
6. Copy the **Client secret** (looks like `GOCSPX-...`)

## 5. Configure the App

Paste your client ID and secret into `src/config/google.ts`:

```typescript
export const GOOGLE_CLIENT_ID = "your-client-id-here.apps.googleusercontent.com";
export const GOOGLE_CLIENT_SECRET = "your-client-secret-here";
```

> **Note**: For desktop app credentials, neither the client ID nor secret are truly confidential — Google's own docs state they are "not treated as a secret". Security comes from PKCE, user consent, and the loopback redirect. This is the standard approach used by gcloud CLI, VS Code, and other desktop apps. It is safe to commit.

## 6. Verify It Works

1. Run the app with `npm run tauri:dev`
2. Click the **Sheets** dropdown → **Sign in with Google**
3. Your browser should open to the Google consent screen
4. After approving, the app should show "Signed in ✓"

## Troubleshooting

**"Access blocked: This app's request is invalid"**
- Verify the OAuth client type is **Desktop app** (not Web application)
- Check that both Sheets API and Drive API are enabled

**"This app isn't verified"**
- Expected for development. Click **Continue** (or **Advanced → Go to PUGs Balancer**)
- Only accounts listed as test users can proceed

**Sign-in opens browser but app doesn't detect the redirect**
- The app starts a localhost listener on a random port. Firewalls or antivirus may block this
- Ensure nothing blocks `127.0.0.1` loopback connections

**"NOT_AUTHENTICATED" error when syncing**
- Sign out and sign back in to get a fresh token
- If the issue persists, re-check that `GOOGLE_CLIENT_ID` matches your credentials
