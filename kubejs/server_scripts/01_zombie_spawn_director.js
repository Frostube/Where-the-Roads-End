// ---------------------------------------------------------------------------
// Zombie spawn director MVP.
//
// Goal: preserve "hundreds nearby" pressure without allowing hundreds of
// pathfinding zombies active in the same loaded area. Vanilla/mod spawners still
// provide the reserve fantasy, but this script says "not right now" when the
// active budget is full.
// ---------------------------------------------------------------------------

const ZI_DIRECTOR_UNDEAD = new Set([
  'minecraft:zombie',
  'minecraft:husk',
  'minecraft:drowned',
  'minecraft:zombie_villager',
  'minecraft:zombified_piglin',
  'hordes:zombie_player',
  'hordes:husk_player',
  'hordes:drowned_player'
]);

const ZI_DIRECTOR_LOCAL_RADIUS = 64;
const ZI_DIRECTOR_PLAYER_RADIUS = 128;
const ZI_DIRECTOR_VERTICAL_RADIUS = 48;
const ZI_DIRECTOR_ENFORCE_INTERVAL = 20;
const ZI_DIRECTOR_MAX_VIRTUALIZE_PER_PASS = 80;
const ZI_DIRECTOR_RESERVE_KEY = 'zi_zombie_reserve';

function ziDirectorCaps(level) {
  var id = 'degradation';
  try {
    if (global.ZI_RECLAMATION && typeof global.ZI_RECLAMATION.getPhase === 'function') {
      var phase = global.ZI_RECLAMATION.getPhase(level);
      if (phase && phase.id) id = phase.id;
    }
  } catch (e) {}

  if (id === 'fresh_outbreak') return { local: 36, player: 80 };
  if (id === 'degradation') return { local: 28, player: 60 };
  if (id === 'reclamation_window') return { local: 16, player: 36 };
  if (id === 'residual_dead') return { local: 8, player: 20 };
  return { local: 28, player: 60 };
}

function ziDirectorIsUndead(entityOrType) {
  if (!entityOrType) return false;
  return ZI_DIRECTOR_UNDEAD.has('' + entityOrType);
}

function ziDirectorCanVirtualize(entity) {
  if (!entity) return false;
  var type = '' + entity.type;
  if (!ziDirectorIsUndead(type)) return false;

  // Hordes player zombies can store player death items. Never virtualize those.
  if (type === 'hordes:zombie_player' || type === 'hordes:husk_player' || type === 'hordes:drowned_player') return false;

  return true;
}

function ziDirectorReserveTag(level) {
  try {
    if (level && level.server) return level.server.persistentData;
  } catch (e) {}
  return null;
}

function ziDirectorCount(level, x, y, z, radius) {
  if (!level) return 0;

  var nearby = level.getEntitiesWithin(AABB.of(
    x - radius, y - ZI_DIRECTOR_VERTICAL_RADIUS, z - radius,
    x + radius, y + ZI_DIRECTOR_VERTICAL_RADIUS, z + radius));
  if (!nearby) return 0;

  var count = 0;
  nearby.forEach(entity => {
    if (ziDirectorIsUndead(entity.type)) count++;
  });
  return count;
}

function ziDirectorCollect(level, x, y, z, radius) {
  var list = [];
  if (!level) return list;

  var nearby = level.getEntitiesWithin(AABB.of(
    x - radius, y - ZI_DIRECTOR_VERTICAL_RADIUS, z - radius,
    x + radius, y + ZI_DIRECTOR_VERTICAL_RADIUS, z + radius));
  if (!nearby) return list;

  nearby.forEach(entity => {
    if (!ziDirectorIsUndead(entity.type)) return;
    var dx = entity.x - x;
    var dy = entity.y - y;
    var dz = entity.z - z;
    list.push({ entity: entity, distSq: dx * dx + dy * dy + dz * dz });
  });

  list.sort((a, b) => b.distSq - a.distSq); // remove farthest first; keep teeth near player
  return list;
}

function ziDirectorNearestPlayerCount(level, x, y, z) {
  if (!level) return 0;

  var nearby = level.getEntitiesWithin(AABB.of(
    x - ZI_DIRECTOR_PLAYER_RADIUS, y - ZI_DIRECTOR_VERTICAL_RADIUS, z - ZI_DIRECTOR_PLAYER_RADIUS,
    x + ZI_DIRECTOR_PLAYER_RADIUS, y + ZI_DIRECTOR_VERTICAL_RADIUS, z + ZI_DIRECTOR_PLAYER_RADIUS));
  if (!nearby) return 0;

  var best = 0;
  nearby.forEach(entity => {
    if (('' + entity.type) !== 'minecraft:player') return;
    var c = ziDirectorCount(level, entity.x, entity.y, entity.z, ZI_DIRECTOR_PLAYER_RADIUS);
    if (c > best) best = c;
  });
  return best;
}

