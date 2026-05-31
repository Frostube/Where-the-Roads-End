# Changelog — Where the Roads End

## 2026-06-01
- **Removed TaCZ** (`tacz` — Timeless & Classics Guns: Zero): unused, rendered poorly under shaders, no mods depended on it. Snapshotted first → loaded through the missing-content screen → base verified intact (no holes). → **212 active jars**. (`tacz/` + `tacz_backup/` data folders left on disk, harmless; can delete to reclaim space.)
- Identified the "mystery" mods via jar metadata: `eh`=Horde Hoard (content), `wmp`=Warborn Military Pack (SuperbWarfare add-on), `deimos`/`TES`=libraries (KEEP), `0World2Create`/`global-server-config`=safe-to-cut utilities (still pending). The two `fabric-api` jars are NOT duplicates (Forgified Fabric API + real Fabric API — keep both).

## 2026-05-31

### Declutter (Phase 1)
- Disabled duplicate **`Presence Footsteps [FORGE] 1.0.0.jar`** (kept `PresenceFootsteps-1.20.1-1.9.1-beta.1.jar`).
  Verified: pack boots, world opens with no missing-content screen, footsteps still play. → 213 active jars.
- Deferred: second `fabric-api` jar (`0.92.2` vs `0.92.7`) — foundational, needs verification before removing.

### Infrastructure
- Set up Git repo + `.gitignore` (tracks `kubejs/`, `config/`, modlist; ignores mods/saves/logs/caches).
- Backups: two verified full copies of the day-341 world in `D:\backups\MC Backups\`.

### Custom zombie systems (KubeJS)
- `zombie_softblock_break.js` — instant soft-block breaking + delayed wood-barricade breaching.
- `zombie_buff.js` — WWZ buffs (tankier/faster/~3–4-hit), reinforcements disabled.
- `zombie_migration.js` — finite reserve fed by spawners / drained by kills; trickle migration; `/zspawn [n]`; base safe-zone box.
- `zombie_reserve_debug.js` — hold-a-clock reserve readout (debug).

### Config tuning
- Hordes mod: events OFF, infection ON.
- Zombie Awareness: omniscient off, reduced sight/scent/sound (no more "no-scope through walls").
- SpawnerControl: `ignoreRestrictions=true` (spawn regardless of light).
- Performance: `simulationDistance 18→10`, Distant Horizons `threadRunTimeRatio 0.5` (FPS 23 → ~40).

## Safe-edit workflow (the rule)
Snapshot world → make change (mods: rename `.disabled`, code: Git) → test on real instance → if a
"missing content" screen appears, BACK OUT (never proceed) → commit if clean. Never test cuts blindly.
