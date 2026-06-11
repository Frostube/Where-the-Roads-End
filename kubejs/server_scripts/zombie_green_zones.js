// ---------------------------------------------------------------------------
// Green zones (reclamation).
//
// Player-declared safe areas. Once you've CLEARED an area you mark it with
// /zone, and from then on nothing SPAWNS inside it -- migration, spawners,
// natural spawns, reinforcements: anything that tries to spawn in the box is
// removed at the moment of spawn. Cleared land stays cleared.
//
// Design choices:
//   * Removal fires ONLY at spawn time (entity.age 0). A zombie that WALKS in is
//     NOT despawned -- walls still matter, no force-field cheese.
//   * Corpse-zombies (hordes:*_player, carry your items) are NEVER removed.
//   * Zones auto-PAD outward (ZI_ZONE_PAD) so perimeter walls are sealed inside.
//   * Full-height; you must CLEAR the area (no undead inside) before declaring.
//
// Commands (need cheats): /zone pos1 | pos2 | create <name> | list | remove <name> | show
//   - show: briefly outlines nearby zones with particles
// Indicator: action-bar message when you enter/leave a zone.
// Base fold-in: the old hardcoded migration safe-box is seeded here as zone "base".
// Exposes global.ZI_GREEN.inAnyZone(level, x, z). Single-player MVP (one global slot).
// ---------------------------------------------------------------------------

const ZI_ZONES_KEY = 'zi_green_zones';
const ZI_ZONE_PAD = 1; // expand each zone outward by this many blocks to seal walls

const ZI_ZONE_UNDEAD = new Set([
  'minecraft:zombie',
  'minecraft:husk',
  'minecraft:drowned',
  'minecraft:zombie_villager',
  'minecraft:zombified_piglin'
]);
// Corpse-zombies that carry the dead player's items -- NEVER auto-remove these.
const ZI_ZONE_PROTECT = new Set([
  'hordes:zombie_player',
  'hordes:husk_player',
  'hordes:drowned_player'
]);

var ZI_ZONE_CACHE = null;   // parsed zones array (null = (re)load from persistentData)
var ZI_ZONE_REQ = null;     // single pending /zone request (solo MVP)
var ZI_ZONE_PENDING = {};   // c1/c2 marked corners (solo MVP)
var ZI_ZONE_SHOW_UNTIL = 0; // /zone show: draw outlines until this player.age
var ZI_ZONE_CURRENT = {};   // uuid -> name of the zone the player is currently inside
var ZI_BASE_SEEDED = false; // one-time fold of the old hardcoded base box into zones
// the old migration safe-box (71..123, 122..303), padded, folded in as zone "base"
const ZI_BASE_ZONE = { name: 'base', minX: 71 - ZI_ZONE_PAD, maxX: 123 + ZI_ZONE_PAD, minZ: 122 - ZI_ZONE_PAD, maxZ: 303 + ZI_ZONE_PAD };

function ziZonesGet(level) {
  if (ZI_ZONE_CACHE !== null) return ZI_ZONE_CACHE;
  try {
    var s = level.server.persistentData.getString(ZI_ZONES_KEY);
    ZI_ZONE_CACHE = s ? JSON.parse(s) : [];
  } catch (e) { ZI_ZONE_CACHE = []; }
  return ZI_ZONE_CACHE;
}

function ziZonesSave(level, arr) {
  ZI_ZONE_CACHE = arr;
  try { level.server.persistentData.putString(ZI_ZONES_KEY, JSON.stringify(arr)); } catch (e) {}
}

function ziZoneAt(level, x, z) {
  var zones = ziZonesGet(level);
  for (var i = 0; i < zones.length; i++) {
    var b = zones[i];
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return b.name;
  }
  return null;
}

function ziInAnyZone(level, x, z) {
  return ziZoneAt(level, x, z) !== null;
}

// expose for migration / other scripts (matches the global.ZI_* convention)
global.ZI_GREEN = { inAnyZone: ziInAnyZone };

