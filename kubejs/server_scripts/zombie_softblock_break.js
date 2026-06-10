// Undead chew through blocks near a player, in two tiers:
//   SOFT_BLOCKS  -> removed INSTANTLY on contact (glass, dirt, sand, leaves...)
//   TOUGH_BLOCKS -> removed only after SUSTAINED contact (~10s of an undead
//                   working at it) -- wood, doors, chests, workstations, cloth
//                   and other breakable house materials. More undead on the
//                   same block = it breaks proportionally faster.
//
// Vanilla KubeJS 1.20.1 has no per-entity tick event, so this is driven from
// PlayerEvents.tick: every 5 ticks we grab undead near each player/noise source
// and process the blocks touching them. Cost stays bounded to the active area.

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
  // loose terrain
  'minecraft:grass_block',
  'minecraft:mycelium',
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
  'minecraft:clay',
  'minecraft:moss_block',
  'minecraft:soul_sand',
  'minecraft:soul_soil',
  'minecraft:snow',
  'minecraft:snow_block',
  'minecraft:powder_snow',
  'minecraft:cobweb',
  // cloth and other flimsy interiors
  'minecraft:white_wool',
  'minecraft:orange_wool',
  'minecraft:magenta_wool',
  'minecraft:light_blue_wool',
  'minecraft:yellow_wool',
  'minecraft:lime_wool',
  'minecraft:pink_wool',
  'minecraft:gray_wool',
  'minecraft:light_gray_wool',
  'minecraft:cyan_wool',
  'minecraft:purple_wool',
  'minecraft:blue_wool',
  'minecraft:brown_wool',
  'minecraft:green_wool',
  'minecraft:red_wool',
  'minecraft:black_wool',
  'minecraft:white_carpet',
  'minecraft:orange_carpet',
  'minecraft:magenta_carpet',
  'minecraft:light_blue_carpet',
  'minecraft:yellow_carpet',
  'minecraft:lime_carpet',
  'minecraft:pink_carpet',
  'minecraft:gray_carpet',
  'minecraft:light_gray_carpet',
  'minecraft:cyan_carpet',
  'minecraft:purple_carpet',
  'minecraft:blue_carpet',
  'minecraft:brown_carpet',
  'minecraft:green_carpet',
  'minecraft:red_carpet',
  'minecraft:black_carpet',
  'minecraft:white_banner',
  'minecraft:orange_banner',
  'minecraft:magenta_banner',
  'minecraft:light_blue_banner',
  'minecraft:yellow_banner',
  'minecraft:lime_banner',
  'minecraft:pink_banner',
  'minecraft:gray_banner',
  'minecraft:light_gray_banner',
  'minecraft:cyan_banner',
  'minecraft:purple_banner',
  'minecraft:blue_banner',
  'minecraft:brown_banner',
  'minecraft:green_banner',
  'minecraft:red_banner',
  'minecraft:black_banner',
  'minecraft:white_wall_banner',
  'minecraft:orange_wall_banner',
  'minecraft:magenta_wall_banner',
  'minecraft:light_blue_wall_banner',
  'minecraft:yellow_wall_banner',
  'minecraft:lime_wall_banner',
  'minecraft:pink_wall_banner',
  'minecraft:gray_wall_banner',
  'minecraft:light_gray_wall_banner',
  'minecraft:cyan_wall_banner',
  'minecraft:purple_wall_banner',
  'minecraft:blue_wall_banner',
  'minecraft:brown_wall_banner',
  'minecraft:green_wall_banner',
  'minecraft:red_wall_banner',
  'minecraft:black_wall_banner',
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
  TOUGH_BLOCKS.add(`minecraft:${w}_button`);
  TOUGH_BLOCKS.add(`minecraft:${w}_pressure_plate`);
  TOUGH_BLOCKS.add(`minecraft:${w}_sign`);
  TOUGH_BLOCKS.add(`minecraft:${w}_wall_sign`);
  TOUGH_BLOCKS.add(`minecraft:${w}_hanging_sign`);
  TOUGH_BLOCKS.add(`minecraft:${w}_wall_hanging_sign`);
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

