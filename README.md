# Vice Pack (Minecraft Bedrock add-on)

Beer, liquor, cigarettes, cigars, joints, bongs, weed, cocaine, ketamine, opium and shrooms. Each one has its own
effects, screen tint, sounds and particles, and each one can be put down in the world as a block.

**Install:** open `Vice_Pack_v1_1.mcaddon`, then turn on both packs (Behavior + Resource) for the world.
Needs Minecraft Bedrock 1.21.90 or newer. Items are in the creative inventory (Items tab, next to food) and craftable.

## Using things

- **Hold use** on beer, liquor, a cigarette, cigar, joint, opium, shrooms or the bong to drink / smoke / eat it.
- **Put anything down:** sneak + use on the top of a block (a table, the floor...). Then **use the placed block** to
  drink, smoke or eat it straight from there. Break it to pick it back up.
- **Cocaine and ketamine** are cut into **lines** on whatever you use them on (up to 3 per block; use more powder on
  the lines to add another). Use the lines to **snort one**: the camera leans down to the table, sweeps along the
  line and snaps back up.
- **Bong:** place it (or hold it) and use it with **weed** in your inventory. Each hit uses one weed.
- **Weed** plants on grass/dirt (just use it on the ground). It grows in 4 stages on its own; bone meal speeds it up.
  Use a grown plant to harvest 2–3 buds (it goes back to stage 2).

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
| `Vice Pack BP/scripts/main.js` | All the behaviour: `SUBSTANCES` (what each one does), placing, the placed blocks (snort, bong, plant), the per-second loop, the HUD |
| `tools/vice_data.py` | Writes all the item, block, geometry, recipe, loot table and texture-atlas JSON from its tables |
| `tools/vice_textures.py` | Draws the item icons, block textures (lines, plant stages) and pack icon |
| `tools/build_vice.py` | Builds `Vice_Pack_vX_Y.mcaddon` |
| `Vice Pack RP/particles/` | `vice:smoke_puff`, `smoke_wisp`, `ember`, `powder`, `swirl`, `trip_orb` |
| `tests/vice/run.mjs` | Headless check against a mock of the API: every item, placing, the snort, the bong, the plant, overdoses (`node tests/vice/run.mjs`) |

After changing a table: `python3 tools/vice_data.py && python3 tools/vice_textures.py && node tests/vice/run.mjs && python3 tools/build_vice.py`

Note: for personal worlds and private servers. Marketplace and Realms content rules don't allow drug content, so
don't publish it there as-is (renaming the items in `tools/vice_data.py` is all it takes).