// /zone show: sparkle the edges of zones near the player (nearby segments only, capped)
function ziDrawZones(level, player) {
  var zones = ziZonesGet(level);
  var py = Math.floor(player.y);
  var WIN = 48, STEP = 2, CAP = 240, drawn = 0;
  for (var i = 0; i < zones.length && drawn < CAP; i++) {
    var b = zones[i];
    var pts = [];
    for (var x = b.minX; x <= b.maxX; x += STEP) { pts.push([x, b.minZ]); pts.push([x, b.maxZ]); }
    for (var z = b.minZ; z <= b.maxZ; z += STEP) { pts.push([b.minX, z]); pts.push([b.maxX, z]); }
    for (var p = 0; p < pts.length && drawn < CAP; p++) {
      var ex = pts[p][0], ez = pts[p][1];
      var ddx = ex - player.x, ddz = ez - player.z;
      if (ddx * ddx + ddz * ddz > WIN * WIN) continue; // only the edge near you
      try { level.spawnParticles('minecraft:happy_villager', true, ex + 0.5, py + 1, ez + 0.5, 0, 0.05, 0, 1, 0); } catch (e) {}
      drawn++;
    }
  }
}

// --- ENFORCEMENT: remove WILD undead that SPAWN inside a zone (not corpses, not walk-ins) ---
EntityEvents.spawned(event => {
  var entity = event.entity;
  if (!entity || !entity.level || entity.level.isClientSide()) return;
  if (entity.age > 0) return; // ONLY fresh spawns -- never chunk re-adds or walk-ins
  var type = '' + entity.type;
  if (ZI_ZONE_PROTECT.has(type)) return;     // never eat your corpse-zombie (your items!)
  if (!ZI_ZONE_UNDEAD.has(type)) return;
  if (!ziInAnyZone(entity.level, Math.floor(entity.x), Math.floor(entity.z))) return;
  try { entity.discard(); } catch (e) {}      // silent removal (no death -> no reserve change)
});

// --- passive: one-time base seed, in-zone indicator, /zone show drawing ---
PlayerEvents.tick(event => {
  var player = event.player;
  var level = player.level;
  if (!level || level.isClientSide()) return;

  // one-time: fold the old hardcoded base safe-box into the green-zone list
  if (!ZI_BASE_SEEDED) {
    ZI_BASE_SEEDED = true;
    try {
      var zs = ziZonesGet(level);
      var hasBase = false;
      for (var i = 0; i < zs.length; i++) { if (zs[i].name === 'base') hasBase = true; }
      if (!hasBase) { zs.push(ZI_BASE_ZONE); ziZonesSave(level, zs); }
    } catch (e) {}
  }

  if (player.age % 10 !== 0) return; // throttle the rest

  // in-zone indicator (enter/leave via action bar)
  var here = ziZoneAt(level, Math.floor(player.x), Math.floor(player.z));
  var key = '' + player.uuid;
  if (here !== ZI_ZONE_CURRENT[key]) {
    var prev = ZI_ZONE_CURRENT[key];
    ZI_ZONE_CURRENT[key] = here;
    try {
      if (here) player.displayClientMessage(Text.green('[SAFE] entered zone: ' + here), true);
      else if (prev) player.displayClientMessage(Text.gold('[!] left zone: ' + prev), true);
    } catch (e) {}
  }

  // /zone show
  if (player.age < ZI_ZONE_SHOW_UNTIL) ziDrawZones(level, player);
});

