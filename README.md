# Where the Roads End

A hardcore zombie survival-and-reclamation modpack built on **Minecraft Forge 1.20.1**.

> The surface belongs to the dead. Safety is built, not given. Rebuilding is
> possible — but only after surviving hell.

You start as prey, not a hero: hide, barricade, and endure the outbreak before
you can ever begin clearing land and rebuilding civilization in the ruins.

## What this repo tracks

This is the **customization layer** of the pack, not the full instance. Mod jars,
world saves, logs and caches are intentionally **not** committed (see `.gitignore`).

| Path | Contents |
|------|----------|
| `kubejs/server_scripts/` | Custom systems — zombie block-breaking, WWZ buffs, finite zombie migration (`/zspawn`, safe-zone) |
| `config/` | All tuned mod configs (hordes events off + infection on, de-magicked detection, spawner rules, perf) |
| `patchouli_books/` | In-game guide book |
| `mods-list.txt` | The frozen 214-mod list |
| `options.txt` | Video/sim-distance settings |

## Custom scripts

- **`00_reclamation_phases.js`** - day-based apocalypse curve: days 0-30 brutal outbreak, 30-100 degradation, 100-250 reclamation window, 250+ residual dead.
- **`01_zombie_spawn_director.js`** - active zombie budget guard: local/player-area caps prevent 600 physical zombies from simulating at once.
- **`zombie_softblock_break.js`** — undead chew soft blocks instantly, wood barricades after sustained pressure.
- **`zombie_buff.js`** — phase-scaled undead attributes; no reinforcement spam.
- **`zombie_migration.js`** — phase-scaled finite "loose population" reserve, fed by spawners and drained by kills, that trickles toward you from the dead city; `/zspawn [n]` forces a wave; base safe-zone excluded.
- **`zombie_noise_lure.js`** - player movement, jumping, block mining/breaking, and block placing pull nearby undead toward the survivor.
- **`zombie_stealth.js`** - the inverse of the noise lure: while crouched, nearby undead lose your trail (beyond point-blank ~2.5 blocks), and sneak-walking stops luring. Sneak past or break away.
- **`zombie_green_zones.js`** - reclaimed safe areas. `/zone pos1|pos2|create <name>|list|remove <name>|show` (cheats) declare a cleared box; nothing **spawns** inside it (corpse-zombies excepted, walk-ins not despawned). Auto-pads to seal walls; full-height; must clear the area first. Action-bar enter/leave indicator; `/zone show` outlines nearby zones; your base is auto-folded in as zone "base".
- **`zombie_reserve_debug.js`** — hold a clock to read the current phase/reserve (debug).
- Zombie Awareness tracks the same vanilla/Hordes undead set used by the KubeJS phase systems.

## Restore / setup

Copy `kubejs/` and `config/` into the profile root, then in-game (cheats on):
`/reload` and `/kubejs errors server` to confirm a clean load.