[
  'minecraft:chest',
  'minecraft:trapped_chest',
  'minecraft:barrel',
  'minecraft:crafting_table',
  'minecraft:cartography_table',
  'minecraft:fletching_table',
  'minecraft:smithing_table',
  'minecraft:loom',
  'minecraft:composter',
  'minecraft:bookshelf',
  'minecraft:chiseled_bookshelf',
  'minecraft:lectern',
  'minecraft:ladder',
  'minecraft:scaffolding',
  'minecraft:note_block',
  'minecraft:jukebox',
  'minecraft:daylight_detector',
  'minecraft:beehive',
  'minecraft:bee_nest',
  'minecraft:dead_bush',
  'minecraft:white_bed',
  'minecraft:orange_bed',
  'minecraft:magenta_bed',
  'minecraft:light_blue_bed',
  'minecraft:yellow_bed',
  'minecraft:lime_bed',
  'minecraft:pink_bed',
  'minecraft:gray_bed',
  'minecraft:light_gray_bed',
  'minecraft:cyan_bed',
  'minecraft:purple_bed',
  'minecraft:blue_bed',
  'minecraft:brown_bed',
  'minecraft:green_bed',
  'minecraft:red_bed',
  'minecraft:black_bed'
].forEach(id => TOUGH_BLOCKS.add(id));

// Undead that can claw through blocks.
const UNDEAD = new Set([
  'minecraft:zombie',
  'minecraft:husk',
  'minecraft:drowned',
  'minecraft:zombie_villager',
  'minecraft:zombified_piglin',
  'hordes:zombie_player',
  'hordes:husk_player',
  'hordes:drowned_player'
]);

const OFFSETS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1]
];

const RADIUS = 48;

// --- tough-block "chewing" progress (resets on server reload) ---
const chew = {};       // "x|y|z" -> accumulated progress
const BREAK_AT = 200;  // points to break a tough block (~10s for ONE undead)
const GAIN = 5;        // points added per scan an undead is on the block
const DECAY = 5;       // points lost per scan when nothing is working it
const MAX_WORKERS_PER_BLOCK = 4;
const FALLBACK_BREAK = { softChance: 0.8, toughGain: 1.0 };

function phaseBreakConfig(level) {
  try {
    if (global.ZI_RECLAMATION && typeof global.ZI_RECLAMATION.getPhase === 'function') {
      var phase = global.ZI_RECLAMATION.getPhase(level);
      if (phase && phase.blockBreak) return phase.blockBreak;
    }
  } catch (e) {}
  return FALLBACK_BREAK;
}

function isIntuitiveSoftBlock(id) {
  if (!id) return false;
  return id.indexOf('glass') >= 0 ||
    id.indexOf('leaves') >= 0 ||
    id.indexOf('_wool') >= 0 ||
    id.indexOf('_carpet') >= 0 ||
    id.indexOf('_banner') >= 0 ||
    id.indexOf('_wall_banner') >= 0 ||
    id.indexOf('cobweb') >= 0;
}

function isNaturalDigBlock(id) {
  return id === 'minecraft:grass_block' ||
    id === 'minecraft:mycelium' ||
    id === 'minecraft:dirt' ||
    id === 'minecraft:coarse_dirt' ||
    id === 'minecraft:podzol' ||
    id === 'minecraft:rooted_dirt' ||
    id === 'minecraft:dirt_path' ||
    id === 'minecraft:farmland' ||
    id === 'minecraft:mud' ||
    id === 'minecraft:clay' ||
    id === 'minecraft:moss_block' ||
    id === 'minecraft:sand' ||
    id === 'minecraft:red_sand' ||
    id === 'minecraft:gravel';
}

