# CSV Format Guide

This document describes the CSV format for importing players into Stadium PUGs Balancer.

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

### Optional Columns

| Column | Format | Example | Description |
|--------|--------|---------|-------------|
| `role_preference` | Comma-separated | `Support,DPS` | Preferred role order (first = most preferred) |
| `hero_pool` | Comma-separated | `Ana,Kiriko,Baptiste` | Heroes the player plays |
| `is_one_trick` | `true`/`false` | `true` | Whether player only plays one hero |
| `one_trick_hero` | Hero name | `Tracer` | Required if `is_one_trick` is true |
| `regular_comp_rank` | `Tier [1-5]` | `Diamond 2` | Fallback rank from regular competitive |
| `weight_modifier` | Integer | `-100` | SR adjustment (-1000 to +1000) |
| `notes` | Text | `Shotcaller` | Any notes about the player |

### Competitive Rank Fallback

If a Stadium rank is not available for a role, the app uses `regular_comp_rank` as a fallback.

**Valid Competitive Tiers**: Bronze, Silver, Gold, Platinum, Diamond, Master, Grandmaster, Champion

## Example CSV

```csv
battletag,tank_rank,dps_rank,support_rank,roles_willing,role_preference,hero_pool,is_one_trick,one_trick_hero,regular_comp_rank,weight_modifier,notes
Fury#1234,Pro 2,Pro 1,Elite 3,"Tank,DPS","Tank,DPS","Reinhardt,D.Va,Zarya,Soldier: 76",false,,Master 2,0,Main tank player
Aurora#5678,Elite 2,Pro 3,Pro 2,"DPS,Support","Support,DPS","Ana,Kiriko,Baptiste,Ashe",false,,Diamond 1,0,Flex support
Pixel#7890,Contender 3,Pro 2,Novice 1,"DPS","DPS","Tracer",true,Tracer,Platinum 1,0,Tracer OTP
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
