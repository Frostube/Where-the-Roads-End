// World War Z style undead: tankier, faster, and hit harder, applied once when
// the entity spawns. Infection (The Hordes mod) is the real kill threat, so
// damage is tuned to roughly 3-4 hits on an UNARMORED player, not a one-shot.
//
// Tuning notes (edit the numbers below to taste):
//   max_health      +10  -> zombie/husk/drowned 20 HP becomes 30 (15 hearts)
//   attack_damage   +3   -> zombie base 3 becomes ~6 (scales up on Hard)
//   movement_speed  +0.05-> base 0.23 becomes ~0.28 (faster, still out-sprintable)
//   knockback_resist+0.2 -> shrug off some hits so they keep pressing in
const BUFFED = new Set([
  'minecraft:zombie',
  'minecraft:husk',
  'minecraft:drowned',
  'minecraft:zombie_villager',
  'minecraft:zombified_piglin'
]);

EntityEvents.spawned(event => {
  const entity = event.entity;
  if (!entity || !entity.level || entity.level.isClientSide()) return;
  if (entity.age > 0) return; // only buff fresh spawns, not chunk-load re-adds
  if (!BUFFED.has('' + entity.type)) return;

  // Wrapped so a bad attribute id can NEVER abort the entity spawn (a thrown
  // error here corrupts the whole entity-add process).
  try {
    entity.modifyAttribute('minecraft:generic.max_health', 'kubejs:wwz_health', 10, 'addition');
    entity.modifyAttribute('minecraft:generic.attack_damage', 'kubejs:wwz_damage', 3, 'addition');
    entity.modifyAttribute('minecraft:generic.movement_speed', 'kubejs:wwz_speed', 0.05, 'addition');
    entity.modifyAttribute('minecraft:generic.knockback_resistance', 'kubejs:wwz_kb', 0.2, 'addition');
    entity.health = entity.maxHealth; // heal to the new max so they don't spawn wounded
  } catch (e) {}

  // Kill vanilla "summon reinforcements when hit" -- an infinite zombie source
  // that would break the finite reserve. This is a ZOMBIE-only attribute
  // (zombie.spawn_reinforcements, NOT generic.*), so it's done separately/guarded.
  try {
    entity.modifyAttribute('minecraft:zombie.spawn_reinforcements', 'kubejs:wwz_noreinforce', -1, 'addition');
  } catch (e) {}
});
