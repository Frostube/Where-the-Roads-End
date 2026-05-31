ServerEvents.recipes(event => {
  event.remove({ id: 'tacz:gunpowder' })
  event.shapeless(Item.of('patchouli:guide_book', '{"patchouli:book":"patchouli:notebook"}'),
    ['minecraft:book', 'minecraft:rotten_flesh'])
})

LootJS.modifiers(event => {
  let drop_coin = ['zombie', 'drowned', 'zoglin', 'zombie_villager', 'zombified_piglin']
  let remove_loot = ['#forge:tools', '#forge:weapons', 'map']
  // let remove_loot = ['wooden_sword', 'wooden_shovel', 'wooden_axe', 'wooden_pickaxe', 'wooden_hoe']
  event
    .addEntityLootModifier(drop_coin)
    .matchKiller(entity => {
      entity.anyType(['minecraft:player', 'minecraft:iron_golem', 'guardvillagers:guard'])
    })
    .addLoot([
      LootEntry.of('numismatic-overhaul:bronze_coin')
        .limitCount([5, 20]).applyLootingBonus([0, 20]),
      LootEntry.of('numismatic-overhaul:silver_coin').limitCount([1, 2]).when(c =>
        c.randomChanceWithEnchantment('minecraft:looting', [0.6, 0.65, 0.8, 0.95])),
      LootEntry.of('numismatic-overhaul:silver_coin').when(c =>
        c.randomChanceWithEnchantment('minecraft:looting', [0.15, 0.15, 0.2, 0.3])),
      LootEntry.of('numismatic-overhaul:silver_coin').when(c =>
        c.randomChanceWithEnchantment('minecraft:looting', [0.08, 0.08, 0.11, 0.15])),
      LootEntry.of('numismatic-overhaul:silver_coin').when(c =>
        c.randomChanceWithEnchantment('minecraft:looting', [0.02, 0.03, 0.05, 0.1])),
    ])
  event
    .addLootTypeModifier(LootType.CHEST)
    .anyDimension('minecraft:overworld')
    .pool(pool => {
      remove_loot.forEach(item => {
        pool.removeLoot(item)
      })
      pool.addLoot([
        LootEntry.of('gunpowder').limitCount({ n: 48, p: 0.3 })
          .when(c => c.randomChance(0.9)),
        LootEntry.of('paper').limitCount({ n: 24, p: 0.3 })
          .when(c => c.randomChance(0.6)),
        LootEntry.of('sugar_cane').limitCount({ n: 18, p: 0.3 })
          .when(c => c.randomChance(0.15)),
        LootEntry.of('copper_ingot').limitCount({ n: 36, p: 0.3 })
          .when(c => c.randomChance(0.6)),
        LootEntry.of('gold_ingot').limitCount({ n: 20, p: 0.3 })
          .when(c => c.randomChance(0.4)),
        LootEntry.of('lapis_lazuli').limitCount({ n: 24, p: 0.3 })
          .when(c => c.randomChance(0.3)),
        LootEntry.of('netherite_scrap').limitCount({ n: 8, p: 0.3 })
          .when(c => c.randomChance(0.05)),
      ])
    })
})
