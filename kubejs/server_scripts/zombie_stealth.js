// ---------------------------------------------------------------------------
// Stealth (the inverse of zombie_noise_lure.js).
//
// While a survivor SNEAKS (crouches), nearby undead lose your trail: their
// targets are cleared every couple ticks, so a quiet crouched player can slip
// past or break away even ~10 blocks out. Point-blank undead (within
// ZI_STEALTH_POINT_BLANK) still notice you -- crouching doesn't hide you from
// something right in your face.
//
// Runs more often than the noise lure (every 2 ticks vs 10) and faster than
// Zombie Awareness's AI loop (5 ticks), so sneaking reliably wins the tug-of-war.
//
// NOTE: this clears ALL nearby undead targets while you sneak, so it will also
// briefly calm undead chasing villagers/guards near you. Ask if you want it
// restricted to only undead targeting the player.
// ---------------------------------------------------------------------------

const ZI_STEALTH_UNDEAD = new Set([
  'minecraft:zombie',
  'minecraft:husk',
  'minecraft:drowned',
  'minecraft:zombie_villager',
  'minecraft:zombified_piglin',
  'hordes:zombie_player',
  'hordes:husk_player',
  'hordes:drowned_player'
]);

const ZI_STEALTH_RADIUS = 16;       // undead within this lose your trail while you sneak
const ZI_STEALTH_POINT_BLANK = 2.5; // ...unless they're this close (they still notice you)
const ZI_STEALTH_INTERVAL = 2;      // ticks between sweeps (must out-pace re-targeting)

function ziIsSneaking(player) {
  try { if (player.isCrouching && player.isCrouching()) return true; } catch (e) {}
  try { if (player.crouching === true) return true; } catch (e) {}
  try { if (player.isShiftKeyDown && player.isShiftKeyDown()) return true; } catch (e) {}
  try { if (player.shiftKeyDown === true) return true; } catch (e) {}
  return false;
}

function ziStealthIgnored(player) {
  if (!player) return true;
  try { if (player.isSpectator && player.isSpectator()) return true; } catch (e) {}
  try {
    var m = '' + player.gameMode;
    if (m.indexOf('spectator') >= 0 || m.indexOf('creative') >= 0) return true;
  } catch (e) {}
  return false;
}

PlayerEvents.tick(event => {
  var player = event.player;
  var level = player.level;
  if (!level || level.isClientSide()) return;
  if (player.age % ZI_STEALTH_INTERVAL !== 0) return;
  if (ziStealthIgnored(player)) return;
  if (!ziIsSneaking(player)) return;

  var r = ZI_STEALTH_RADIUS;
  var nearby = level.getEntitiesWithin(AABB.of(
    player.x - r, player.y - 8, player.z - r,
    player.x + r, player.y + 8, player.z + r));
  if (!nearby) return;

  var pbSq = ZI_STEALTH_POINT_BLANK * ZI_STEALTH_POINT_BLANK;
  nearby.forEach(entity => {
    if (!ZI_STEALTH_UNDEAD.has('' + entity.type)) return;
    var dx = entity.x - player.x;
    var dz = entity.z - player.z;
    if (dx * dx + dz * dz <= pbSq) return; // point-blank: they still see you
    try { entity.setTarget(null); } catch (e) {}
  });
});
