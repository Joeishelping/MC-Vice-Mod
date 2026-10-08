// Vice Pack: beer, liquor, cigarettes, cigars, joints, bongs, weed, cocaine, ketamine, opium, shrooms.
//
// Using things:
//  - Held items (beer, liquor, cigarette, cigar, joint, opium, shrooms, bong, narcaine) are foods: hold use to drink/smoke/eat.
//    When the use completes, the substance's handler in SUBSTANCES runs.
//  - Every item can also be put down as a block: sneak + use on the top of a block (cocaine, ketamine and weed place
//    with a plain use). Using a placed block consumes it: drink the bottle, smoke the joint, eat the shrooms.
//  - Cocaine and ketamine are put down as lines (up to 3 per block, use more powder on it to add one). Using the lines
//    plays the snort: the camera bends down to the table and sweeps along a line.
//  - The bong (placed or in hand) needs weed in your inventory; each hit uses one.
//  - Weed planted on dirt/grass grows in 4 stages (bone meal speeds it up); use it when grown to harvest buds.
// A one-second loop runs the lasting parts: drunkenness, smoke, the cocaine crash, the k-hole, opium drowsiness,
// being stoned, the shroom trip, the HUD line and overdoses.
// Colours on screen are a fog haze that eases in and out (hazeTick), not full-screen fades.
// Crops (weed, tobacco, opium poppy, coffee, tea) grow in 4 stages (CROPS). War Engine soldiers who are idle with no
// enemy near have the odd smoke or drink: purely cosmetic, they're never touched (see "Soldiers").
// Narcaine (or `/scriptevent vice:sober`) stops everything at once (sober).
import * as mc from "@minecraft/server";

const { world, system, MolangVariableMap, BlockPermutation, ItemStack } = mc;
const SEC = 20;

// ---------------------------------------------------------------- per-player state
/** @type {Map<string, any>} */
const states = new Map();
function st(p) {
  let s = states.get(p.id);
  if (!s) {
    s = {
      drunk: 0,            // 0..10, beer +1, liquor +2.5, -1 per 45 s
      smokeUntil: 0,       // tick a lit cigarette/cigar/joint burns out
      smokeKind: "",
      nicotine: [],        // ticks of recent smokes (chain smoking -> coughing)
      cokeUntil: 0, cokeCrash: false,
      kUntil: 0,
      opiumUntil: 0,
      stonedUntil: 0,
      tripUntil: 0, badTrip: false,
      doses: { cocaine: [], ketamine: [], opium: [], weed: [], shrooms: [] },
      odUntil: {},         // per kind: no second overdose of the same kind within 30 s
      busyUntil: 0,        // mid-snort / mid-bong-hit
      glows: [],           // short colour boosts: { color, amount, until }
      fogColor: "", fogLevel: 0, fogAmount: 0, fogId: "",   // the colour haze now on screen
      hudKey: "", hudUntil: 0,
    };
    states.set(p.id, s);
  }
  return s;
}

// ---------------------------------------------------------------- helpers
const now = () => system.currentTick;
const rand = (a, b) => a + Math.random() * (b - a);

function safe(fn) {
  try { fn(); } catch (e) { /* entity gone, camera API missing, etc. */ }
}
function effect(p, id, seconds, amp = 0, particles = false) {
  safe(() => p.addEffect(id, Math.round(seconds * SEC), { amplifier: amp, showParticles: particles }));
}
function sound(p, id, volume = 1, pitch = 1, at) {
  safe(() => p.dimension.playSound(id, at ?? p.location, { volume, pitch }));
}
/** full-screen fade: only used for black (blackouts, eyelids); colours go through the haze (`glow`) */
function tint(p, r, g, b, fadeIn, hold, fadeOut) {
  safe(() => p.camera.fade({
    fadeColor: { red: r / 255, green: g / 255, blue: b / 255 },
    fadeTime: { fadeInTime: fadeIn, holdTime: hold, fadeOutTime: fadeOut },
  }));
}
function shake(p, intensity, seconds, type = "rotational") {
  safe(() => p.runCommand(`camerashake add @s ${intensity} ${seconds} ${type}`));
}
function say(p, msg) {
  safe(() => p.sendMessage(msg));
}
/** a point just in front of the face */
function mouth(p, ahead = 0.35, down = 0.12) {
  const h = p.getHeadLocation(), d = p.getViewDirection();
  return { x: h.x + d.x * ahead, y: h.y - down + d.y * ahead, z: h.z + d.z * ahead };
}
function particle(p, id, loc, vars) {
  safe(() => p.dimension.spawnParticle(id, loc, vars));
}
function tintVars(r, g, b) {
  const m = new MolangVariableMap();
  m.setColorRGB("variable.tint", { red: r, green: g, blue: b });
  return m;
}
/** 0..1 around the colour wheel -> [r, g, b] 0..1 */
function hue(h) {
  const f = (n) => { const k = (n + h * 6) % 6; return 1 - Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5), f(3), f(1)];
}
function exhale(p, strength = 0.6) {
  const m = new MolangVariableMap();
  m.setSpeedAndDirection("variable.puff", strength, p.getViewDirection());
  particle(p, "vice:smoke_puff", mouth(p, 0.3, 0.15), m);
}
/** count of doses of `kind` taken in the last `windowSec` seconds (after adding this one) */
function dose(s, kind, windowSec) {
  const t = now();
  s.doses[kind] = s.doses[kind].filter((x) => t - x < windowSec * SEC);
  s.doses[kind].push(t);
  return s.doses[kind].length;
}
const creative = (p) => { try { return String(p.getGameMode()).toLowerCase() === "creative"; } catch { return false; } };
function inventory(p) {
  return p.getComponent("minecraft:inventory")?.container;
}
function heldItem(p) {
  try { return inventory(p)?.getItem(p.selectedSlotIndex); } catch { return undefined; }
}
/** take one `typeId` from the player: the held stack first, else any slot. false if they have none. */
function takeOne(p, typeId) {
  if (creative(p)) return true;
  const inv = inventory(p);
  if (!inv) return false;
  const slots = [p.selectedSlotIndex, ...Array.from({ length: inv.size }, (_, i) => i)];
  for (const i of slots) {
    const it = inv.getItem(i);
    if (it?.typeId !== typeId) continue;
    if (it.amount > 1) { it.amount -= 1; inv.setItem(i, it); } else inv.setItem(i, undefined);
    return true;
  }
  return false;
}
function hasItem(p, typeId) {
  if (creative(p)) return true;
  const inv = inventory(p);
  if (!inv) return false;
  for (let i = 0; i < inv.size; i++) if (inv.getItem(i)?.typeId === typeId) return true;
  return false;
}
function dropItems(dim, loc, typeId, n) {
  if (n > 0) safe(() => dim.spawnItem(new ItemStack(typeId, n), loc));
}
const center = (b) => ({ x: b.location.x + 0.5, y: b.location.y, z: b.location.z + 0.5 });

