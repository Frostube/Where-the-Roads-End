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

- **`zombie_softblock_break.js`** — undead chew soft blocks instantly, wood barricades after sustained pressure.
- **`zombie_buff.js`** — tankier, faster, ~3–4-hit zombies; no reinforcement spam.
- **`zombie_migration.js`** — finite "loose population" reserve, fed by spawners and drained by kills, that trickles toward you from the dead city; `/zspawn [n]` forces a wave; base safe-zone excluded.
- **`zombie_reserve_debug.js`** — hold a clock to read the current reserve (debug).

## Restore / setup

Copy `kubejs/` and `config/` into the profile root, then in-game (cheats on):
`/reload` and `/kubejs errors server` to confirm a clean load.
