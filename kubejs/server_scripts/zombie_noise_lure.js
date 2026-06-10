// ---------------------------------------------------------------------------
// Noise lure.
//
// Zombie Awareness handles sound senses, but this pack needs a stronger rule:
// if a survivor is stomping around, jumping, or breaking/placing blocks inside
// a house, nearby undead should investigate and press against the structure.
// Once they reach doors/windows/walls, zombie_softblock_break.js handles entry.
// ---------------------------------------------------------------------------

const ZI_NOISE_UNDEAD = new Set([
  'minecraft:zombie',
  'minecraft:husk',
  'minecraft:drowned',
  'minecraft:zombie_villager',
  'minecraft:zombified_piglin',
  'hordes:zombie_player',
  'hordes:husk_player',
  'hordes:drowned_player'
]);

const ZI_NOISE_STATE = {};
const ZI_NOISE_BASE_RADIUS = 36;
const ZI_NOISE_LOUD_RADIUS = 64;
const ZI_NOISE_SCAN_INTERVAL = 10;
const ZI_NOISE_MIN_MOVE_SQ = 0.0016; // about 0.04 blocks/tick
const ZI_NOISE_CLEAR_RADIUS = 96;

function ziIgnoredPlayer(player) {
  if (!player) return true;
  try { if (player.isSpectator && player.isSpectator()) return true; } catch (e) {}
  try { if (player.isCreative && player.isCreative()) return true; } catch (e) {}
  try { if (player.spectator === true || player.creative === true) return true; } catch (e) {}
  try {
    var mode = '' + player.gameMode;
    if (mode.indexOf('spectator') >= 0 || mode.indexOf('creative') >= 0) return true;
  } catch (e) {}
  return false;
}

function ziNoisePhaseMultiplier(level) {
  try {
    if (global.ZI_RECLAMATION && typeof global.ZI_RECLAMATION.getPhase === 'function') {
      var phase = global.ZI_RECLAMATION.getPhase(level);
      if (!phase) return 1.0;
      if (phase.id === 'fresh_outbreak') return 1.25;
      if (phase.id === 'degradation') return 1.0;
      if (phase.id === 'reclamation_window') return 0.75;
      if (phase.id === 'residual_dead') return 0.5;
    }
  } catch (e) {}
  return 1.0;
}

function ziClearUndeadTarget(level, player) {
  if (!level || !player) return;

  var nearby = level.getEntitiesWithin(AABB.of(
    player.x - ZI_NOISE_CLEAR_RADIUS, player.y - 32, player.z - ZI_NOISE_CLEAR_RADIUS,
    player.x + ZI_NOISE_CLEAR_RADIUS, player.y + 32, player.z + ZI_NOISE_CLEAR_RADIUS));
  if (!nearby) return;

  nearby.forEach(entity => {
    if (!ZI_NOISE_UNDEAD.has('' + entity.type)) return;
    try { entity.setTarget(null); } catch (e) {}
  });
}

function ziAttractUndead(level, player, radius, force, maxPulls) {
  if (!level || !player || radius <= 0) return 0;
  if (ziIgnoredPlayer(player)) return 0;

  var r = Math.floor(radius * ziNoisePhaseMultiplier(level));
  if (r < 12) r = 12;
  var cap = maxPulls || 16;

  var nearby = level.getEntitiesWithin(AABB.of(
    player.x - r, player.y - 24, player.z - r,
    player.x + r, player.y + 24, player.z + r));
  if (!nearby) return 0;

  var pulled = 0;
  nearby.forEach(entity => {
    if (pulled >= cap) return;
    if (!ZI_NOISE_UNDEAD.has('' + entity.type)) return;
    var dx = entity.x - player.x;
    var dz = entity.z - player.z;
    var distSq = dx * dx + dz * dz;

    // Distant shuffling is not a perfect beacon. Loud actions are.
    if (!force && distSq > 32 * 32 && Math.random() > 0.45) return;

    try { entity.setTarget(player); pulled++; } catch (e) {}
  });

  return pulled;
}

PlayerEvents.tick(event => {
  var player = event.player;
  var level = player.level;
  if (!level || level.isClientSide()) return;
  if (player.age % ZI_NOISE_SCAN_INTERVAL !== 0) return;
  if (ziIgnoredPlayer(player)) {
    ziClearUndeadTarget(level, player);
    return;
  }

  var key = '' + player.uuid;
  var prev = ZI_NOISE_STATE[key];
  ZI_NOISE_STATE[key] = { x: player.x, y: player.y, z: player.z };
  if (!prev) return;

  var dx = player.x - prev.x;
  var dy = player.y - prev.y;
  var dz = player.z - prev.z;
  var horizontalSq = dx * dx + dz * dz;
  var vertical = Math.abs(dy);

  var noisy = false;
  var loud = false;

  if (horizontalSq > ZI_NOISE_MIN_MOVE_SQ) noisy = true;
  if (vertical > 0.24) { noisy = true; loud = true; } // jumping/falling indoors should matter

  try {
    if (player.isSprinting && player.isSprinting()) loud = true;
  } catch (e) {}

  if (!noisy) return;

  // Crouching = silent footsteps: a sneaking survivor doesn't lure undead by moving.
  // (Mining/placing below still makes noise -- sneaking isn't a free pass while you work.)
  var ziSneaking = false;
  try {
    ziSneaking = (player.isCrouching && player.isCrouching()) ||
                 player.crouching === true ||
                 (player.isShiftKeyDown && player.isShiftKeyDown());
  } catch (e) {}
  if (ziSneaking) return;

  ziAttractUndead(level, player, loud ? 48 : ZI_NOISE_BASE_RADIUS, false, loud ? 18 : 10);
});

BlockEvents.broken(event => {
  var player = event.player;
  if (!player) return;
  var level = player.level;
  if (!level || level.isClientSide()) return;
  ziAttractUndead(level, player, ZI_NOISE_LOUD_RADIUS, true, 28);
});

BlockEvents.leftClicked(event => {
  var player = event.player;
  if (!player) return;
  var level = player.level;
  if (!level || level.isClientSide()) return;
  ziAttractUndead(level, player, 52, false, 16);
});

BlockEvents.placed(event => {
  var player = event.player;
  if (!player) return;
  var level = player.level;
  if (!level || level.isClientSide()) return;
  ziAttractUndead(level, player, 44, false, 14);
});