// ---------------------------------------------------------------- overdose
function overdose(p, s, kind) {
  if (now() < (s.odUntil[kind] ?? 0)) return false;
  s.odUntil[kind] = now() + 30 * SEC;
  const msg = {
    cocaine: "§cYour heart is pounding out of your chest... §7(cocaine overdose)",
    ketamine: "§5You can't feel your body anymore... §7(ketamine overdose)",
    opium: "§6Your breathing slows to a crawl... §7(opium overdose)",
    alcohol: "§eYou blacked out. §7(alcohol poisoning)",
  }[kind];
  say(p, msg);
  tint(p, 0, 0, 0, 0.6, 2.5, 2.0);
  shake(p, 0.6, 3);
  effect(p, "blindness", 8);
  effect(p, "nausea", 20);
  effect(p, "slowness", 15, 2);
  effect(p, "poison", 10, 1);
  if (kind !== "alcohol") effect(p, "wither", 6, 1);
  sound(p, "mob.warden.heartbeat", 1, 0.8);
  return true;
}

// ---------------------------------------------------------------- substances
function light(p, s, kind, seconds) {
  s.smokeUntil = Math.max(s.smokeUntil, now() + seconds * SEC);
  s.smokeKind = kind;
  sound(p, "fire.ignite", 0.6, 1.2);
  particle(p, "vice:ember", mouth(p, 0.45, 0.15));
  system.runTimeout(() => { if (p.isValid) exhale(p, kind === "cigar" ? 1.0 : 0.7); }, 25);
}
function cough(p) {
  sound(p, "mob.horse.breathe", 0.8, 0.6);
  shake(p, 0.4, 0.6, "positional");
  safe(() => exhale(p, 1.2));
}
/** weed, from a joint (strength 1) or a bong (2) */
function getStoned(p, s, strength) {
  const n = dose(s, "weed", 180);
  s.stonedUntil = Math.max(s.stonedUntil, now()) + (strength === 2 ? 90 : 60) * SEC;
  effect(p, "regeneration", 15, strength - 1);
  effect(p, "slowness", strength === 2 ? 90 : 60, 0);
  effect(p, "hunger", 40, strength - 1);
  glow(s, "green", 0.7, 6);
  say(p, n === 1 ? "§aEverything is... chill. §7(you've got the munchies)" : "§aWhoa. §7Duuude.");
  if (n >= 4) {            // greened out: never deadly
    effect(p, "nausea", 20, 0);
    effect(p, "slowness", 20, 2);
    effect(p, "darkness", 6, 0);
    shake(p, 0.3, 4);
    say(p, "§2You greened out. Sit down for a minute.");
  }
}