function ziDirectorCanSpawnAt(level, x, y, z) {
  var caps = ziDirectorCaps(level);
  if (ziDirectorCount(level, x, y, z, ZI_DIRECTOR_LOCAL_RADIUS) >= caps.local) return false;
  if (ziDirectorNearestPlayerCount(level, x, y, z) >= caps.player) return false;
  return true;
}

function ziDirectorBudgetSummary(level, player) {
  if (!level || !player) return 'budget unavailable';
  var caps = ziDirectorCaps(level);
  var local = ziDirectorCount(level, player.x, player.y, player.z, ZI_DIRECTOR_LOCAL_RADIUS);
  var area = ziDirectorCount(level, player.x, player.y, player.z, ZI_DIRECTOR_PLAYER_RADIUS);
  return 'local ' + local + '/' + caps.local + ', area ' + area + '/' + caps.player;
}

function ziDirectorRemoveEntity(entity) {
  try { entity.discard(); return true; } catch (e) {}
  try { entity.remove('discarded'); return true; } catch (e) {}
  try { entity.kill(); return true; } catch (e) {}
  try { entity.runCommandSilent('kill @s'); return true; } catch (e) {}
  return false;
}

function ziDirectorVirtualize(level, entries, overflow, budget) {
  if (overflow <= 0 || budget <= 0) return 0;

  var pd = ziDirectorReserveTag(level);
  var removed = 0;

  for (var i = 0; i < entries.length && removed < overflow && removed < budget; i++) {
    var entity = entries[i].entity;
    if (!ziDirectorCanVirtualize(entity)) continue;
    if (!ziDirectorRemoveEntity(entity)) continue;

    removed++;
    if (pd) pd.putInt(ZI_DIRECTOR_RESERVE_KEY, pd.getInt(ZI_DIRECTOR_RESERVE_KEY) + 1);
  }

  return removed;
}

function ziDirectorEnforceForPlayer(player) {
  var level = player.level;
  if (!level || level.isClientSide()) return 0;

  var caps = ziDirectorCaps(level);
  var budget = ZI_DIRECTOR_MAX_VIRTUALIZE_PER_PASS;
  var removed = 0;

  var areaEntries = ziDirectorCollect(level, player.x, player.y, player.z, ZI_DIRECTOR_PLAYER_RADIUS);
  var areaOverflow = areaEntries.length - caps.player;
  if (areaOverflow > 0) {
    var areaRemoved = ziDirectorVirtualize(level, areaEntries, areaOverflow, budget);
    removed += areaRemoved;
    budget -= areaRemoved;
  }

  if (budget <= 0) return removed;

  var localEntries = ziDirectorCollect(level, player.x, player.y, player.z, ZI_DIRECTOR_LOCAL_RADIUS);
  var localOverflow = localEntries.length - caps.local;
  if (localOverflow > 0) {
    removed += ziDirectorVirtualize(level, localEntries, localOverflow, budget);
  }

  return removed;
}

global.ZI_ZOMBIE_DIRECTOR = {
  undead: ZI_DIRECTOR_UNDEAD,
  caps: ziDirectorCaps,
  count: ziDirectorCount,
  canSpawnAt: ziDirectorCanSpawnAt,
  summary: ziDirectorBudgetSummary,
  enforce: ziDirectorEnforceForPlayer
};

EntityEvents.checkSpawn(event => {
  var entity = event.entity;
  if (!entity || !entity.level || entity.level.isClientSide()) return;
  if (!ziDirectorIsUndead(entity.type)) return;

  var x = event.x;
  var y = event.y;
  var z = event.z;
  if (x === undefined || y === undefined || z === undefined) {
    x = entity.x;
    y = entity.y;
    z = entity.z;
  }

  if (!ziDirectorCanSpawnAt(entity.level, x, y, z)) {
    event.cancel();
  }
});

PlayerEvents.tick(event => {
  var player = event.player;
  if (!player || player.age % ZI_DIRECTOR_ENFORCE_INTERVAL !== 0) return;
  ziDirectorEnforceForPlayer(player);
});
