// ---------------------------------------------------------------------------
// Green zones (reclamation).
//
// Player-declared safe areas. Once you've CLEARED an area you mark it with
// /zone, and from then on nothing SPAWNS inside it -- migration, spawners,
// natural spawns, reinforcements: anything that tries to spawn in the box is
// removed at the moment of spawn. Cleared land stays cleared.
//
// IMPORTANT design choices baked in:
//   * Removal fires ONLY at spawn time (entity.age 0). A zombie that WALKS/chases
//     in is NOT despawned -- your walls still matter, no force-field cheese.
//   * Death/corpse zombies (hordes:*_player, which carry your items) are NEVER
//     removed, even inside a zone -- you don't lose your loot.
//   * Zones auto-PAD outward by ZI_ZONE_PAD blocks so your perimeter WALLS are
//     sealed inside the zone (a zombie can't spawn on the wall and drop in).
//   * Zones are full-height (any Y) and you must actually CLEAR the area (no
//     undead inside) before you can declare it.
//
// Commands (need cheats): /zone pos1 | pos2 | create <name> | list | remove <name>
// Exposes global.ZI_GREEN.inAnyZone(level, x, z) for migration etc.
// (Single-player MVP: one global pending-corner / request slot.)
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

function ziInAnyZone(level, x, z) {
  var zones = ziZonesGet(level);
  for (var i = 0; i < zones.length; i++) {
    var b = zones[i];
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return true;
  }
  return false;
}

// expose for migration / other scripts (matches the global.ZI_* convention)
global.ZI_GREEN = { inAnyZone: ziInAnyZone };

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

// --- /zone request processor (runs with reliable player + level + persistentData) ---
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

    // require the area to actually be CLEAR before it can be declared green
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
    var zs = ziZonesGet(level);
    if (zs.length === 0) { try { player.tell(Text.yellow('[zone] no green zones yet')); } catch (e) {} return; }
    try { player.tell(Text.yellow('[zone] ' + zs.length + ' green zone(s):')); } catch (e) {}
    for (var i = 0; i < zs.length; i++) {
      var b = zs[i];
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
      .then(Commands.literal('create')
        .then(Commands.argument('name', Arguments.STRING.create(event))
          .executes(ctx => { ZI_ZONE_REQ = { action: 'create', name: '' + Arguments.STRING.getResult(ctx, 'name') }; return 1; })))
      .then(Commands.literal('remove')
        .then(Commands.argument('name', Arguments.STRING.create(event))
          .executes(ctx => { ZI_ZONE_REQ = { action: 'remove', name: '' + Arguments.STRING.getResult(ctx, 'name') }; return 1; })))
  );
});