const SUBSTANCES = {
  "vice:beer"(p, s) {
    s.drunk = Math.min(10, s.drunk + 1);
    effect(p, "strength", 30, 0);
    sound(p, "random.burp", 0.8, rand(0.9, 1.1));
    glow(s, "amber", 0.5, 5);
    say(p, "§6*gulp* §7Cold one.");
  },
  "vice:liquor"(p, s) {
    s.drunk = Math.min(10, s.drunk + 2.5);
    effect(p, "strength", 45, 1);
    effect(p, "resistance", 30, 0);
    effect(p, "fire_resistance", 20, 0);
    sound(p, "random.burp", 1, 0.7);
    glow(s, "amber", 0.75, 6);
    shake(p, 0.25, 1.5);
    say(p, "§6*cough* §7That burns.");
  },
  "vice:cigarette"(p, s) {
    light(p, s, "cigarette", 40);
    effect(p, "haste", 90, 0);
    s.nicotine = s.nicotine.filter((x) => now() - x < 300 * SEC);
    s.nicotine.push(now());
    if (s.nicotine.length >= 5) {      // chain smoking
      effect(p, "hunger", 15, 0);
      effect(p, "slowness", 8, 0);
      cough(p);
      say(p, "§7*hack* *cough* Maybe slow down on the smokes.");
    }
  },
  "vice:cigar"(p, s) {
    light(p, s, "cigar", 75);
    effect(p, "resistance", 90, 0);
    effect(p, "regeneration", 10, 0);
    effect(p, "haste", 60, 0);
    s.nicotine.push(now());
  },
  "vice:joint"(p, s) {
    light(p, s, "joint", 35);
    getStoned(p, s, 1);
  },
  "vice:bong"(p, s, at) {
    // a bong hit: bubbling, smoke rising out of the bong, then a cough and a big exhale
    for (let i = 0; i < 4; i++) system.runTimeout(() => sound(p, "random.swim", 0.5, rand(1.4, 1.9), at), i * 5);
    if (at) particle(p, "vice:smoke_wisp", { x: at.x, y: at.y + 0.9, z: at.z });
    system.runTimeout(() => {
      if (!p.isValid) return;
      exhale(p, 1.3);
      system.runTimeout(() => { if (p.isValid) exhale(p, 0.9); }, 6);
      cough(p);
    }, 24);
    getStoned(p, s, 2);
  },
  "vice:shrooms"(p, s) {
    const n = dose(s, "shrooms", 300);
    s.tripUntil = Math.max(s.tripUntil, now()) + 90 * SEC;
    s.badTrip = n >= 3;
    sound(p, "random.eat", 0.8, 0.9);
    effect(p, "night_vision", 90, 0);
    effect(p, "nausea", 15, 0);
    glow(s, "magenta", 0.8, 6);
    if (s.badTrip) {
      effect(p, "darkness", 20, 0);
      effect(p, "slowness", 30, 1);
      shake(p, 0.4, 5);
      say(p, "§4Bad trip. §cThe walls are breathing and they don't like you.");
    } else {
      say(p, n === 1 ? "§dThe colors... they're breathing." : "§dEverything is connected, man.");
    }
  },
  "vice:cocaine"(p, s) {
    const n = dose(s, "cocaine", 300);
    glow(s, "ice", 0.7, 4);
    shake(p, 0.35, 2, "positional");
    sound(p, "random.orb", 0.6, 2);
    effect(p, "speed", 45, 2);
    effect(p, "haste", 45, 1);
    effect(p, "jump_boost", 45, 0);
    effect(p, "night_vision", 45, 0);
    s.cokeUntil = now() + 45 * SEC;
    s.cokeCrash = true;
    say(p, n === 1 ? "§bEverything is sharp. Everything is fast." : "§bMore. Faster.");
    if (n >= 3) overdose(p, s, "cocaine");
  },
  "vice:ketamine"(p, s) {
    const n = dose(s, "ketamine", 240);
    sound(p, "mob.endermen.portal", 0.8, 0.5);
    glow(s, "purple", 1, 8);
    effect(p, "slowness", 35, 2);
    effect(p, "nausea", 30, 0);
    effect(p, "resistance", 35, 1);
    effect(p, "slow_falling", 35, 0);
    effect(p, "weakness", 35, 1);
    effect(p, "darkness", 6, 0);
    s.kUntil = now() + 35 * SEC;
    say(p, n === 1 ? "§5The world drifts away from you..." : "§5Deeper... into the hole.");
    if (n >= 3) overdose(p, s, "ketamine");
  },
  "vice:narcaine"(p) {
    sober(p);
  },
  "vice:zynn"(p, s) {
    // a pouch under the lip: a clean nicotine buzz, no smoke
    sound(p, "random.eat", 0.5, 1.4);
    effect(p, "haste", 120, 0);
    effect(p, "speed", 20, 0);
    glow(s, "mint", 0.35, 4);
    s.nicotine = s.nicotine.filter((x) => now() - x < 300 * SEC);
    s.nicotine.push(now());
    say(p, s.nicotine.length >= 5 ? "§7Your gums are buzzing. That's a lot of nicotine." : "§b*tuck* §7Zynn in. Locked in.");
    if (s.nicotine.length >= 6) { effect(p, "nausea", 8, 0); shake(p, 0.2, 2); }
  },
  "vice:coffee"(p, s) {
    const n = dose(s, "coffee", 300);
    sound(p, "random.drink", 0.8, 1.1);
    effect(p, "speed", 90, 0);
    effect(p, "haste", 90, 0);
    for (const e of ["slowness", "mining_fatigue"]) safe(() => p.removeEffect(e));     // wakes you up
    s.drunk = Math.max(0, s.drunk - 1.5);                                           // and sobers you up a little
    s.opiumUntil = Math.min(s.opiumUntil, now() + 10 * SEC);
    glow(s, "gold", 0.4, 4);
    say(p, n === 1 ? "§6*sip* §7Ahh. Now we're awake." : n >= 4 ? "§6Too. Much. Coffee. §7Your hands won't stop shaking." : "§6*sip* §7Another cup.");
    if (n >= 4) { effect(p, "nausea", 10, 0); shake(p, 0.15, 6, "positional"); }
  },
  "vice:tea"(p, s) {
    sound(p, "random.drink", 0.7, 0.9);
    effect(p, "regeneration", 15, 0);
    for (const e of ["nausea", "weakness"]) safe(() => p.removeEffect(e));            // settles the stomach
    s.drunk = Math.max(0, s.drunk - 0.5);
    glow(s, "mint", 0.4, 5);
    say(p, "§a*sip* §7Warm and calm.");
  },
  "vice:wine"(p, s) {
    s.drunk = Math.min(10, s.drunk + 1.5);
    effect(p, "regeneration", 10, 0);
    effect(p, "strength", 30, 0);
    sound(p, "random.drink", 0.8, 0.9);
    glow(s, "wine", 0.6, 6);
    say(p, "§5*sip* §7A fine vintage.");
  },
  "vice:pipe"(p, s) {
    light(p, s, "cigar", 60);
    effect(p, "resistance", 60, 0);
    effect(p, "haste", 60, 0);
    s.nicotine.push(now());
    say(p, "§6*puff* §7A good pipe.");
  },
  "vice:morphine"(p, s) {
    const n = dose(s, "opium", 360);             // same body, same limit as opium
    sound(p, "random.pop", 0.6, 2);
    effect(p, "instant_health", 1, 0);
    effect(p, "regeneration", 8, 2);
    effect(p, "resistance", 30, 1);
    effect(p, "slowness", 30, 0);
    for (const e of ["wither", "poison"]) safe(() => p.removeEffect(e));
    glow(s, "orange", 0.6, 6);
    s.opiumUntil = Math.max(s.opiumUntil, now() + 30 * SEC);
    say(p, "§6*click* §7The pain melts away.");
    if (n >= 3) overdose(p, s, "opium");
  },
  "vice:opium"(p, s) {
    const n = dose(s, "opium", 360);
    light(p, s, "opium", 12);
    sound(p, "random.fizz", 0.4, 0.6);
    glow(s, "orange", 0.8, 8);
    effect(p, "regeneration", 20, 1);
    effect(p, "resistance", 60, 1);
    effect(p, "slowness", 60, 1);
    effect(p, "weakness", 60, 0);
    effect(p, "nausea", 10, 0);
    s.opiumUntil = now() + 60 * SEC;
    say(p, n === 1 ? "§6A warm, heavy calm washes over you." : "§6So... heavy...");
    if (n >= 3) overdose(p, s, "opium");
  },
};

// held items: the use finished
world.afterEvents.itemCompleteUse.subscribe((ev) => {
  const p = ev.source, item = ev.itemStack;
  if (!p || p.typeId !== "minecraft:player" || !item) return;
  const fuel = FUEL[item.typeId];
  if (fuel) {
    // the food use gives the bong/pipe straight back (using_converts_to); the fuel is what gets used up
    if (!takeOne(p, fuel.item)) { say(p, fuel.empty); return; }
    safe(() => SUBSTANCES[item.typeId](p, st(p)));
    return;
  }
  const fn = SUBSTANCES[item.typeId];
  if (fn) safe(() => fn(p, item.typeId === "vice:narcaine" ? undefined : st(p)));
});

// reusable smokers and what they burn
const FUEL = {
  "vice:bong": { item: "vice:weed", empty: "§7Your bong is empty. You need §aweed§7." },
  "vice:pipe": { item: "vice:tobacco_leaf", empty: "§7Your pipe is empty. You need a §6tobacco leaf§7." },
};

// ---------------------------------------------------------------- putting things down
// food items -> their placed block (cocaine, ketamine and weed use the item's own block_placer instead)
const PLACE = {
  "vice:beer": "vice:beer_block", "vice:liquor": "vice:liquor_block", "vice:cigarette": "vice:cigarette_block",
  "vice:cigar": "vice:cigar_block", "vice:joint": "vice:joint_block", "vice:opium": "vice:opium_block",
  "vice:shrooms": "vice:shrooms_block", "vice:bong": "vice:bong_block", "vice:narcaine": "vice:narcaine_block",
  "vice:zynn": "vice:zynn_block", "vice:coffee": "vice:coffee_block", "vice:tea": "vice:tea_block",
  "vice:wine": "vice:wine_block", "vice:pipe": "vice:pipe_block", "vice:morphine": "vice:morphine_block",
};
const BLOCK_ITEM = Object.fromEntries(Object.entries(PLACE).map(([i, b]) => [b, i]));
const FLAT = new Set(["vice:cigarette_block", "vice:cigar_block", "vice:joint_block", "vice:zynn_block", "vice:pipe_block", "vice:morphine_block"]);
const GLASS = new Set(["vice:beer_block", "vice:liquor_block", "vice:bong_block", "vice:wine_block", "vice:coffee_block", "vice:tea_block"]);
// what's left after drinking a placed one
const EMPTY = { "vice:beer": "minecraft:glass_bottle", "vice:liquor": "minecraft:glass_bottle", "vice:wine": "minecraft:glass_bottle",
  "vice:coffee": "minecraft:bowl", "vice:tea": "minecraft:bowl" };
