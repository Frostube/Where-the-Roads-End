// Undead chew through blocks near a player, in two tiers:
//   SOFT_BLOCKS  -> removed INSTANTLY on contact (glass, dirt, sand, leaves...)
//   TOUGH_BLOCKS -> removed only after SUSTAINED contact (~10s of an undead
//                   working at it) -- wooden barricades: planks, logs, doors,
//                   fences, gates, trapdoors. More undead on the same block =
//                   it breaks proportionally faster (collective pressure).
//
// Vanilla KubeJS 1.20.1 has no per-entity tick event, so this is driven from
// PlayerEvents.tick: every 5 ticks we grab undead within RADIUS of each player
// and process the blocks touching them. Cost stays bounded to near players.

const SOFT_BLOCKS = new Set([
  'minecraft:glass',
  'minecraft:glass_pane',
  'minecraft:white_stained_glass',
  'minecraft:white_stained_glass_pane',
  'minecraft:orange_stained_glass',
  'minecraft:orange_stained_glass_pane',
  'minecraft:magenta_stained_glass',
  'minecraft:magenta_stained_glass_pane',
  'minecraft:light_blue_stained_glass',
  'minecraft:light_blue_stained_glass_pane',
  'minecraft:yellow_stained_glass',
  'minecraft:yellow_stained_glass_pane',
  'minecraft:lime_stained_glass',
  'minecraft:lime_stained_glass_pane',
  'minecraft:pink_stained_glass',
  'minecraft:pink_stained_glass_pane',
  'minecraft:gray_stained_glass',
  'minecraft:gray_stained_glass_pane',
  'minecraft:light_gray_stained_glass',
  'minecraft:light_gray_stained_glass_pane',
  'minecraft:cyan_stained_glass',
  'minecraft:cyan_stained_glass_pane',
  'minecraft:purple_stained_glass',
  'minecraft:purple_stained_glass_pane',
  'minecraft:blue_stained_glass',
  'minecraft:blue_stained_glass_pane',
  'minecraft:brown_stained_glass',
  'minecraft:brown_stained_glass_pane',
  'minecraft:green_stained_glass',
  'minecraft:green_stained_glass_pane',
  'minecraft:red_stained_glass',
  'minecraft:red_stained_glass_pane',
  'minecraft:black_stained_glass',
  'minecraft:black_stained_glass_pane',
  // loose terrain (grass_block excluded: it breaks on its own once dirt is gone)
  'minecraft:sand',
  'minecraft:red_sand',
  'minecraft:gravel',
  'minecraft:dirt',
  'minecraft:coarse_dirt',
  'minecraft:podzol',
  'minecraft:rooted_dirt',
  'minecraft:dirt_path',
  'minecraft:farmland',
  'minecraft:mud',
  'minecraft:soul_sand',
  'minecraft:soul_soil',
  'minecraft:snow',
  'minecraft:snow_block',
  'minecraft:powder_snow',
  'minecraft:cobweb',
  // foliage
  'minecraft:oak_leaves',
  'minecraft:spruce_leaves',
  'minecraft:birch_leaves',
  'minecraft:jungle_leaves',
  'minecraft:acacia_leaves',
  'minecraft:dark_oak_leaves',
  'minecraft:mangrove_leaves',
  'minecraft:cherry_leaves',
  'minecraft:azalea_leaves',
  'minecraft:flowering_azalea_leaves'
]);

