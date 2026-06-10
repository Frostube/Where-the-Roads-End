// Reclamation phase undead: tanky and fast in the fresh outbreak, then slowly
// thinning into reclaimable/residual dead as the world day advances. Infection
// (The Hordes mod) remains the real kill threat.
//
// Tuning notes (edit the numbers below to taste):
//   kubejs/server_scripts/00_reclamation_phases.js is the source of truth.
const BUFFED = new Set([
  'minecraft:zombie',
  'minecraft:husk',
  'minecraft:drowned',
  'minecraft:zombie_villager',
  'minecraft:zombified_piglin',
  'hordes:zombie_player',
  'hordes:husk_player',
  'hordes:drowned_player'
]);

const FALLBACK_BUFF = { health: 10, damage: 3, speed: 0.05, knockback: 0.2 };

function reclamationBuff(level) {
  try {
    if (global.ZI_RECLAMATION && typeof global.ZI_RECLAMATION.getPhase === 'function') {
      var phase = global.ZI_RECLAMATION.getPhase(level);
      if (phase && phase.buff) return phase.buff;
    }
  } catch (e) {}
  return FALLBACK_BUFF;
}

EntityEvents.spawned(event => {
  const entity = event.entity;
  if (!entity || !entity.level || entity.level.isClientSide()) return;
  if (entity.age > 0) return; // only buff fresh spawns, not chunk-load re-adds
  if (!BUFFED.has('' + entity.type)) return;

  var buff = reclamationBuff(entity.level);

  // Wrapped so a bad attribute id can NEVER abort the entity spawn (a thrown
  // error here corrupts the whole entity-add process).
  try {
    entity.modifyAttribute('minecraft:generic.max_health', 'kubejs:reclamation_health', buff.health, 'addition');
    entity.modifyAttribute('minecraft:generic.attack_damage', 'kubejs:reclamation_damage', buff.damage, 'addition');
    entity.modifyAttribute('minecraft:generic.movement_speed', 'kubejs:reclamation_speed', buff.speed, 'addition');
    entity.modifyAttribute('minecraft:generic.knockback_resistance', 'kubejs:reclamation_kb', buff.knockback, 'addition');
    entity.health = entity.maxHealth; // heal to the new max so they don't spawn wounded
  } catch (e) {}

  // Kill vanilla "summon reinforcements when hit" -- an infinite zombie source
  // that would break the finite reserve. This is a ZOMBIE-only attribute
  // (zombie.spawn_reinforcements, NOT generic.*), so it's done separately/guarded.
  try {
    entity.modifyAttribute('minecraft:zombie.spawn_reinforcements', 'kubejs:wwz_noreinforce', -1, 'addition');
  } catch (e) {}
});