const LINES = { "vice:cocaine_lines": "vice:cocaine", "vice:ketamine_lines": "vice:ketamine" };
const lastPlace = new Map();

function facing(p) {
  const y = ((p.getRotation().y % 360) + 360) % 360;      // 0 = south, 90 = west, 180 = north, 270 = east
  return ["south", "west", "north", "east"][Math.round(y / 90) % 4];
}

function placeFromHand(p, base, itemId) {
  const target = base.above();
  if (!target || !target.isAir || base.isAir || base.isLiquid) return;
  const blockId = PLACE[itemId];
  let perm = BlockPermutation.resolve(blockId);
  if (FLAT.has(blockId)) perm = perm.withState("minecraft:cardinal_direction", facing(p));
  target.setPermutation(perm);
  sound(p, GLASS.has(blockId) ? "dig.glass" : "dig.grass", 0.8, 1.2, center(target));
  takeOne(p, itemId);
}

// sneak + use on the top of a block: put the held item down instead of using it
world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
  const p = ev.player, item = ev.itemStack;
  if (!item || !PLACE[item.typeId] || !p.isSneaking) return;
  ev.cancel = true;
  if (ev.isFirstEvent === false || now() - (lastPlace.get(p.id) ?? -99) < 5) return;
  lastPlace.set(p.id, now());
  const base = ev.block, id = item.typeId, face = String(ev.blockFace);
  system.run(() => {
    if (face !== "Up") { say(p, "§7Put it on §ftop§7 of a block."); return; }
    safe(() => placeFromHand(p, base, id));
  });
});
// no drinking/smoking while sneaking (that's for putting things down), no bong without weed
world.beforeEvents.itemUse.subscribe((ev) => {
  const p = ev.source, id = ev.itemStack?.typeId;
  if (!id?.startsWith("vice:")) return;
  if (!PLACE[id]) return;
  if (p.isSneaking) { ev.cancel = true; return; }
  if (FUEL[id] && !hasItem(p, FUEL[id].item)) {
    ev.cancel = true;
    system.run(() => say(p, FUEL[id].empty));
  }
});

// ---------------------------------------------------------------- placed blocks
function useBlock(p, block) {
  const id = BLOCK_ITEM[block.typeId];
  if (!id) return;
  const at = center(block);
  block.setType("minecraft:air");
  if (EMPTY[id]) {
    sound(p, "random.drink", 1, 1, at);
    if (!creative(p)) dropItems(p.dimension, at, EMPTY[id], 1);
  }
  if (id === "vice:shrooms") particle(p, "minecraft:crop_growth_emitter", at);
  SUBSTANCES[id](p, id === "vice:narcaine" ? undefined : st(p));
}

function reusableInteract(p, block) {
  const id = BLOCK_ITEM[block.typeId], s = st(p);
  if (now() < s.busyUntil) return;
  if (!takeOne(p, FUEL[id].item)) { say(p, FUEL[id].empty); return; }
  s.busyUntil = now() + 30;
  SUBSTANCES[id](p, s, center(block));
}

// crops: what a grown plant gives (and what you plant again). A harvest puts it back to stage 2.
const CROPS = {
  "vice:weed_plant": { product: "vice:weed", n: [2, 3] },
  "vice:tobacco_plant": { product: "vice:tobacco_leaf", n: [2, 4], seed: "vice:tobacco_seeds", seedChance: 0.6 },
  "vice:poppy_plant": { product: "vice:opium", n: [1, 2], seed: "vice:poppy_seeds", seedChance: 0.8 },
  "vice:coffee_plant": { product: "vice:coffee_beans", n: [2, 4] },
  "vice:tea_plant": { product: "vice:tea_leaves", n: [2, 3] },
};
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
function harvest(dim, at, crop) {
  dropItems(dim, at, crop.product, randInt(...crop.n));
  if (crop.seed && Math.random() < crop.seedChance) dropItems(dim, at, crop.seed, 1);
}
function cropInteract(p, block) {
  const crop = CROPS[block.typeId];
  const g = block.permutation.getState("vice:growth") ?? 0;
  if (heldItem(p)?.typeId === "minecraft:bone_meal" && g < 3) {
    takeOne(p, "minecraft:bone_meal");
    block.setPermutation(block.permutation.withState("vice:growth", g + 1));
    particle(p, "minecraft:crop_growth_emitter", center(block));
    sound(p, "item.bone_meal.use", 1, 1, center(block));
    return;
  }
  if (g < 3) { say(p, `§7Not ready yet §8(stage ${g + 1}/4)§7. Bone meal speeds it up.`); return; }
  block.setPermutation(block.permutation.withState("vice:growth", 1));
  harvest(p.dimension, { ...center(block), y: block.location.y + 0.6 }, crop);
  sound(p, "block.sweet_berry_bush.pick", 1, 1, center(block));
}

// lines: holding more of the same powder cuts another line (max 3), anything else snorts one
function linesInteract(p, block) {
  const powder = LINES[block.typeId];
  const n = block.permutation.getState("vice:lines") ?? 1;
  if (heldItem(p)?.typeId === powder && n < 3) {
    takeOne(p, powder);
    block.setPermutation(block.permutation.withState("vice:lines", n + 1));
    sound(p, "dig.sand", 0.6, 1.6, center(block));
    return;
  }
  snort(p, block, powder);
}

function camTo(p, location, rotation, seconds, ease) {
  safe(() => p.camera.setCamera("minecraft:free", {
    location, rotation,
    easeOptions: { easeTime: seconds, easeType: mc.EasingType?.[ease] ?? ease },
  }));
}
function lockMove(p, locked) {
  safe(() => p.inputPermissions.setPermissionCategory(mc.InputPermissionCategory?.Movement ?? 2, !locked));
}

