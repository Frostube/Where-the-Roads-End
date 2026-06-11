# Changelog — Where the Roads End

## 2026-06-02 — Green-zone polish
- **`/zone show`** — particle-outlines nearby zone edges for ~8s (nearby segments only, capped). Uses `level.spawnParticles` wrapped in try/catch — verify particles appear on first run.
- **In-zone indicator** — action-bar `[SAFE] entered zone: X` / `[!] left zone: X` on enter/leave.
- **Base folded into the zone system** — the old hardcoded migration base safe-box (71..123, 122..303) is one-time auto-seeded as zone `base`, so it now gets full spawn-suppression, not just migration-exclusion. Migration's `SAFE_*` left as a harmless redundant fallback.

## 2026-06-02 — Green zones (Phase 6 start)
- **`zombie_green_zones.js`** (new) — player-declared reclaimed safe areas. Commands (cheats): `/zone pos1`, `/zone pos2`, `/zone create <name>`, `/zone list`, `/zone remove <name>`. Once declared, nothing **spawns** inside the box. Design decisions baked in:
  - **Spawn-time removal only** (`entity.age 0`) — zombies that **walk/chase in are NOT despawned** (your walls still matter; no force-field cheese).
  - **Corpse-zombies** (`hordes:*_player`, which carry the dead player's items) are **never** removed.
  - **Auto-padding** (`ZI_ZONE_PAD = 1`) expands each zone outward to seal perimeter walls; zones are **full-height**.
  - Must **clear the area** (no undead inside) before it can be declared green.
  - Exposes `global.ZI_GREEN.inAnyZone`; migration skips green-zone spots and doesn't count zone-removed spawns toward the reserve.

## 2026-06-02 — Phase 2 systems

### New mechanics
- **`00_reclamation_phases.js`** — day-based apocalypse curve (0-30 fresh outbreak → 30-100 degradation → 100-250 reclamation window → 250+ residual dead); exposes `global.ZI_RECLAMATION.getPhase(level)` for other scripts to scale off.
- **`01_zombie_spawn_director.js`** — active-zombie budget guard (caps simultaneous physical undead so the area doesn't choke).
- **`zombie_noise_lure.js`** — movement/jumping/mining/placing pulls nearby undead toward the survivor; phase-scaled radius.
- **`zombie_stealth.js`** (new) — inverse of the lure: crouching clears nearby undead targets every 2 ticks (beyond ~2.5-block point-blank) so a quiet survivor can sneak past / break away within ~16 blocks. Also muted movement-noise in the lure while crouched (mining still lures).
- Phase-scaling added to `zombie_buff.js` and `zombie_migration.js`; tuning to `zombie_softblock_break.js`, configs, and `options.txt`.

## 2026-06-01 Phase 2
- Added `01_zombie_spawn_director.js`, an MVP active-zombie budget guard. Spawner/check-spawn attempts are canceled when local or player-area zombie caps are full, preserving pressure without simulating hundreds of active zombies.
- Director now actively virtualizes over-cap ordinary undead back into the loose reserve, which handles maps/chunks that load hundreds of pre-existing zombies before spawn cancellation can help.
- Migration now respects the director budget before releasing migrants, and clock debug reports local/area director usage.
- Added a KubeJS noise-lure layer so player movement, jumping, block mining/breaking, and block placing actively pull nearby undead toward the survivor.
- Noise lure now ignores spectator/creative players and caps how many undead each noise pulse can directly pull.
- Expanded zombie block chewing to more intuitive soft/wooden house materials: chests, barrels, crafting/work tables, signs, ladders, scaffolding, bookshelves, beds, wool/carpet/banner interiors, related wooden details, and matching modded blocks by name pattern.
- Capped per-block crowd pressure so a swarm breaches faster than one zombie, but hundreds of zombies do not instantly erase a door.
- Natural ground digging now includes grass blocks and similar surface blocks, but only digs downward when the survivor/noise is below the undead to avoid random surface cratering.
- Strengthened Zombie Awareness sound/pathing settings so undead investigate nearby noise more reliably.
- Added `00_reclamation_phases.js` as the single KubeJS source of truth for the day-based zombie curve:
  - Days 0-30: P1 Fresh Outbreak, brutal surface pressure.
  - Days 30-100: P2 Degradation, short expeditions become possible.
  - Days 100-250: P3 Reclamation Window, clearing buildings/streets/blocks becomes viable.
  - Day 250+: P4 Residual Dead, rebuilding with rare deadly returns.
- Wired the curve into zombie buffs, finite migration pacing/burst size, and block-chewing pressure.
- Expanded phase handling and Zombie Awareness targeting to the vanilla + Hordes undead variants.
- Clock debug now reports current reclamation phase as well as loose zombie reserve.

## 2026-06-01
- **Declutter — disabled 7 unused mods → 206 active jars** (all intentional; world snapshotted before the content/worldgen ones, loaded through the missing-content screen, base verified intact):
  - `tacz` (Timeless & Classics Guns: Zero) — unused, poor shader rendering, no dependents. (`tacz/` + `tacz_backup/` data folders left on disk; can delete to reclaim space.)
  - `RegionsUnexploredForge` — ⚠️ **worldgen**: already-generated RU biome areas may have missing blocks; new chunks generate without it. `World snapshot 2026-06-01 (pre-TaCZ removal)` retains RU terrain if ever wanted back.
  - `doom-neo` (content), `improved-village-placement` + `villagespawnpoint` (village/spawn worldgen tweaks).
  - `0World2Create` + `global-server-config` — pointless behavior-only utilities, no world data (zero-risk cut).
- **Phase 1 (stabilize the pack) complete** → tagged **`v0.1-stable`** as the known-good baseline: 206 mods, custom zombie systems working, fully backed up + version-controlled. Next: Phase 2 (day-based zombie phase curve).
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
