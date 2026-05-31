// ---------------------------------------------------------------------------
// Finite "zombie migration" (Project Zomboid style).
//
// The world keeps a persistent reserve of "loose" zombies in
// server.persistentData (survives restarts):
//   * spawner-spawned undead ADD to the reserve  (finite: spawners decay)
//   * any undead DEATH subtracts from the reserve (drained by kills)
//   * when a player's surroundings go quiet, a lone migrant occasionally walks
//     in from the perimeter -- pure relocation, no count change. TRICKLE pacing.
//
// Net effect: zombies you promptly kill never migrate (spawn +1, death -1).
// Zombies you let wander off become the loose population that drifts toward you
// over time. Destroy every spawner + hunt the stragglers -> reserve hits 0 ->
// the world is clear for good.
//
// No entity/server tick event exists in this KubeJS, so the timer is driven
// from PlayerEvents.tick (per player), which is exactly what we want anyway.
// ---------------------------------------------------------------------------

const RESERVE_KEY = 'zi_zombie_reserve';
const MIGRANT_TAG = 'zi_migrant';

const LOOSE_UNDEAD = new Set([
  'minecraft:zombie',
  'minecraft:husk',
  'minecraft:drowned',
  'minecraft:zombie_villager',
  'minecraft:zombified_piglin'
]);

// --- TRICKLE pacing knobs (tweak to taste) ---
const INTERVAL = 14400;       // base ticks between migration attempts (~12 min)
const INTERVAL_JITTER = 3600; // up to +3 min of randomness on top
const QUIET_RADIUS = 48;      // only migrate if the area within this is calm
const QUIET_MAX = 4;          // "calm" = fewer than this many undead nearby
const MIN_DIST = 96;          // how far out a migrant appears (blocks)
const MAX_DIST = 120;         // capped near render distance (8 chunks = 128 blocks):
                              // beyond loaded chunks a migrant can't tick or path to you
const SPAWN_TRIES = 50;       // attempts to find a valid open spot per migration
// Safe zone (box): migrants NEVER spawn inside this X/Z rectangle, at any height
// -- your base perimeter. Set SAFE_ENABLED = false to turn it off.
const SAFE_ENABLED = true;
const SAFE_MIN_X = 71;
const SAFE_MAX_X = 123;
const SAFE_MIN_Z = 122;
const SAFE_MAX_Z = 303;
const NOTIFY = true;          // subtle atmospheric message when a migrant arrives
const DEBUG = false;          // true -> log reserve changes to server console

// per-player cooldown countdown (resets on reload; only delays the first wave)
const cooldown = {};

function isAir(block) { return block && block.id === 'minecraft:air'; }

function reserveTag(level) {
  const server = level.server;
  if (!server) return null;
  return server.persistentData;
}

// --- FEED: every newly-spawned non-migrant undead is one more "loose" zombie ---
EntityEvents.spawned(event => {
  const entity = event.entity;
  if (!entity || !entity.level || entity.level.isClientSide()) return;
  if (entity.age > 0) return; // only count fresh spawns, not chunk-load re-adds
  if (!LOOSE_UNDEAD.has('' + entity.type)) return;
  try { if (entity.tags && entity.tags.contains(MIGRANT_TAG)) return; } catch (e) {}
  const pd = reserveTag(entity.level);
  if (!pd) return;
  pd.putInt(RESERVE_KEY, pd.getInt(RESERVE_KEY) + 1);
});

// --- DRAIN: every undead death removes one from the loose population ---
EntityEvents.death(event => {
  const entity = event.entity;
  if (!entity || !entity.level || entity.level.isClientSide()) return;
  if (!LOOSE_UNDEAD.has('' + entity.type)) return;
  const pd = reserveTag(entity.level);
  if (!pd) return;
  const r = pd.getInt(RESERVE_KEY);
  if (r > 0) pd.putInt(RESERVE_KEY, r - 1);
});

// bumped by the /zspawn command; drained in the tick below (single global counter)
var ZI_FORCE_SPAWN = 0;