// the snort: the camera leans down over the table, sweeps along a line, then the head snaps back up
function snort(p, block, powder) {
  const s = st(p);
  if (now() < s.busyUntil) return;
  s.busyUntil = now() + 36;              // the whole animation (33 ticks)
  const c = center(block), loc = { ...block.location }, dim = block.dimension, typeId = block.typeId;
  const rot = p.getRotation();
  const yaw = (rot.y * Math.PI) / 180;
  const fx = -Math.sin(yaw), fz = Math.cos(yaw);         // facing
  const rx = -fz, rz = fx;                                 // to the side
  const y = loc.y + 0.38;
  const start = { x: c.x - fx * 0.2 - rx * 0.3, y, z: c.z - fz * 0.2 - rz * 0.3 };
  const end = { x: start.x + rx * 0.6, y, z: start.z + rz * 0.6 };
  const rgb = powder === "vice:ketamine" ? [0.85, 0.75, 1] : [1, 1, 1];

  lockMove(p, true);
  camTo(p, start, { x: 72, y: rot.y }, 0.45, "InOutSine");                     // lean down to the table
  system.runTimeout(() => {
    if (!p.isValid) return;
    camTo(p, end, { x: 72, y: rot.y }, 0.7, "Linear");                          // along the line
    sound(p, "mob.horse.breathe", 1, 1.6, c);
    for (let i = 0; i < 4; i++) {
      system.runTimeout(() => {
        const t = i / 3;
        particle(p, "vice:powder", { x: start.x + rx * 0.6 * t + fx * 0.15, y: loc.y + 0.12, z: start.z + rz * 0.6 * t + fz * 0.15 }, tintVars(...rgb));
      }, i * 4);
    }
  }, 10);
  system.runTimeout(() => {
    if (!p.isValid) return;
    safe(() => {                                                                // that line is gone
      const b = dim.getBlock(loc);
      if (b?.typeId !== typeId) return;
      const left = (b.permutation.getState("vice:lines") ?? 1) - 1;
      if (left > 0) b.setPermutation(b.permutation.withState("vice:lines", left));
      else b.setType("minecraft:air");
    });
    camTo(p, p.getHeadLocation(), { x: rot.x - 15, y: rot.y }, 0.35, "OutBack");  // head snaps back up
    sound(p, "mob.horse.breathe", 0.8, 1.9);
  }, 25);
  system.runTimeout(() => {
    if (!p.isValid) return;
    safe(() => p.camera.clear());
    lockMove(p, false);
    safe(() => SUBSTANCES[powder](p, st(p)));
  }, 33);
}

system.beforeEvents.startup.subscribe(({ blockComponentRegistry: reg }) => {
  const on = (fn) => ({ onPlayerInteract: (e) => { if (e.player) safe(() => fn(e.player, e.block)); } });
  reg.registerCustomComponent("vice:consumable", on(useBlock));
  reg.registerCustomComponent("vice:reusable", on(reusableInteract));
  reg.registerCustomComponent("vice:lines", on(linesInteract));
  reg.registerCustomComponent("vice:crop", {
    ...on(cropInteract),
    onRandomTick: (e) => safe(() => {
      const g = e.block.permutation.getState("vice:growth") ?? 0;
      if (g < 3 && Math.random() < 0.35) e.block.setPermutation(e.block.permutation.withState("vice:growth", g + 1));
    }),
  });
});

// broken lines give the powder back; a grown plant gives its harvest; wild grass now and then hides a seed
const WILD = ["vice:tobacco_seeds", "vice:poppy_seeds", "vice:coffee_beans", "vice:tea_leaves", "vice:weed"];
const GRASS = new Set(["minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern", "minecraft:large_fern"]);
world.afterEvents.playerBreakBlock.subscribe((ev) => {
  const perm = ev.brokenBlockPermutation, id = perm.type.id;
  if (creative(ev.player)) return;
  const at = { x: ev.block.location.x + 0.5, y: ev.block.location.y + 0.3, z: ev.block.location.z + 0.5 };
  if (LINES[id]) dropItems(ev.dimension, at, LINES[id], perm.getState("vice:lines") ?? 1);
  if (CROPS[id] && perm.getState("vice:growth") === 3) harvest(ev.dimension, at, CROPS[id]);
  if (GRASS.has(id) && Math.random() < 0.04) dropItems(ev.dimension, at, WILD[Math.floor(Math.random() * WILD.length)], 1);
});

// ---------------------------------------------------------------- Soldiers: an idle smoke or drink (cosmetic only)
// War Engine soldiers who have nothing to do (standing still, not shooting or aiming, not downed, not on a gun or in a
// vehicle) and no enemy within 20 blocks now and then have a smoke, a drink, a coffee or a pouch. It's only for show:
// a prop (our own `vice:prop` entity, the item's picture) follows his hand, goes up to his mouth for a drag or a sip
// and back down, with smoke, embers and sounds. The soldier himself is never touched: no effects, no pushes, no tags,
// no properties, nothing War Engine reads. The moment he has something else to do, the prop is simply gone.
// Only the `war:soldier` id and his public state (war:firing, war:aiming, war:down, war:held, war:nest, war:pose,
// war:faction) are read, each one optional, so newer War Engine versions work the same.
// `/scriptevent vice:soldiers off` turns it off (`on` to turn it back on).
const SOLDIER = "war:soldier";
const PROP = "vice:prop";
// prop kinds (the order matches the textures in vice_prop's render controller)
const KINDS = ["cigarette", "cigar", "joint", "pipe", "beer", "wine", "liquor", "coffee", "tea", "zynn"];
const HABITS = [              // what a soldier reaches for, and how often
  ["cigarette", 6], ["coffee", 4], ["beer", 3], ["zynn", 3], ["cigar", 2], ["pipe", 1], ["tea", 1], ["wine", 1],
  ["liquor", 1], ["joint", 1],
];
const SMOKES = new Set(["cigarette", "cigar", "joint", "pipe"]);
const BOOZE = new Set(["beer", "wine", "liquor"]);
const MAX_PROPS = 8;
const props = new Map();       // soldier id -> { e, prop, kind, steps, i, t, at }
const restUntil = new Map();   // soldier id -> tick he may have another

function sprop(e, k) { try { return e.getProperty(k); } catch { return undefined; } }   // missing on older/newer versions: fine
function busy(e) {
  if (sprop(e, "war:firing") || sprop(e, "war:aiming") || sprop(e, "war:down") || sprop(e, "war:held") || sprop(e, "war:nest")) return true;
  if ((sprop(e, "war:pose") ?? 0) !== 0) return true;
  try { if (e.getComponent("minecraft:riding")?.entityRidingOn) return true; } catch {}
  return false;
}
function still(e) {
  try { const v = e.getVelocity(); return Math.hypot(v.x, v.z) < 0.03; } catch { return false; }
}
function enemyNear(e) {
  const f = sprop(e, "war:faction");
  let near = [];
  try { near = e.dimension.getEntities({ location: e.location, maxDistance: 20, excludeTypes: [PROP, "minecraft:item", "minecraft:xp_orb"] }); } catch { return true; }
  for (const o of near) {
    if (o.id === e.id) continue;
    if (o.typeId === SOLDIER || o.typeId === "war:hound") {
      const of = sprop(o, "war:faction");
      if (of !== undefined && of !== f) return true;           // another faction (even an ally: better safe)
      continue;
    }
    try { if (o.getComponent("minecraft:type_family")?.hasTypeFamily("monster")) return true; } catch {}
  }
  return false;
}
const free = (e) => !busy(e) && !enemyNear(e);

