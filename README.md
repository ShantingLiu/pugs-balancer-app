# PUGs Balancer

A desktop application for balancing Overwatch 2 PUG (Pick-Up Game) teams. Automatically creates fair team compositions based on player ranks, roles, hero pools, and preferences.

## Features

- **Multi-Mode Support**: Switch between Stadium 5v5, Regular 5v5, and Regular 6v6 game modes
- **Smart Team Balancing**: Uses **multi-restart simulated annealing** to find optimal team compositions — generates random valid arrangements, iteratively improves them through player/role swaps with temperature-based exploration, and repeats across multiple restarts to avoid local optima. Scales to any lobby size (10–100+ players) in milliseconds.
- **Role-Based Composition**: Ensures proper team composition (1-2-2 for 5v5, 2-2-2 for 6v6)
- **Archetype Parity**: Checks flyer vs hitscan coverage (Stadium mode only)
- **One-Trick Detection**: Warns when one-trick players conflict (Stadium mode only)
- **Mode-Aware Hero Pools**: Stadium mode uses restricted hero roster (31 heroes)
- **Soft Constraints**: Prefer certain players together or apart
- **Loss Streak Compensation**: Favors players on losing streaks for stronger teams
- **AFK/Must-Play System**: Track player availability and enforce sat-out priority
- **Persistent Data**: Player rosters and session state saved locally
- **Google Sheets Sync**: Share a player roster with co-pugmasters via Google Sheets — bidirectional manual sync with per-field conflict resolution

## Google Sheets Sync

Multiple pugmasters can share a single player roster via a Google Sheet. Changes are synced manually — no auto-sync or polling.

### Getting Started

1. **Sign In**: Click the **Sheets** dropdown in the header → **Sign in with Google**. This opens your browser for OAuth consent. The app requests only the permissions it needs (Sheets + Drive for creating files).

2. **Set Up a Sheet** (pick one):
   - **Create New Sheet** — Generates a template with proper headers, rank dropdowns, and an Info tab
   - **Connect Existing Sheet** — Paste a Google Sheets URL. The app validates that it has a "Roster" tab with the correct headers
   - **Upload Roster** — Creates a new sheet pre-populated with all your current local players

3. **Sync**: Click the **↻ Sync** button. The app reads the sheet, compares it to your local data, and shows a diff modal if there are changes.

### Sync Workflow

- **No changes**: Shows "Everything is up to date" toast
- **Changes detected**: Opens the Sync Diff Modal showing:
  - **Modified players** — Per-field conflict resolution. Click a field to choose local or remote value. Win counts default to the higher value.
  - **New from Sheet** — Remote-only players with import toggle
  - **New Locally** — Local-only players with push-to-sheet toggle
- **Bulk actions**: "Accept All Remote" / "Accept All Local" buttons
- **Cancel**: Closes the modal with no changes applied

### First Sync

When syncing for the first time (no previous sync recorded), the app defaults to **Accept All Remote** — the sheet roster replaces your local data. A banner explains this. Review the diff before applying.

### Unsynced Changes

An amber dot appears on the Sync button when you've made local changes (adding/editing/removing players) since the last sync. The badge clears after a successful sync.

### Token Storage

OAuth tokens are stored in your OS keychain (Windows Credential Manager). The refresh token persists across app restarts — you won't need to sign in again unless you explicitly sign out or revoke access.

### Disconnecting

Open the Sheets dropdown → **Disconnect**. This clears the sheet connection but keeps your local player data. If you have unsynced changes, the app warns before disconnecting.

## Game Modes

| Mode | Ranks Used | Hero Pool | Composition | Archetype Checks |
|------|-----------|-----------|-------------|------------------|
| **Stadium 5v5** | Stadium ranks (Rookie → Legend) | 31 Stadium-eligible heroes | 1T/2D/2S | Yes |
| **Regular 5v5** | Competitive ranks (Bronze → Champion) | All 52 heroes | 1T/2D/2S | No |
| **Regular 6v6** | Competitive ranks (Bronze → Champion) | All 52 heroes | 2T/2D/2S | No |