// Find a valid spot in the ring (outside the safe zone) and spawn one migrant
// that heads for the player. Returns true on success.
function trySpawnMigrant(player, level) {
  const px = Math.floor(player.x), py = Math.floor(player.y), pz = Math.floor(player.z);
  if (isNaN(px) || isNaN(py) || isNaN(pz)) return false;
  var minSq = MIN_DIST * MIN_DIST;
  var maxSq = MAX_DIST * MAX_DIST;

  for (var i = 0; i < SPAWN_TRIES; i++) {
    // random offset within the ring [MIN_DIST, MAX_DIST] (no trig: Math.cos/sin/PI = NaN here)
    var ox = Math.floor((Math.random() * 2 - 1) * MAX_DIST);
    var oz = Math.floor((Math.random() * 2 - 1) * MAX_DIST);
    var dsq = ox * ox + oz * oz;
    if (dsq < minSq || dsq > maxSq) continue;
    var sx = px + ox;
    var sz = pz + oz;
    if (SAFE_ENABLED && sx >= SAFE_MIN_X && sx <= SAFE_MAX_X && sz >= SAFE_MIN_Z && sz <= SAFE_MAX_Z) continue; // safe zone

    for (var dy = 8; dy >= -8; dy--) {
      var y = py + dy;
      var ground = level.getBlock(sx, y - 1, sz);
      var feet = level.getBlock(sx, y, sz);
      var head = level.getBlock(sx, y + 1, sz);
      if (!ground || isAir(ground)) continue;
      if (!isAir(feet) || !isAir(head)) continue;

      var migrant = level.createEntity('minecraft:zombie');
      migrant.setPosition(sx + 0.5, y, sz + 0.5);
      migrant.mergeNbt({ Tags: [MIGRANT_TAG], PersistenceRequired: 1 });
      migrant.spawn();
      try { migrant.setTarget(player); } catch (e) {}
      return true;
    }
  }
  return false;
}

// --- MIGRATE: forced waves (/zspawn) + the natural trickle ---
PlayerEvents.tick(event => {
  const player = event.player;
  const level = player.level;
  if (!level || level.isClientSide()) return;

  // forced wave from /zspawn -- bypasses cooldown + quiet check (still respects safe zone)
  if (ZI_FORCE_SPAWN > 0) {
    var burst = ZI_FORCE_SPAWN;
    ZI_FORCE_SPAWN = 0;
    var made = 0;
    for (var f = 0; f < burst; f++) { if (trySpawnMigrant(player, level)) made++; }
    if (made > 0) { try { player.tell(Text.red('A horde stirs nearby... (' + made + ' incoming)')); } catch (e) {} }
  }

  const key = '' + player.uuid;
  const cd = cooldown[key];
  if (cd === undefined || cd > 0) {
    cooldown[key] = (cd === undefined ? INTERVAL : cd) - 1;
    if (cd === undefined) cooldown[key] = INTERVAL + Math.floor(Math.random() * INTERVAL_JITTER);
    return;
  }
  // cooldown elapsed -> reset now regardless of outcome
  cooldown[key] = INTERVAL + Math.floor(Math.random() * INTERVAL_JITTER);

  const pd = reserveTag(level);
  if (!pd) return;
  const reserve = pd.getInt(RESERVE_KEY);
  if (reserve <= 0) return;

  // only migrate into a calm area (don't pile on during a fight)
  const near = level.getEntitiesWithin(AABB.of(
    player.x - QUIET_RADIUS, player.y - QUIET_RADIUS, player.z - QUIET_RADIUS,
    player.x + QUIET_RADIUS, player.y + QUIET_RADIUS, player.z + QUIET_RADIUS));
  let count = 0;
  near.forEach(e => { if (LOOSE_UNDEAD.has('' + e.type)) count++; });
  if (count >= QUIET_MAX) return;

  if (trySpawnMigrant(player, level) && NOTIFY) {
    try { player.tell(Text.gray('A distant moan drifts in from the city...')); } catch (e) {}
  }
});

// --- /zspawn [count] : force a migration wave right now (needs cheats) ---
ServerEvents.commandRegistry(event => {
  const { commands: Commands, arguments: Arguments } = event;
  event.register(
    Commands.literal('zspawn')
      .executes(ctx => { ZI_FORCE_SPAWN += 5; return 1; })
      .then(Commands.argument('count', Arguments.INTEGER.create(event))
        .executes(ctx => {
          var n = Arguments.INTEGER.getResult(ctx, 'count');
          if (n < 1) n = 1;
          if (n > 200) n = 200;
          ZI_FORCE_SPAWN += n;
          return 1;
        }))
  );
});
