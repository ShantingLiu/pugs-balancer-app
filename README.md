# Stadium PUGs Balancer

A desktop application for balancing Overwatch 2 Stadium PUG (Pick-Up Game) teams. Automatically creates fair 5v5 team compositions based on player ranks, roles, hero pools, and preferences.

## Features

- **Smart Team Balancing**: Creates balanced teams based on Stadium rank SR values
- **Role-Based Composition**: Ensures proper 1 Tank / 2 DPS / 2 Support per team
- **Archetype Parity**: Checks flyer vs hitscan coverage between teams
- **One-Trick Detection**: Warns when one-trick players conflict on same team
- **Soft Constraints**: Prefer certain players together or apart
- **Loss Streak Compensation**: Favors players on losing streaks for stronger teams
- **AFK/Must-Play System**: Track player availability and enforce sat-out priority
- **Persistent Data**: Player rosters and session state saved locally

## Installation

### Windows

1. Download the latest release:
   - `Stadium PUGs Balancer_x.x.x_x64-setup.exe` (NSIS installer - recommended)
   - Or `Stadium PUGs Balancer_x.x.x_x64_en-US.msi` (MSI installer)

2. Run the installer and follow the prompts

3. Launch "Stadium PUGs Balancer" from the Start Menu

**Note**: The app requires WebView2 runtime. The installer will automatically download it if not present.

## Quick Start

1. **Import Players**: 
   - Click "📥 Download Template" to get a CSV template
   - Fill in your player data (see CSV Format below)
   - Drag-and-drop the CSV file or paste directly

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

## CSV Format

See [CSV Format Guide](docs/csv-format.md) for detailed column specifications.

Required columns:
- `battletag` - Player's BattleTag (e.g., `Player#1234`)
- `roles_willing` - Comma-separated roles: `Tank`, `DPS`, `Support`

Optional columns:
- `tank_rank`, `dps_rank`, `support_rank` - Stadium ranks (e.g., `Pro 2`, `Elite 1`)
- `role_preference` - Preferred role order
- `hero_pool` - Heroes the player plays
- `is_one_trick` - `true`/`false`
- `one_trick_hero` - Hero name if one-trick
- `regular_comp_rank` - Fallback rank from regular competitive
- `weight_modifier` - SR adjustment (-1000 to +1000)
- `notes` - Any notes about the player

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

### Testing

```bash
# Run unit tests
npm run test

# Run tests in watch mode
npm run test -- --watch
```

### Building

```bash
# Build production installers (MSI + NSIS)
npm run tauri:build
```

Output locations after build:
- **EXE**: `src-tauri/target/release/app.exe` (standalone, no install required)
- **MSI**: `src-tauri/target/release/bundle/msi/Stadium PUGs Balancer_x.x.x_x64_en-US.msi`
- **NSIS**: `src-tauri/target/release/bundle/nsis/Stadium PUGs Balancer_x.x.x_x64-setup.exe`

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
- **Testing**: Vitest

## License

MIT