// where his hand and his mouth are right now
function frame(e) {
  const h = e.getHeadLocation();
  let d = { x: 0, y: 0, z: 1 };
  try { d = e.getViewDirection(); } catch {}
  const len = Math.hypot(d.x, d.z) || 1, fx = d.x / len, fz = d.z / len;
  const rx = -fz, rz = fx;                                     // his right
  const yaw = (Math.atan2(-fx, fz) * 180) / Math.PI;
  return {
    yaw,
    hand: { x: e.location.x + fx * 0.4 + rx * 0.32, y: e.location.y + 0.95, z: e.location.z + fz * 0.4 + rz * 0.32 },
    mouth: { x: h.x + fx * 0.32 + rx * 0.06, y: h.y - 0.22, z: h.z + fz * 0.32 + rz * 0.06 },
  };
}
const lerp = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

// the little play: a list of steps { from, to, ticks, act (bottle tipped), fx (when the step ends) }
function script(kind) {
  const s = [{ from: "hand", to: "hand", ticks: 10 }];
  if (SMOKES.has(kind)) {
    s[0].fx = (r) => { sound(r.e, "fire.ignite", 0.4, 1.3, r.at); particle(r.e, "vice:ember", r.at); };
    const drags = kind === "cigar" || kind === "pipe" ? 4 : 3;
    for (let i = 0; i < drags; i++) {
      s.push({ from: "hand", to: "mouth", ticks: 12 });
      s.push({ from: "mouth", to: "mouth", ticks: 30, fx: (r) => particle(r.e, "vice:ember", r.at) });
      s.push({ from: "mouth", to: "hand", ticks: 12, fx: (r) => puff(r.e) });
      s.push({ from: "hand", to: "hand", ticks: randInt(60, 110), wisp: true });
    }
  } else if (kind === "zynn") {
    s.push({ from: "hand", to: "mouth", ticks: 10 });
    s.push({ from: "mouth", to: "mouth", ticks: 12, fx: (r) => sound(r.e, "random.eat", 0.4, 1.4, r.at) });
    s.push({ from: "mouth", to: "hand", ticks: 10 });
    s.push({ from: "hand", to: "hand", ticks: 20 });
  } else {
    const sips = kind === "liquor" ? 2 : 3;
    for (let i = 0; i < sips; i++) {
      s.push({ from: "hand", to: "mouth", ticks: 12 });
      s.push({ from: "mouth", to: "mouth", ticks: 30, act: 1, start: (r) => sound(r.e, "random.drink", 0.5, rand(0.9, 1.1), r.at) });
      s.push({ from: "mouth", to: "hand", ticks: 12, fx: (r) => { if (BOOZE.has(kind) && Math.random() < 0.4) sound(r.e, "random.burp", 0.4, rand(0.9, 1.2), r.at); } });
      s.push({ from: "hand", to: "hand", ticks: randInt(70, 120), steam: kind === "coffee" || kind === "tea" });
    }
  }
  return s;
}
function puff(e) {
  const m = new MolangVariableMap();
  let d = { x: 0, y: 0, z: 1 };
  try { d = e.getViewDirection(); } catch {}
  m.setSpeedAndDirection("variable.puff", 0.6, d);
  const h = e.getHeadLocation();
  particle(e, "vice:smoke_puff", { x: h.x + d.x * 0.35, y: h.y - 0.2, z: h.z + d.z * 0.35 }, m);
}

function startProp(e) {
  const total = HABITS.reduce((a, [, w]) => a + w, 0);
  let roll = Math.random() * total, kind = HABITS[0][0];
  for (const [k, w] of HABITS) { if ((roll -= w) < 0) { kind = k; break; } }
  const f = frame(e);
  const prop = e.dimension.spawnEntity(PROP, f.hand);
  safe(() => prop.setProperty("vice:kind", KINDS.indexOf(kind)));
  const r = { e, prop, kind, steps: script(kind), i: 0, t: 0, at: f.hand, act: 0 };
  props.set(e.id, r);
}
function endProp(id) {
  const r = props.get(id);
  props.delete(id);
  restUntil.set(id, now() + randInt(60, 180) * SEC);
  if (r) safe(() => r.prop.remove());
}

function propTick(r) {
  const e = r.e;
  if (!e.isValid || !r.prop.isValid) return endProp(e.id);
  if (r.t % 5 === 0 && busy(e)) return endProp(e.id);                      // he's needed: gone at once
  if (r.t % 20 === 0 && enemyNear(e)) return endProp(e.id);
  const step = r.steps[r.i];
  if (r.t === 0 && step.start) safe(() => step.start(r));
  const want = step.act ?? 0;
  if (want !== r.act) { r.act = want; safe(() => r.prop.setProperty("vice:act", want)); }
  const f = frame(e);
  r.at = lerp(f[step.from], f[step.to], ease(Math.min(1, r.t / step.ticks)));
  safe(() => r.prop.teleport(r.at, { rotation: { x: 0, y: f.yaw } }));
  if (step.wisp && r.t % 15 === 0) particle(e, "vice:smoke_wisp", { ...r.at, y: r.at.y + 0.15 });
  if (step.steam && r.t % 20 === 0) particle(e, "vice:smoke_wisp", { ...r.at, y: r.at.y + 0.2 });
  if (++r.t >= step.ticks) {
    if (step.fx) safe(() => step.fx(r));
    r.t = 0;
    if (++r.i >= r.steps.length) endProp(e.id);
  }
}

system.runInterval(() => {
  for (const r of [...props.values()]) safe(() => propTick(r));
}, 1);

