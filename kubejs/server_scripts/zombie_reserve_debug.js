// Debug readout for the finite zombie reserve + a nearby-entity TYPE dump.
//
// HOLD A CLOCK in your main hand -> every ~3s your chat shows the reserve and a
// list of every mob type within 64 blocks (so we can see the REAL entity id of
// your zombies). Put the clock away to stop.
//
// Delete this file when you're done debugging.

const DBG2_RESERVE_KEY = 'zi_zombie_reserve';
const DBG2_ITEM = 'minecraft:clock';
const DBG2_IGNORE = new Set([
  'minecraft:player', 'minecraft:item', 'minecraft:experience_orb',
  'minecraft:arrow', 'minecraft:item_frame', 'minecraft:armor_stand'
]);

PlayerEvents.tick(event => {
  const player = event.player;
  const level = player.level;
  if (!level || level.isClientSide()) return;
  if (player.age % 60 !== 0) return; // ~3s throttle

  let held = null;
  try { held = player.mainHandItem; } catch (e) {}
  if (!held || held.id !== DBG2_ITEM) return;

  const server = level.server;
  if (!server) { player.tell(Text.red('[reserve] level.server is null')); return; }

  const reserve = server.persistentData.getInt(DBG2_RESERVE_KEY);

  // dump distinct mob types within 64 blocks so we can identify the zombies
  const types = {};
  try {
    const near = level.getEntitiesWithin(AABB.of(
      player.x - 64, player.y - 64, player.z - 64,
      player.x + 64, player.y + 64, player.z + 64));
    near.forEach(e => {
      const t = '' + e.type;
      if (DBG2_IGNORE.has(t)) return;
      types[t] = (types[t] || 0) + 1;
    });
  } catch (e) {}

  const keys = Object.keys(types);
  let summary = keys.map(k => k + ' x' + types[k]).join(', ');
  if (!summary) summary = '(no mobs within 64 blocks)';

  player.tell(Text.yellow('[reserve] loose zombies = ' + reserve));
  player.tell(Text.gray('nearby mobs: ' + summary));
});