### Switching Modes

1. Click the mode badge in the top-right header
2. Select a new mode from the dropdown
3. Confirm the switch (session stats will reset)

**Tip**: Export your CSV before switching to save session wins.

## Installation

### Windows

1. Download the latest release:
   - `Swoos PUGs Balancer_x.x.x_x64-setup.exe` (NSIS installer - recommended)
   - Or `Swoos PUGs Balancer_x.x.x_x64_en-US.msi` (MSI installer)

2. Run the installer and follow the prompts

3. Launch "Swoo's PUGs Balancer" from the Start Menu

**Note**: The app requires WebView2 runtime. The installer will automatically download it if not present.

## Quick Start

1. **Add Players**: 
   - Click the **"+ Add"** button and fill in each player's info (name, ranks, roles, heroes)
   - *Or* for bulk import: Download the CSV template, fill it in, and drag-and-drop

2. **Build Lobby**:
   - Select 10+ players for the current lobby
   - Mark AFK players as needed
   - Set any soft constraints (together/apart)

3. **Balance Teams**:
   - Click "Balance Teams"
   - Review warnings and team compositions
   - Use lock buttons to keep specific players on teams
   - Click "Reshuffle" to try new combinations

4. **Record Results**:
   - Click "🏆 Team 1 Won" or "🏆 Team 2 Won"
   - Loss streaks update automatically
   - Sat-out players are marked as must-play

## Captain Draft Mode

For captain-pick sessions, use the **Draft** tab instead of auto-balancing:

1. **Switch to Draft** — Click the "👥 Draft" toggle at the top of the right panel
2. **Assign players** — Click a player in the Unassigned Pool → "→ Team 1" or "→ Team 2" (or drag-and-drop)
3. **Cycle roles** — Click the role badge (T/D/S) on an assigned player to cycle through their willing roles
4. **Unassign** — Click an assigned player to return them to the pool (or drag back)
5. **Fill Remaining** — After captains draft a few picks, click "⚡ Fill Remaining" to auto-balance the rest
6. **Post-match choice** — After recording a winner, choose "⚖️ Auto-Balance Next Game" or "👥 Draft Next Game"
7. **New Game** — Click "🔄 New Game" to clear teams without recording a result

The draft view shows composition warnings (role overflows) and dims players who can't fill any remaining open role.

## CSV Format

See [CSV Format Guide](docs/csv-format.md) for detailed column specifications.

Required columns:
- `battletag` - Player's BattleTag (e.g., `Player#1234`)
- `roles_willing` - Comma-separated roles: `Tank`, `DPS`, `Support`

Stadium rank columns:
- `tank_rank`, `dps_rank`, `support_rank` - Stadium ranks (e.g., `Pro 2`, `Elite 1`)

Regular competitive rank columns:
- `tank_comp_rank`, `dps_comp_rank`, `support_comp_rank` - Per-role comp ranks
- `regular_comp_rank` - Global fallback for all roles

Other optional columns:
- `role_preference` - Preferred role order
- `hero_pool` - Heroes the player plays
- `weight_modifier` - SR adjustment (-1000 to +1000)
- `stadium_wins`, `regular_5v5_wins`, `regular_6v6_wins` - Mode-specific win counts
- `notes` - Any notes about the player

## How the Balancer Works

The balancer uses **multi-restart simulated annealing** to find the best team compositions:

1. **Random Start**: Randomly assigns players to valid team slots (respecting role locks and must-play rules)
2. **Simulated Annealing**: Tries ~1,000 random moves per restart, each chosen randomly from four types:
   - **Inter-team swap (35%)** — Pick one player from each team and swap them across teams, each inheriting the other's role slot
   - **2-opt swap (5%)** — Pick *two* pairs of players across teams and swap both pairs simultaneously. This breaks plateaus where no single swap helps but two coordinated swaps do (e.g., a Tank and a DPS need to trade teams together for a net improvement)
   - **Bench swap (30%)** — Replace a playing player with a benched one in the same role slot
   - **Intra-team role swap (30%)** — Swap the roles of two players on the same team (e.g., a flex playing Tank switches to DPS with a teammate)
   
   Early iterations accept slightly worse moves (with decaying probability) to escape shallow local minima. Temperature decays linearly to zero, so late iterations are strictly greedy. The best-ever state is tracked and restored at the end.