function isWoodNamedBlock(id) {
  if (!id) return false;
  var terms = [
    'wood', 'wooden', 'plank',
    'oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak',
    'mangrove', 'cherry', 'bamboo', 'crimson', 'warped',
    'pine', 'fir', 'redwood', 'mahogany', 'jacaranda', 'palm',
    'willow', 'dead', 'magic', 'umbran', 'hellbark', 'rosewood',
    'maple', 'ebony'
  ];
  for (var i = 0; i < terms.length; i++) {
    if (id.indexOf(terms[i]) >= 0) return true;
  }
  return false;
}

function isIntuitiveToughBlock(id) {
  if (!id) return false;
  if (id.indexOf('ender_chest') >= 0) return false;

  var structural = id.indexOf('_planks') >= 0 ||
    id.indexOf('_door') >= 0 ||
    id.indexOf('_trapdoor') >= 0 ||
    id.indexOf('_fence') >= 0 ||
    id.indexOf('_fence_gate') >= 0 ||
    id.indexOf('_slab') >= 0 ||
    id.indexOf('_stairs') >= 0 ||
    id.indexOf('_log') >= 0 ||
    id.indexOf('_wood') >= 0 ||
    id.indexOf('_stem') >= 0 ||
    id.indexOf('_hyphae') >= 0 ||
    id.indexOf('_sign') >= 0 ||
    id.indexOf('_wall_sign') >= 0 ||
    id.indexOf('_hanging_sign') >= 0 ||
    id.indexOf('_wall_hanging_sign') >= 0 ||
    id.indexOf('_button') >= 0 ||
    id.indexOf('_pressure_plate') >= 0;

  if (structural && isWoodNamedBlock(id)) return true;

  return id.indexOf('chest') >= 0 ||
    id.indexOf('barrel') >= 0 ||
    id.indexOf('crafting_table') >= 0 ||
    id.indexOf('bookshelf') >= 0 ||
    id.indexOf('lectern') >= 0 ||
    id.indexOf('ladder') >= 0 ||
    id.indexOf('scaffolding') >= 0 ||
    id.indexOf('composter') >= 0 ||
    id.indexOf('loom') >= 0 ||
    id.indexOf('_bed') >= 0;
}

PlayerEvents.tick(event => {
  const player = event.player;
  const level = player.level;
  if (!level || level.isClientSide()) return;
  if (player.age % 5 !== 0) return;
  const cfg = phaseBreakConfig(level);
  const softChance = cfg.softChance === undefined ? FALLBACK_BREAK.softChance : cfg.softChance;
  const toughGain = Math.max(1, Math.floor(GAIN * (cfg.toughGain || FALLBACK_BREAK.toughGain)));

  const px = player.x, py = player.y, pz = player.z;
  const nearby = level.getEntitiesWithin(AABB.of(
    px - RADIUS, py - RADIUS, pz - RADIUS,
    px + RADIUS, py + RADIUS, pz + RADIUS));
  if (!nearby) return;

  const worked = new Set(); // tough-block positions touched this scan
  const workCount = {};     // cap per-block crowd pressure so swarms do not insta-delete doors

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

      if (SOFT_BLOCKS.has(id) || isIntuitiveSoftBlock(id)) {
        // Do not let surface hordes randomly crater every grass/dirt block.
        // Downward digging only starts when the survivor/noise is below them.
        if (off[1] < 0 && isNaturalDigBlock(id) && player.y > entity.y - 1.5) continue;
        // Instant, quiet removal (no drops).
        if (Math.random() <= softChance) block.set('minecraft:air');
      } else if (TOUGH_BLOCKS.has(id) || isIntuitiveToughBlock(id)) {
        var key = x + '|' + y + '|' + z;
        worked.add(key);
        var workers = workCount[key] || 0;
        if (workers >= MAX_WORKERS_PER_BLOCK) continue;
        workCount[key] = workers + 1;
        var p = (chew[key] || 0) + toughGain; // stacks if several undead share a block
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
