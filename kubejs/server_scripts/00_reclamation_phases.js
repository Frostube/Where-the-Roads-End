// ---------------------------------------------------------------------------
// Reclamation phase curve.
//
// This is the single tuning table for the day-based apocalypse arc:
//   P1 days   0-29  Fresh Outbreak      -> surface is suicidal
//   P2 days  30-99  Degradation         -> short expeditions become possible
//   P3 days 100-249 Reclamation Window  -> buildings/streets can be cleared
//   P4 day  250+    Residual Dead       -> rebuilding, with rare lethal pockets
//
// Other KubeJS zombie systems read global.ZI_RECLAMATION instead of hardcoding
// their own curve.
// ---------------------------------------------------------------------------

(function () {
  var DAY_TICKS = 24000;

  var PHASES = [
    {
      id: 'fresh_outbreak',
      name: 'P1 Fresh Outbreak',
      startDay: 0,
      endDay: 30,
      summary: 'The surface belongs to the dead. Travel only if you must.',
      buff: { health: 16, damage: 4, speed: 0.08, knockback: 0.35 },
      migration: {
        interval: 7200,
        jitter: 1800,
        quietRadius: 56,
        quietMax: 2,
        minDist: 80,
        maxDist: 120,
        chance: 1.0,
        minBurst: 2,
        maxBurst: 4,
        message: 'The city is still screaming. Movement closes in...'
      },
      blockBreak: { softChance: 1.0, toughGain: 1.25 }
    },
    {
      id: 'degradation',
      name: 'P2 Degradation',
      startDay: 30,
      endDay: 100,
      summary: 'The first wave has thinned. Short, careful expeditions are viable.',
      buff: { health: 10, damage: 3, speed: 0.05, knockback: 0.2 },
      migration: {
        interval: 14400,
        jitter: 3600,
        quietRadius: 48,
        quietMax: 4,
        minDist: 96,
        maxDist: 120,
        chance: 0.9,
        minBurst: 1,
        maxBurst: 2,
        message: 'A distant moan drifts in from the city...'
      },
      blockBreak: { softChance: 0.8, toughGain: 1.0 }
    },
    {
      id: 'reclamation_window',
      name: 'P3 Reclamation Window',
      startDay: 100,
      endDay: 250,
      summary: 'Clearing a building, then a street, then a block is now possible.',
      buff: { health: 5, damage: 1.5, speed: 0.025, knockback: 0.1 },
      migration: {
        interval: 21600,
        jitter: 7200,
        quietRadius: 40,
        quietMax: 6,
        minDist: 104,
        maxDist: 128,
        chance: 0.65,
        minBurst: 1,
        maxBurst: 1,
        message: 'Something old and hungry wanders back through the ruins...'
      },
      blockBreak: { softChance: 0.45, toughGain: 0.5 }
    },
    {
      id: 'residual_dead',
      name: 'P4 Residual Dead',
      startDay: 250,
      endDay: -1,
      summary: 'The world can be rebuilt, but deep pockets of dead still remain.',
      buff: { health: 2, damage: 1, speed: 0.01, knockback: 0.05 },
      migration: {
        interval: 43200,
        jitter: 12000,
        quietRadius: 32,
        quietMax: 8,
        minDist: 112,
        maxDist: 128,
        chance: 0.35,
        minBurst: 1,
        maxBurst: 1,
        message: 'A lone corpse finds its way back to the road...'
      },
      blockBreak: { softChance: 0.2, toughGain: 0.2 }
    }
  ];

  function asNumber(value) {
    var n = Number(value);
    if (isNaN(n)) n = parseInt('' + value, 10);
    if (isNaN(n)) return 0;
    return n;
  }

  function getDayTime(level) {
    if (!level) return 0;

    try {
      if (typeof level.getDayTime === 'function') return asNumber(level.getDayTime());
    } catch (e) {}

    try {
      if (typeof level.dayTime === 'function') return asNumber(level.dayTime());
    } catch (e) {}

    try {
      if (level.dayTime !== undefined) return asNumber(level.dayTime);
    } catch (e) {}

    try {
      if (typeof level.getGameTime === 'function') return asNumber(level.getGameTime());
    } catch (e) {}

    try {
      if (level.time !== undefined) return asNumber(level.time);
    } catch (e) {}

    return 0;
  }

  function getDay(level) {
    return Math.max(0, Math.floor(getDayTime(level) / DAY_TICKS));
  }

  function getPhaseForDay(day) {
    for (var i = 0; i < PHASES.length; i++) {
      var phase = PHASES[i];
      if (day >= phase.startDay && (phase.endDay < 0 || day < phase.endDay)) return phase;
    }
    return PHASES[PHASES.length - 1];
  }

  function getPhase(level) {
    return getPhaseForDay(getDay(level));
  }

  global.ZI_RECLAMATION = {
    dayTicks: DAY_TICKS,
    phases: PHASES,
    getDay: getDay,
    getPhaseForDay: getPhaseForDay,
    getPhase: getPhase
  };

  var SEEN_KEY = 'zi_reclamation_phase_seen';
  var seenMemory = {};

  PlayerEvents.tick(event => {
    var player = event.player;
    var level = player.level;
    if (!level || level.isClientSide()) return;
    if (player.age % 200 !== 0) return;

    var day = getDay(level);
    var phase = getPhaseForDay(day);
    var key = '' + player.uuid;
    var seen = seenMemory[key] || '';
    try { seen = player.persistentData.getString(SEEN_KEY); } catch (e) {}
    if (seen === phase.id) return;

    seenMemory[key] = phase.id;
    try { player.persistentData.putString(SEEN_KEY, phase.id); } catch (e) {}
    try {
      player.tell(Text.yellow('[Reclamation] Day ' + day + ' - ' + phase.name));
      player.tell(Text.gray(phase.summary));
    } catch (e) {}
  });
})();