3. **Multi-Restart**: Repeats this process 20 times with different random starting arrangements to avoid getting stuck on a local optimum
4. **Best Result**: Returns the best composition found across all restarts

**Complexity**: O(R × I × T) time, O(N) space — where R = restarts (20), I = iterations per restart (1,000), T = team size, and N = number of players. Bounded by iteration count, not combinatorics.

### Scoring

Each metric is **soft-normalized** using `x/(x+k)` then multiplied by an importance weight. Unlike hard clipping, this always provides gradient — the optimizer can distinguish 5 constraint violations from 10, rather than treating both as "maxed out":

| Factor | Weight | Half-point (k) | Description |
|--------|--------|-----------|-------------|
| Per-Role Matchup | 500 | 4000 | Role-vs-role SR gaps (e.g., GM tank vs Gold tank) |
| One-Trick Conflicts | 200 | 4 | Two one-tricks on same hero, same team (Stadium only) |
| Archetype Parity | 150 | binary | Flyer without opposing hitscan (Stadium only) |
| Soft Constraints | 120 | 5 | Together/apart preference violations |
| SR Variance | 100 | 800 | Teams with different internal skill spread |
| Role Preference | 50 | 20 | Playing 3rd-choice or worse roles (2nd-choice is fine) |

## Stadium Rank Tiers

| Tier | Base SR |
|------|---------|
| Rookie | 1000 |
| Novice | 1500 |
| Contender | 2000 |
| Elite | 2500 |
| Pro | 3000 |
| All-Star | 3500 |
| Legend | 4000 |

Sub-ranks (1-5) add 0-400 SR. Example: `Pro 1` = 3400 SR, `Pro 5` = 3000 SR

## Troubleshooting

See [Troubleshooting Guide](docs/troubleshooting.md) for common issues.

## Development

### Prerequisites

- Node.js 18+
- Rust 1.70+ (for Tauri)
- Windows 10/11 with WebView2 Runtime

### Setup

```bash
# Install dependencies
npm install

# Start web dev server (browser only)
npm run dev

# Start Tauri dev mode (desktop app with hot reload)
npm run tauri:dev
```

### Google Cloud Credentials

To enable Google Sheets sync during development, you need your own OAuth client ID. See [Google Cloud Setup Guide](docs/google-cloud-setup.md) for step-by-step instructions.

### Testing

```bash
# Run unit tests
npx vitest run

# Run tests in watch mode
npx vitest
```

### Building

```bash
# Build production installers (MSI + NSIS)
npm run tauri:build
```

Output locations after build:
- **EXE**: `src-tauri/target/release/app.exe` (standalone, no install required)
- **MSI**: `src-tauri/target/release/bundle/msi/Swoos PUGs Balancer_x.x.x_x64_en-US.msi`
- **NSIS**: `src-tauri/target/release/bundle/nsis/Swoos PUGs Balancer_x.x.x_x64-setup.exe`

### Running the Built App

After building, you can run the app directly without installing:

```bash
# Run the standalone executable
./src-tauri/target/release/app.exe
```

Or install via one of the installer packages for Start Menu integration.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS v4
- **State**: Zustand with localStorage persistence
- **Desktop**: Tauri 2.x (Rust)
- **Auth**: OAuth 2.0 PKCE with Google (tokens stored in OS keychain via Tauri)
- **Sync**: Google Sheets API (REST, called via Tauri HTTP plugin — no npm Google libs)
- **Testing**: Vitest

## License

MIT