// --- /zone request processor (reliable player + level + persistentData) ---
PlayerEvents.tick(event => {
  if (!ZI_ZONE_REQ) return;
  var player = event.player;
  var level = player.level;
  if (!level || level.isClientSide()) return;

  var req = ZI_ZONE_REQ;
  ZI_ZONE_REQ = null;

  var px = Math.floor(player.x), pz = Math.floor(player.z);

  if (req.action === 'pos1' || req.action === 'pos2') {
    var slot = (req.action === 'pos1') ? 'c1' : 'c2';
    ZI_ZONE_PENDING[slot] = { x: px, z: pz };
    try { player.tell(Text.green('[zone] corner ' + slot.charAt(1) + ' set at ' + px + ', ' + pz)); } catch (e) {}
    return;
  }

  if (req.action === 'show') {
    ZI_ZONE_SHOW_UNTIL = player.age + 160; // ~8s
    try { player.tell(Text.yellow('[zone] outlining nearby zones for 8s')); } catch (e) {}
    return;
  }

  if (req.action === 'create') {
    var c1 = ZI_ZONE_PENDING.c1, c2 = ZI_ZONE_PENDING.c2;
    if (!c1 || !c2) {
      try { player.tell(Text.red('[zone] set both corners first: stand on each and run /zone pos1 then /zone pos2')); } catch (e) {}
      return;
    }
    var minX = Math.min(c1.x, c2.x) - ZI_ZONE_PAD;
    var maxX = Math.max(c1.x, c2.x) + ZI_ZONE_PAD;
    var minZ = Math.min(c1.z, c2.z) - ZI_ZONE_PAD;
    var maxZ = Math.max(c1.z, c2.z) + ZI_ZONE_PAD;

    var n = 0;
    try {
      var inside = level.getEntitiesWithin(AABB.of(minX, player.y - 64, minZ, maxX, player.y + 64, maxZ));
      if (inside) inside.forEach(e => { if (ZI_ZONE_UNDEAD.has('' + e.type)) n++; });
    } catch (e) {}
    if (n > 0) {
      try { player.tell(Text.red('[zone] clear it first -- ' + n + ' undead still inside the area')); } catch (e) {}
      return;
    }

    var zones = ziZonesGet(level);
    var kept = [];
    for (var i = 0; i < zones.length; i++) { if (zones[i].name !== req.name) kept.push(zones[i]); }
    kept.push({ name: req.name, minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ });
    ziZonesSave(level, kept);
    ZI_ZONE_PENDING = {};
    try { player.tell(Text.green('[zone] green zone "' + req.name + '" created: (' + minX + ',' + minZ + ') to (' + maxX + ',' + maxZ + ')  [padded ' + ZI_ZONE_PAD + ']')); } catch (e) {}
    return;
  }

  if (req.action === 'list') {
    var zlist = ziZonesGet(level);
    if (zlist.length === 0) { try { player.tell(Text.yellow('[zone] no green zones yet')); } catch (e) {} return; }
    try { player.tell(Text.yellow('[zone] ' + zlist.length + ' green zone(s):')); } catch (e) {}
    for (var i = 0; i < zlist.length; i++) {
      var b = zlist[i];
      try { player.tell(Text.gray('  - ' + b.name + ': (' + b.minX + ',' + b.minZ + ') to (' + b.maxX + ',' + b.maxZ + ')')); } catch (e) {}
    }
    return;
  }

  if (req.action === 'remove') {
    var zo = ziZonesGet(level);
    var keep = [];
    var removed = 0;
    for (var i = 0; i < zo.length; i++) { if (zo[i].name === req.name) removed++; else keep.push(zo[i]); }
    ziZonesSave(level, keep);
    try { player.tell(removed > 0 ? Text.green('[zone] removed "' + req.name + '"') : Text.red('[zone] no zone named "' + req.name + '"')); } catch (e) {}
    return;
  }
});

// --- commands (need cheats) ---
ServerEvents.commandRegistry(event => {
  const { commands: Commands, arguments: Arguments } = event;
  event.register(
    Commands.literal('zone')
      .then(Commands.literal('pos1').executes(ctx => { ZI_ZONE_REQ = { action: 'pos1' }; return 1; }))
      .then(Commands.literal('pos2').executes(ctx => { ZI_ZONE_REQ = { action: 'pos2' }; return 1; }))
      .then(Commands.literal('list').executes(ctx => { ZI_ZONE_REQ = { action: 'list' }; return 1; }))
      .then(Commands.literal('show').executes(ctx => { ZI_ZONE_REQ = { action: 'show' }; return 1; }))
      .then(Commands.literal('create')
        .then(Commands.argument('name', Arguments.STRING.create(event))
          .executes(ctx => { ZI_ZONE_REQ = { action: 'create', name: '' + Arguments.STRING.getResult(ctx, 'name') }; return 1; })))
      .then(Commands.literal('remove')
        .then(Commands.argument('name', Arguments.STRING.create(event))
          .executes(ctx => { ZI_ZONE_REQ = { action: 'remove', name: '' + Arguments.STRING.getResult(ctx, 'name') }; return 1; })))
  );
});