// Tough wooden "barricade" blocks, built from every wood type.
const TOUGH_BLOCKS = new Set();
const WOODS = [
  'oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak',
  'mangrove', 'cherry', 'bamboo', 'crimson', 'warped'
];
WOODS.forEach(w => {
  TOUGH_BLOCKS.add(`minecraft:${w}_planks`);
  TOUGH_BLOCKS.add(`minecraft:${w}_door`);
  TOUGH_BLOCKS.add(`minecraft:${w}_trapdoor`);
  TOUGH_BLOCKS.add(`minecraft:${w}_fence`);
  TOUGH_BLOCKS.add(`minecraft:${w}_fence_gate`);
  TOUGH_BLOCKS.add(`minecraft:${w}_slab`);
  TOUGH_BLOCKS.add(`minecraft:${w}_stairs`);
});
['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry'].forEach(w => {
  TOUGH_BLOCKS.add(`minecraft:${w}_log`);
  TOUGH_BLOCKS.add(`minecraft:stripped_${w}_log`);
  TOUGH_BLOCKS.add(`minecraft:${w}_wood`);
  TOUGH_BLOCKS.add(`minecraft:stripped_${w}_wood`);
});
['crimson', 'warped'].forEach(w => {
  TOUGH_BLOCKS.add(`minecraft:${w}_stem`);
  TOUGH_BLOCKS.add(`minecraft:stripped_${w}_stem`);
  TOUGH_BLOCKS.add(`minecraft:${w}_hyphae`);
  TOUGH_BLOCKS.add(`minecraft:stripped_${w}_hyphae`);
});
TOUGH_BLOCKS.add('minecraft:bamboo_block');
TOUGH_BLOCKS.add('minecraft:stripped_bamboo_block');
TOUGH_BLOCKS.add('minecraft:bamboo_mosaic');
TOUGH_BLOCKS.add('minecraft:bamboo_mosaic_slab');
TOUGH_BLOCKS.add('minecraft:bamboo_mosaic_stairs');

// Undead that can claw through blocks.
const UNDEAD = new Set([
  'minecraft:zombie',
  'minecraft:husk',
  'minecraft:drowned',
  'minecraft:zombie_villager',
  'minecraft:zombified_piglin'
]);

const OFFSETS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1]
];

const RADIUS = 16;

// --- tough-block "chewing" progress (resets on server reload) ---
const chew = {};       // "x|y|z" -> accumulated progress
const BREAK_AT = 200;  // points to break a tough block (~10s for ONE undead)
const GAIN = 5;        // points added per scan an undead is on the block
const DECAY = 5;       // points lost per scan when nothing is working it

PlayerEvents.tick(event => {
  const player = event.player;
  const level = player.level;
  if (!level || level.isClientSide()) return;
  if (player.age % 5 !== 0) return;

  const px = player.x, py = player.y, pz = player.z;
  const nearby = level.getEntitiesWithin(AABB.of(
    px - RADIUS, py - RADIUS, pz - RADIUS,
    px + RADIUS, py + RADIUS, pz + RADIUS));
  if (!nearby) return;

  const worked = new Set(); // tough-block positions touched this scan

  nearby.forEach(entity => {
    if (!UNDEAD.has('' + entity.type)) return;

    const baseX = Math.floor(entity.x);
    const baseY = Math.floor(entity.y);
    const baseZ = Math.floor(entity.z);

    for (var oi = 0; oi < OFFSETS.length; oi++) {
      var off = OFFSETS[oi];
      var x = baseX + off[0];
      var y = baseY + off[1];
      var z = baseZ + off[2];
      var block = level.getBlock(x, y, z);
      if (!block) continue;
      var id = block.id;

      if (SOFT_BLOCKS.has(id)) {
        // Instant, quiet removal (no drops).
        block.set('minecraft:air');
      } else if (TOUGH_BLOCKS.has(id)) {
        var key = x + '|' + y + '|' + z;
        worked.add(key);
        var p = (chew[key] || 0) + GAIN; // stacks if several undead share a block
        if (p >= BREAK_AT) {
          block.set('minecraft:air');
          delete chew[key];
        } else {
          chew[key] = p;
        }
      }
    }
  });

  // Decay progress on tough blocks no undead worked this scan (they wandered off).
  for (var dkey in chew) {
    if (worked.has(dkey)) continue;
    var dp = chew[dkey] - DECAY;
    if (dp <= 0) delete chew[dkey];
    else chew[dkey] = dp;
  }
});
