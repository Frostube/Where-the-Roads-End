Horde Anchor Patch (The Hordes)
===============================

This profile adds:
  config/hordes/data/hordes/horde_data/scripts/50_anchor_spawn_center.json

What it does:
  - Overrides The Hordes spawn X/Z center to a fixed anchor area.
  - Keeps Y untouched so normal height checks still apply.
  - Spawns entities away from anchor center:
      random signed offset of 65..85 blocks on both X and Z.

Current anchor:
  - X = 109.5
  - Z = 227.5

How to move the anchor:
  1) Open 50_anchor_spawn_center.json
  2) Change the two "value1" numbers:
       - first object  -> X anchor
       - second object -> Z anchor
  3) Save and run /reload (or restart world/server)

How to disable:
  - Rename or delete:
      config/hordes/data/hordes/horde_data/scripts/50_anchor_spawn_center.json
  - Then run /reload (or restart).