// every 2 s: idle soldiers near a player may start one; props nobody owns (e.g. after a reload) are cleared away
let soldierT = 0;
system.runInterval(() => {
  soldierT++;
  const on = world.getDynamicProperty("vice:soldiers") !== "off";
  for (const dimId of ["overworld", "nether", "the_end"]) {
    let dim;
    try { dim = world.getDimension(dimId); } catch { continue; }
    if (!dim) continue;
    if (soldierT % 3 === 0) {
      const mine = new Set([...props.values()].map((r) => r.prop.id));
      try { for (const pr of dim.getEntities({ type: PROP })) if (!mine.has(pr.id)) pr.remove(); } catch {}
    }
    if (!on) continue;
    const seen = new Set();
    for (const p of world.getAllPlayers()) {
      if (p.dimension.id !== dim.id) continue;
      let list = [];
      try { list = dim.getEntities({ type: SOLDIER, location: p.location, maxDistance: 48 }); } catch {}
      for (const e of list) {
        if (seen.has(e.id) || props.has(e.id)) continue;
        seen.add(e.id);
        if (props.size >= MAX_PROPS || now() < (restUntil.get(e.id) ?? 0) || Math.random() > 0.12) continue;
        if (still(e) && free(e)) safe(() => startProp(e));
      }
    }
  }
}, 40);
world.afterEvents.entityDie.subscribe((ev) => { if (props.has(ev.deadEntity.id)) endProp(ev.deadEntity.id); }, { entityTypes: [SOLDIER] });
world.afterEvents.entityRemove?.subscribe?.((ev) => { if (props.has(ev.removedEntityId)) endProp(ev.removedEntityId); });

// ---------------------------------------------------------------- the colour haze
// Screen fades can only be fully opaque, so colours are done with fog (Vice Pack RP/fogs): one fog per colour and
// strength level 1..HAZE_LEVELS, from a faint tint at the horizon to a thick glow. Every 5 ticks the strength eases
// toward the strongest active effect; switching colour first fades the old one out (rainbow hues blend straight on).
const HAZE_LEVELS = 8;
function glow(s, color, amount, seconds) {
  s.glows.push({ color, amount, until: now() + seconds * SEC });
}
function hazeTarget(s, t) {
  const c = [];
  if (now() < s.tripUntil) c.push(s.badTrip ? ["red", 0.9] : [`hue${Math.floor(t / (SEC * 0.75)) % 12}`, 0.85]);
  if (now() < s.kUntil) c.push(["purple", 0.7 + 0.25 * Math.sin(t / 25)]);      // slow pulse
  if (now() < s.opiumUntil) c.push(["orange", 0.55]);
  if (now() < s.stonedUntil) c.push(["green", 0.45]);
  if (now() < s.cokeUntil) c.push(["ice", 0.35]);
  if (s.drunk > 0) c.push(["amber", Math.min(0.7, 0.15 + s.drunk / 12)]);
  s.glows = s.glows.filter((g) => now() < g.until);
  for (const g of s.glows) c.push([g.color, g.amount * Math.min(1, (g.until - now()) / (3 * SEC))]);   // kicks fade out
  let best = ["", 0];
  for (const x of c) if (x[1] > best[1] + 0.05) best = x;
  return best;
}
function fog(p, id) {
  safe(() => p.runCommand("fog @s remove vice_haze"));
  if (id) safe(() => p.runCommand(`fog @s push ${id} vice_haze`));
}
function hazeTick(p, s, t) {
  let [color, amount] = hazeTarget(s, t);
  const blends = color.startsWith("hue") && s.fogColor.startsWith("hue");
  if (s.fogColor && color !== s.fogColor && !blends && s.fogAmount > 0.02) amount = 0;    // fade the old colour out first
  else if (color) s.fogColor = color;
  const step = amount > s.fogAmount ? 0.035 : 0.05;                                     // ~3 s in, ~2 s out
  s.fogAmount += Math.max(-step, Math.min(step, amount - s.fogAmount));
  const level = Math.round(s.fogAmount * HAZE_LEVELS);
  const id = level > 0 ? `vice:haze_${s.fogColor}_${level}` : "";
  if (id !== s.fogId) { s.fogId = id; fog(p, id); }
  if (!level && !amount) s.fogColor = "";
}

// ---------------------------------------------------------------- narcaine: back to sober
const VICE_EFFECTS = ["speed", "slowness", "haste", "mining_fatigue", "strength", "jump_boost", "nausea", "regeneration",
  "resistance", "fire_resistance", "blindness", "night_vision", "hunger", "weakness", "poison", "wither", "slow_falling", "darkness"];
function sober(p, quiet = false) {
  states.delete(p.id);
  for (const e of VICE_EFFECTS) safe(() => p.removeEffect(e));
  fog(p, "");
  safe(() => p.runCommand("camerashake stop @s"));
  safe(() => p.camera.clear());
  lockMove(p, false);
  safe(() => p.onScreenDisplay.setActionBar("§r"));
  if (!quiet) {
    say(p, "§a*psst* §fNarcaine. §7Everything stops. You're sober.");
    sound(p, "random.fizz", 0.6, 1.8);
    particle(p, "vice:powder", mouth(p, 0.25, 0.05), tintVars(0.75, 0.9, 1));
  }
}
// `/scriptevent vice:sober` clears whoever runs it (or `/execute as @a run scriptevent vice:sober` for everyone)
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id === "vice:sober" && ev.sourceEntity?.typeId === "minecraft:player") sober(ev.sourceEntity);
  if (ev.id === "vice:soldiers") {
    const on = ev.message.trim() !== "off";
    world.setDynamicProperty("vice:soldiers", on ? "on" : "off");
    if (!on) for (const id of [...props.keys()]) endProp(id);
    if (ev.sourceEntity?.typeId === "minecraft:player") say(ev.sourceEntity, on ? "§aIdle soldiers have the odd smoke or drink again." : "§7Soldiers no longer smoke or drink.");
  }
});

// ---------------------------------------------------------------- lasting effects (every second)
function bar(level, max = 10, cells = 5) {
  const full = Math.round((level / max) * cells);
  return "▮".repeat(full) + "▯".repeat(cells - full);
}
const secsLeft = (until) => Math.max(0, Math.ceil((until - now()) / SEC));
const everySec = (t, n) => (t / SEC) % n < 1;

function drunkTick(p, s, t) {
  if (s.drunk <= 0) return;
  if (t % (45 * SEC) < SEC) s.drunk = Math.max(0, s.drunk - 1);
  const d = s.drunk;
  if (d >= 1 && Math.random() < 0.06) sound(p, "random.burp", 0.5, rand(1.3, 1.6));   // hiccup
  if (d >= 3) {
    effect(p, "nausea", 6, 0);
    // stumbling: a small sideways shove now and then
    if (p.isOnGround && Math.random() < 0.15 + d * 0.04) {
      const a = rand(0, Math.PI * 2), f = 0.12 + d * 0.035;
      safe(() => p.applyKnockback({ x: Math.cos(a) * f, z: Math.sin(a) * f }, 0));
    }
    if (Math.random() < 0.1) particle(p, "vice:swirl", { ...p.getHeadLocation(), y: p.getHeadLocation().y + 0.5 }, tintVars(1, 0.85, 0.2));
  }
  if (d >= 5) {
    effect(p, "slowness", 3, 0);
    if (Math.random() < 0.08) { tint(p, 0, 0, 0, 0.4, 0.3, 0.6); effect(p, "blindness", 2); }   // eyes droop
  }
  if (d >= 8 && overdose(p, s, "alcohol")) s.drunk = 5;
}

