# Vice Pack (Minecraft Bedrock add-on)

Beer, wine, liquor, coffee, tea, cigarettes, cigars, a pipe, Zynn, joints, bongs, weed, cocaine, ketamine, opium,
morphine and shrooms. Each one has its own effects, colour haze, sounds and particles, and each one can be put down in
the world as a block. Grow your own weed, tobacco, opium poppies, coffee and tea. Soldiers from War Engine (and
villagers) carry vices and use them themselves.

**Install:** open `Vice_Pack_v1_3.mcaddon`, then turn on both packs (Behavior + Resource) for the world.
Needs Minecraft Bedrock 1.21.90 or newer. Everything is in one collapsible **VICES** group in the creative inventory
(Items tab), and craftable.

## Using things

- **Hold use** on any drink, smoke, pouch, syringe or the shrooms to use it.
- **Put anything down:** sneak + use on the top of a block (a table, the floor...). Then **use the placed block** to
  drink, smoke or eat it straight from there. Break it to pick it back up.
- **Cocaine and ketamine** are cut into **lines** on whatever you use them on (up to 3 per block; use more powder on
  the lines to add another). Use the lines to **snort one**: the camera leans down to the table, sweeps along the
  line and snaps back up.
- **Bong / Pipe:** place it (or hold it) and use it with **weed** (bong) or a **tobacco leaf** (pipe) in your
  inventory. Each use burns one; the bong or pipe stays.

## Growing

Use the seed on grass, dirt or farmland. Every crop grows in 4 stages on its own (bone meal speeds it up); use a
grown plant to harvest it (it goes back to stage 2), or break it.

| Plant with | Grows | Harvest |
|---|---|---|
| **Weed** | weed plant | 2–3 weed |
| **Tobacco Seeds** | tall tobacco with pink flowers | 2–4 tobacco leaves (+ maybe seeds) |
| **Opium Poppy Seeds** | poppies, then seed pods | 1–2 opium (+ seeds) |
| **Coffee Beans** | coffee bush with red cherries | 2–4 coffee beans |
| **Tea Leaves** | low tea bush with white flowers | 2–3 tea leaves |

Getting started: breaking grass or ferns sometimes drops a seed, or craft them (below).

## Soldiers and villagers

War Engine soldiers (and villagers) carry a **stash** of vices and use them **by themselves**, depending on what
they're doing:

- **Idle** (standing around, not shooting): every minute or so they light a cigarette, pack a pipe, have a coffee,
  a beer, a pouch of Zynn... You see the smoke, hear the drinking, and drunk soldiers stumble around.
- **In a firefight:** stimulants first (Zynn, coffee, cocaine, a swig of liquor).
- **Hurt** (under half health): painkillers first (morphine, opium, ketamine, tea).
- **Medics** with morphine inject wounded soldiers **of their own faction** near them.
- **Rations:** every new soldier gets a few things in his pockets (smokes or Zynn, coffee or tea, sometimes a drink
  or a pipe; medics get morphine). Turn it off with `/scriptevent vice:rations off` (`on` to turn it back on).
- **Give them more:** sneak + use while looking at one hands him the item you're holding (up to 16 things). The
  action bar shows what he carries. Narcaine sobers him up on the spot.
- A soldier who dies drops what he was carrying.

The War Engine pack doesn't need any change for this; Vice Pack reads the soldiers' own state (firing, aiming,
downed, medic, faction).

## Items

