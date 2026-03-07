# Troubleshooting Guide

## Installation Issues

### "WebView2 Runtime not found"

The app requires Microsoft Edge WebView2 Runtime to display the interface.

**Solution**: 
1. The installer should download it automatically
2. If it fails, manually download from: https://developer.microsoft.com/en-us/microsoft-edge/webview2/
3. Install the "Evergreen Bootstrapper" or "Evergreen Standalone Installer"

### App won't start / Blank window

**Possible causes**:
- Corrupted local data
- WebView2 not installed properly

**Solutions**:
1. Try the "Clear Data & Reload" button if visible
2. Delete the app's data folder:
   - Press `Win + R`, type `%APPDATA%`, press Enter
   - Delete the `com.stadiumbalancer.pugs` folder
3. Reinstall WebView2 Runtime

---

## Import Issues

### "Invalid battletag format"

BattleTags must follow the format `Name#12345`.

**Check**:
- Tag includes `#` symbol
- Numbers follow the `#`
- No extra spaces

### "Must specify at least one role"

The `roles_willing` column cannot be empty.

**Fix**: Add at least one of: `Tank`, `DPS`, `Support`

### "Unknown Stadium rank tier"

Stadium uses different rank names than regular competitive.

**Stadium Tiers**: Rookie, Novice, Contender, Elite, Pro, All-Star, Legend

**NOT**: Bronze, Silver, Gold, Platinum, Diamond, Master (these are competitive ranks)

### CSV not importing at all

**Check**:
- File is saved as `.csv` (not `.xlsx`)
- First row contains column headers
- Using commas or semicolons consistently

---

## Balancing Issues

### "Need at least 10 active players"

The balancer requires exactly 10 players for two full teams.

**Solutions**:
- Add more players to the lobby
- Unmark some players as AFK
- Check that all required players are selected

### "Not enough [Role] players"

Cannot form valid teams because a role is missing.

**Requirements per game**:
- 2 Tank-willing players
- 4 DPS-willing players  
- 4 Support-willing players

**Note**: Flex players count toward all their willing roles.

### "Could not generate any valid team compositions"

The combination of locks, must-play, and role requirements is impossible.

**Try**:
- Remove some team locks
- Clear must-play flags
- Add more flex players to lobby

### Teams seem unbalanced

**Check**:
- Player ranks are correct (Stadium ranks, not competitive)
- Weight modifiers are reasonable
- One-trick conflicts aren't forcing suboptimal splits

---

## UI Issues

### Player cards not showing

**Try**:
- Refresh the page (F5 or Ctrl+R)
- Check browser console for errors (F12)
- Clear local data (see "Blank window" above)

### Changes not saving

Data saves automatically to localStorage.

**If data isn't persisting**:
- Check browser/app isn't in private/incognito mode
- Ensure sufficient disk space
- Try clearing and re-importing

### Filters not working

Search and filters work on:
- BattleTags (partial match)
- Hero names (partial match)
- Role filter shows players WILLING to play that role

---

## Performance Issues

### App is slow with many players

The balancer tests many combinations. Performance tips:

- Import only active community members (not entire historical rosters)
- Use team locks to reduce search space
- Consider splitting very large communities

### Build taking too long

For development builds:
```bash
# Use dev mode instead of full build
npm run tauri:dev
```

---

## Game Mode Issues

### Wrong ranks being used

The app uses different ranks based on game mode:
- **Stadium 5v5**: Uses Stadium ranks (`tank_rank`, `dps_rank`, `support_rank`)
- **Regular 5v5**: Uses competitive ranks (`tank_comp_rank`, `dps_comp_rank`, `support_comp_rank`, or `regular_comp_rank`)

**Check**: Make sure you're in the correct mode for your players' rank data.

### Heroes not showing in hero pool dropdown

In Stadium 5v5 mode, only 31 Stadium-eligible heroes are available.

**Solution**: Switch to Regular 5v5 mode to access all 52 heroes.

### Mode switch resets my stats

This is expected behavior. Session stats (wins, losses, adaptive weights) are mode-specific.

**Tip**: Export your CSV before switching modes to save session wins.

### Can't see the mode selector

The mode selector is in the top-right corner of the header, next to the mode badge.

---

## Common Questions

### How do I update player data?

1. Edit the player in-app (hover over card, click ✏️)
2. Or re-import CSV with updated data (will replace all players)

### How do I reset everything?

1. In app: Use ErrorBoundary's "Clear Data & Reload" if shown
2. Manual: Delete localStorage data (see "Blank window" section)

### Can I export my player data?

Yes! Click "📤 Export CSV" in the Player Data section. The export includes:
- All player data
- Session wins (added to all_time_wins)
- Current game mode in filename

### Does this work offline?

Yes! Once installed, the app works completely offline. All data is stored locally.

---

## Getting Help

If you encounter issues not covered here:

1. Check the [GitHub Issues](https://github.com/your-repo/issues) for known problems
2. Open a new issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Browser/app version
