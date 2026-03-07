# CSV Format Guide

This document describes the CSV format for importing players into PUGs Balancer.

## Quick Start

Download a template from the app by clicking **📥 Download Template** in the Import section.

## Column Reference

### Required Columns

| Column | Format | Example | Description |
|--------|--------|---------|-------------|
| `battletag` | `Name#12345` | `Player#1234` | Player's BattleTag (must include `#` and numbers) |
| `roles_willing` | Comma-separated | `Tank,DPS` | Roles the player is willing to play |

### Stadium Rank Columns

| Column | Format | Example | Description |
|--------|--------|---------|-------------|
| `tank_rank` | `Tier [1-5]` | `Pro 2` | Stadium rank for Tank role |
| `dps_rank` | `Tier [1-5]` | `Elite 1` | Stadium rank for DPS role |
| `support_rank` | `Tier [1-5]` | `All-Star 3` | Stadium rank for Support role |

**Valid Stadium Tiers**: Rookie, Novice, Contender, Elite, Pro, All-Star, Legend

**Sub-ranks**: 1 (highest) to 5 (lowest). If omitted, defaults to 3.

### Regular Competitive Rank Columns

| Column | Format | Example | Description |
|--------|--------|---------|-------------|
| `tank_comp_rank` | `Tier [1-5]` | `Master 2` | Regular comp rank for Tank role |
| `dps_comp_rank` | `Tier [1-5]` | `Diamond 1` | Regular comp rank for DPS role |
| `support_comp_rank` | `Tier [1-5]` | `Grandmaster 3` | Regular comp rank for Support role |
| `regular_comp_rank` | `Tier [1-5]` | `Diamond 2` | Global fallback rank for all roles |

**Valid Competitive Tiers**: Bronze, Silver, Gold, Platinum, Diamond, Master, Grandmaster, Champion

**Rank Resolution (Regular 5v5 mode)**:
1. Role-specific comp rank (e.g., `tank_comp_rank`)
2. Global `regular_comp_rank`
3. Stadium rank for that role
4. Default SR (2500)

### Optional Columns

| Column | Format | Example | Description |
|--------|--------|---------|-------------|
| `role_preference` | Comma-separated | `Support,DPS` | Preferred role order (first = most preferred) |
| `hero_pool` | Comma-separated | `Ana,Kiriko,Baptiste` | Heroes the player plays |
| `is_one_trick` | `true`/`false` | `true` | Whether player only plays one hero |
| `one_trick_hero` | Hero name | `Tracer` | Required if `is_one_trick` is true |
| `weight_modifier` | Integer | `-100` | SR adjustment (-1000 to +1000) |
| `notes` | Text | `Shotcaller` | Any notes about the player |
| `stadium_wins` | Integer | `5` | Total wins in Stadium 5v5 mode |
| `regular_5v5_wins` | Integer | `3` | Total wins in Regular 5v5 mode |
| `regular_6v6_wins` | Integer | `0` | Total wins in Regular 6v6 mode |

### Rank Fallback System

**Stadium 5v5 Mode**: Uses Stadium ranks first, falls back to competitive ranks.

**Regular 5v5 Mode**: Uses competitive ranks first, falls back to Stadium ranks.

If no rank is available for a role, the app uses default SR (2500).

## Example CSV

```csv
battletag,tank_rank,dps_rank,support_rank,tank_comp_rank,dps_comp_rank,support_comp_rank,roles_willing,role_preference,hero_pool,tank_one_trick,dps_one_trick,support_one_trick,regular_comp_rank,weight_modifier,notes,stadium_wins,regular_5v5_wins,regular_6v6_wins
Fury#1234,Pro 2,Pro 1,Elite 3,Grandmaster 3,Champion 1,Master 2,"Tank,DPS","Tank,DPS","Reinhardt,D.Va,Zarya,Soldier: 76",,,Grandmaster 2,0,Main tank player,5,3,0
Aurora#5678,Elite 2,Pro 3,Pro 2,Diamond 3,Master 2,Grandmaster 1,"DPS,Support","Support,DPS","Ana,Kiriko,Baptiste,Ashe",,,Master 1,0,Flex support,2,1,0
Pixel#7890,Contender 3,Pro 2,Novice 1,Platinum 2,Grandmaster 2,Silver 3,"DPS","DPS","Tracer",,Tracer,,Master 1,0,Tracer OTP,0,0,0
```

## Delimiter Support

The app auto-detects whether your CSV uses commas `,` or semicolons `;` as delimiters.

## Quoted Fields

Use double quotes for fields containing commas:
- Correct: `"Tank,DPS,Support"`
- Incorrect: `Tank,DPS,Support` (would be parsed as separate columns)

## Hero Names

Hero names should match their in-game names exactly:
- Use `D.Va` (not `DVa` or `Dva`)
- Use `Soldier: 76` (with space after colon)
- Use `Wrecking Ball` (not `Hammond`)
- Use `Lúcio` or `Lucio` (both work)

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Battletag is required" | Empty battletag cell | Add player's BattleTag |
| "Invalid battletag format" | Missing `#` or numbers | Use format `Name#12345` |
| "Must specify at least one role" | Empty `roles_willing` | Add at least one role |
| "One-trick hero required" | `is_one_trick` is true but no hero | Set `one_trick_hero` or set `is_one_trick` to false |
| "Unknown rank tier" | Invalid rank name | Use valid Stadium/Competitive tier names |

## Warnings

These don't prevent import but may affect balancing:

| Warning | Meaning |
|---------|---------|
| "No rank for [Role]" | Player has no rank for a willing role; uses default SR (2500) |
| "Unknown hero: [Name]" | Hero not recognized; archetype checks may be affected |
| "Weight modifier outside range" | Value outside -1000 to +1000; still applied |

## Backwards Compatibility

The following columns are still supported for backwards compatibility but are deprecated:

| Old Column | Replacement |
|------------|-------------|
| `is_one_trick` | `tank_one_trick`, `dps_one_trick`, `support_one_trick` |
| `one_trick_hero` | Role-specific one-trick columns |
| `all_time_wins` | `stadium_wins`, `regular_5v5_wins`, `regular_6v6_wins` |

When importing old CSVs:
- `all_time_wins` values are migrated to `stadium_wins`
- `one_trick_hero` is still recognized for backwards compatibility