function smokeTick(p, s, t) {
  if (now() >= s.smokeUntil) return;
  // a wisp off the tip most seconds, a drag (exhale) every few seconds
  particle(p, "vice:smoke_wisp", mouth(p, 0.55, 0.2));
  if (everySec(t, s.smokeKind === "cigar" ? 5 : 4)) {
    particle(p, "vice:ember", mouth(p, 0.5, 0.18));
    system.runTimeout(() => { if (p.isValid) exhale(p, s.smokeKind === "cigar" ? 0.9 : 0.6); }, 12);
  }
}

function cokeTick(p, s, t) {
  if (now() < s.cokeUntil) {
    if (Math.random() < 0.25) shake(p, 0.12, 0.5, "positional");        // jitters
    if (Math.random() < 0.2) particle(p, "vice:swirl", p.getHeadLocation(), tintVars(0.6, 0.9, 1));
    if (everySec(t, 6)) sound(p, "mob.warden.heartbeat", 0.5, 1.6);
  } else if (s.cokeCrash) {
    s.cokeCrash = false;
    effect(p, "slowness", 30, 1);
    effect(p, "weakness", 30, 0);
    effect(p, "mining_fatigue", 30, 0);
    effect(p, "hunger", 20, 1);
    glow(s, "grey", 0.6, 20);
    say(p, "§8The rush is gone. You feel awful.");
  }
}

function ketTick(p, s, t) {
  if (now() >= s.kUntil) return;
  particle(p, "vice:swirl", p.getHeadLocation(), tintVars(0.7, 0.35, 1));
  if (everySec(t, 5)) {
    // the world wobbles (the purple haze pulses on its own, see hazeTarget)
    shake(p, 0.2, 2, "rotational");
    sound(p, "mob.endermen.portal", 0.4, rand(0.4, 0.7));
  }
}

function opiumTick(p, s, t) {
  if (now() >= s.opiumUntil) return;
  if (everySec(t, 10)) tint(p, 20, 10, 0, 1.5, 0.2, 1.5);          // eyelids getting heavy
  if (Math.random() < 0.15) particle(p, "vice:swirl", p.getHeadLocation(), tintVars(1, 0.6, 0.2));
}

function stonedTick(p, s, t) {
  if (now() >= s.stonedUntil) return;
  if (everySec(t, 4)) shake(p, 0.06, 4, "rotational");             // slow, floaty sway
  if (Math.random() < 0.3) particle(p, "vice:swirl", p.getHeadLocation(), tintVars(0.4, 1, 0.3));
  if (Math.random() < 0.03) sound(p, "mob.villager.haggle", 0.4, 1.6);   // giggles
}

function tripTick(p, s, t) {
  if (now() >= s.tripUntil) return;
  const h = (t % (8 * SEC)) / (8 * SEC);
  // glowing orbs drifting around in the world, cycling through the rainbow (dark red on a bad trip)
  const base = p.location;
  for (let i = 0; i < (s.badTrip ? 2 : 5); i++) {
    const [r, g, b] = s.badTrip ? [0.5 + Math.random() * 0.3, 0, 0.05] : hue((h + i * 0.2) % 1);
    particle(p, "vice:trip_orb", { x: base.x + rand(-6, 6), y: base.y + rand(0, 3.5), z: base.z + rand(-6, 6) }, tintVars(r, g, b));
  }
  particle(p, "vice:swirl", p.getHeadLocation(), tintVars(...hue(h)));
  if (everySec(t, 6)) {
    shake(p, s.badTrip ? 0.3 : 0.1, 3, "rotational");
  }
  if (Math.random() < 0.35) {
    if (s.badTrip) sound(p, "note.bass", 0.5, rand(0.5, 0.7));
    else sound(p, "note.chime", 0.5, [0.5, 0.63, 0.75, 1, 1.26, 1.5][Math.floor(Math.random() * 6)]);
  }
}

function hud(p, s) {
  const parts = [];
  if (s.drunk > 0) parts.push(`§6Drunk ${bar(s.drunk)}`);
  if (now() < s.smokeUntil) parts.push(`§7Smoking ${secsLeft(s.smokeUntil)}s`);
  if (now() < s.stonedUntil) parts.push(`§aStoned ${secsLeft(s.stonedUntil)}s`);
  if (now() < s.cokeUntil) parts.push(`§bWired ${secsLeft(s.cokeUntil)}s`);
  if (now() < s.kUntil) parts.push(`§dK-hole ${secsLeft(s.kUntil)}s`);
  if (now() < s.opiumUntil) parts.push(`§eSedated ${secsLeft(s.opiumUntil)}s`);
  if (now() < s.tripUntil) parts.push(`${s.badTrip ? "§4Bad trip" : "§dTripping"} ${secsLeft(s.tripUntil)}s`);
  // only for a few seconds when something starts, ends or the drunk level changes; never stuck on screen
  const key = parts.map((x) => x.replace(/ \d+s$/, "")).join("|");
  if (key !== s.hudKey) { s.hudKey = key; s.hudUntil = now() + 4 * SEC; }
  if (now() < s.hudUntil) safe(() => p.onScreenDisplay.setActionBar(parts.length ? parts.join(" §8| ") : "§7Sober."));
}

system.runInterval(() => {
  const t = now();
  for (const p of world.getAllPlayers()) {
    const s = states.get(p.id);
    if (!s || !p.isValid) continue;
    for (const tick of [drunkTick, smokeTick, cokeTick, ketTick, opiumTick, stonedTick, tripTick]) safe(() => tick(p, s, t));
    safe(() => hud(p, s));
  }
}, SEC);
system.runInterval(() => {
  const t = now();
  for (const p of world.getAllPlayers()) {
    const s = states.get(p.id);
    if (s && p.isValid) safe(() => hazeTick(p, s, t));
  }
}, 5);

// a fresh start after death or leaving (and never left stuck in the snort camera)
world.afterEvents.entityDie.subscribe((ev) => {
  const p = ev.deadEntity;
  sober(p, true);
}, { entityTypes: ["minecraft:player"] });
world.afterEvents.playerLeave.subscribe((ev) => states.delete(ev.playerId));
world.afterEvents.playerSpawn.subscribe((ev) => { if (ev.initialSpawn) sober(ev.player, true); });