| Item | Recipe (shapeless, crafting table) | Effects |
|---|---|---|
| **Beer** | glass bottle + 2 wheat + sugar | Strength I 30 s, amber flash, burp. +1 drunk. Gives the bottle back |
| **Liquor** | glass bottle + 3 potatoes + sugar | Strength II 45 s, Resistance I, Fire Resistance, camera shake. +2.5 drunk |
| **Cigarette** (×4) | paper + dried kelp | Haste I 90 s, smoke for 40 s. 5 within 5 min → coughing fit |
| **Cigar** | paper + 3 dried kelp | Resistance I 90 s, Regeneration I, Haste I. Bigger, longer smoke |
| **Weed** | fern + bone meal (or grow it) | Plant it; roll it into joints or smoke it in a bong |
| **Joint** | paper + weed | Stoned 60 s: Regeneration I, Slowness, munchies (Hunger), green haze, floaty sway, giggles |
| **Bong** | 3 glass + glass bottle | Bubbling, big cloud, cough. Stoned 90 s: Regeneration II, Slowness, Hunger II. Not used up |
| **Shrooms** (×2) | brown + red mushroom + glowstone dust | Trip 90 s: glowing rainbow orbs drifting around you, colour washes, chimes, Night Vision |
| **Cocaine** (×2) | paper + sugar + glowstone dust | Snorted: Speed III, Haste II, Jump Boost, Night Vision 45 s, jitters, heartbeat. Then a crash |
| **Ketamine** (×2) | glass bottle + sugar + nether quartz | Snorted: k-hole 35 s: Slowness III, Nausea, Slow Falling, Resistance II, purple pulses |
| **Opium** | 3 poppies + brown mushroom | Regeneration II, Resistance II, Slowness II 60 s, warm glow, eyelids drooping |
| **Narcaine** (×2) | glass bottle + glistering melon slice | Stops **everything** from this pack at once: effects, colour haze, camera shake, drunkenness, the HUD |
| **Zynn** (×4) | tobacco leaf + paper + iron nugget | A pouch: Haste I 2 min, Speed I 20 s, no smoke. Too many → queasy |
| **Coffee** | bowl + 2 coffee beans + sugar | Speed I + Haste I 90 s, wakes you up (clears Slowness), sobers you up a bit. 4 cups → the shakes |
| **Tea** | bowl + 2 tea leaves | Regeneration I 15 s, settles your stomach (clears Nausea, Weakness) |
| **Wine** | glass bottle + 3 sweet berries | Regeneration I, Strength I. +1.5 drunk, deep red haze |
| **Pipe** | bowl + stick | Smokes a tobacco leaf: Resistance I + Haste I 60 s. Not used up |
| **Morphine** (×2) | opium + glass bottle + iron nugget | Instant Health, Regeneration III, Resistance II, clears Wither/Poison. Counts as opium for overdoses |
| Cigarette / Cigar | paper + tobacco leaf (×4) / paper + 3 tobacco leaves | Also still craftable from dried kelp |
| Seeds | poppy → 2 poppy seeds; wheat seeds + dried kelp → 2 tobacco seeds; cocoa beans + bone meal → 2 coffee beans; oak leaves + bone meal → tea leaves | |

## On screen

- **Colour haze:** every high tints the world with a coloured haze that eases in over a few seconds, settles,
  and fades back out (amber when drunk, green when stoned, icy for cocaine, a slowly pulsing purple k-hole,
  warm orange for opium, a shifting rainbow when tripping). It never fills the screen with a solid colour; only
  blackouts (overdose, passing out drunk) go fully black.
- **Status line** (`Drunk ▮▮▮▯▯ | Stoned 42s`) shows for a few seconds when something starts, ends or your drunk
  level changes, then gets out of the way.
- **Get rid of it all:** use **Narcaine**, or run `/scriptevent vice:sober` (clears you;
  `/execute as @a run scriptevent vice:sober` clears everyone).

## Too much

- **Drunk** level 0–10 in the action bar, −1 every 45 s. 3+: Nausea, stumbling. 5+: Slowness, brief blackouts.
  8+: alcohol poisoning.
- **Overdose:** 3 doses of cocaine (within 5 min), ketamine (4 min) or opium (6 min): black screen, Blindness,
  Poison II and **Wither II, which can kill you** at low health.
- **Greening out:** 4 weed hits in 3 min: Nausea, Slowness III, Darkness (never deadly).
- **Bad trip:** 3 shrooms in 5 min: dark red orbs, bass notes, Darkness, Slowness.

Dying resets everything.

## Files

| Path | What |
|---|---|
| `Vice Pack BP/scripts/main.js` | All the behaviour: `SUBSTANCES` (what each one does), placing, the placed blocks (snort, bong/pipe, crops), NPCs (`NPC_ITEMS`), the per-second loop, the HUD |
| `Vice Pack BP/item_catalog/` | The VICES creative group |
| `tools/vice_data.py` | Writes all the item, block, geometry, recipe, loot table and texture-atlas JSON from its tables |
| `tools/vice_textures.py` | Draws the item icons, block textures (lines, plant stages) and pack icon |
| `tools/build_vice.py` | Builds `Vice_Pack_vX_Y.mcaddon` |
| `Vice Pack RP/fogs/` | The colour haze: one fog per colour and strength level (generated by `vice_data.py`) |
| `Vice Pack RP/particles/` | `vice:smoke_puff`, `smoke_wisp`, `ember`, `powder`, `swirl`, `trip_orb` |
| `tests/vice/run.mjs` | Headless check against a mock of the API: every item, placing, the snort, the bong/pipe, every crop, the haze, Narcaine, soldiers (rations, idle use, combat/hurt picks, medics, drops), overdoses (`node tests/vice/run.mjs`) |

After changing a table: `python3 tools/vice_data.py && python3 tools/vice_textures.py && node tests/vice/run.mjs && python3 tools/build_vice.py`

Note: for personal worlds and private servers. Marketplace and Realms content rules don't allow drug content, so
don't publish it there as-is (renaming the items in `tools/vice_data.py` is all it takes).
