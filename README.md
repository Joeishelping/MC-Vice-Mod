# Vice Pack (Bedrock add-on)

A standalone add-on, separate from War Engine (it doesn't need it and doesn't change it). It adds seven
consumables, each with its own effects, screen tint, sounds and particles.

**Install:** open `Vice_Pack_v1_0.mcaddon`, then turn on both packs (Behavior + Resource) for the world.
Needs Minecraft Bedrock 1.21.90 or newer. Items are in the creative inventory (Items tab, next to food) and craftable.

## Items

Hold use (right-click / hold on mobile) to drink, smoke or snort. Max stack 16.

| Item | Recipe (shapeless, crafting table) | Effects |
|---|---|---|
| **Beer** | glass bottle + 2 wheat + sugar | Strength I 30 s, amber screen flash, burp. +1 drunk. Gives the bottle back |
| **Liquor** | glass bottle + 3 potatoes + sugar | Strength II 45 s, Resistance I, Fire Resistance, camera shake. +2.5 drunk. Gives the bottle back |
| **Cigarette** (×4) | paper + dried kelp | Haste I 90 s. Smoke wisps off the tip and exhaled puffs for 40 s. 5 within 5 min → coughing fit (Hunger, Slowness) |
| **Cigar** | paper + 3 dried kelp | Resistance I 90 s, Regeneration I 10 s, Haste I. Bigger, longer smoke (75 s) |
| **Cocaine** (×2) | paper + sugar + glowstone dust | Speed III, Haste II, Jump Boost, Night Vision 45 s, white flash, jitters, heartbeat. Then a **crash**: Slowness II, Weakness, Mining Fatigue, Hunger |
| **Ketamine** (×2) | glass bottle + sugar + nether quartz | "K-hole" 35 s: Slowness III, Nausea, Resistance II, Slow Falling, Weakness, Darkness, purple screen pulses, swirling particles |
| **Opium** | 3 poppies + brown mushroom | Regeneration II 20 s, Resistance II 60 s, Slowness II, Weakness, warm orange glow, eyelids drooping (dark fades) |

## Drunkenness

Drunk level 0–10, shown in the action bar (`Drunk ▮▮▮▯▯`); it drops by 1 every 45 s.

- **1+** hiccups
- **3+** Nausea, stumbling (random sideways shoves), stars over your head
- **5+** Slowness, eyes drooping (brief blackouts)
- **8+** blackout: alcohol poisoning (Blindness, Poison, Nausea), then back to level 5

## Overdoses

Three doses of cocaine (within 5 min), ketamine (4 min) or opium (6 min) cause an overdose: black screen,
Blindness, Nausea, Slowness III, Poison II and Wither II for 6 s. **The Wither can kill you** at low health.
Dying resets everything.

## Files

| Path | What |
|---|---|
| `Vice Pack BP/scripts/main.js` | All the behaviour: what each item does, the per-second loop (drunk, smoke, crash, k-hole, drowsiness, HUD), overdoses |
| `Vice Pack BP/items/`, `recipes/` | Item and recipe definitions (`vice:` namespace) |
| `Vice Pack RP/particles/` | `vice:smoke_puff`, `vice:smoke_wisp`, `vice:ember`, `vice:powder`, `vice:swirl` |
| `tools/vice_textures.py` | Draws the item icons and pack icon (edit the pixel maps here, then re-run) |
| `tools/build_vice.py` | Builds `Vice_Pack_vX_Y.mcaddon` |
| `tests/vice/run.mjs` | Headless check: uses every item against a mock of the API (`node tests/vice/run.mjs`) |

To tweak a substance, edit its entry in `SUBSTANCES` in `main.js` (durations are in seconds, amplifier 0 = level I).

Note: this is for personal worlds / private servers. Marketplace and Realms content rules don't allow drug
content, so don't publish it there as-is (renaming the items in `items/*.json` `minecraft:display_name` is all it takes).
