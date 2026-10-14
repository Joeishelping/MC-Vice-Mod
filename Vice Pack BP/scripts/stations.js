// Vice Pack furniture and crafting stations (the blocks with the vice:station component).
//
//   Brew Barrel     wheat -> beer, sweet berries -> wine. Load up to 8 of one, wait ~3 min (world time, even unloaded),
//                   then fill glass bottles from it.
//   Still           potatoes -> liquor, sugar cane -> moonshine. Needs fire under it (campfire, fire, lava, magma,
//                   a lit furnace); distills for 90 s while it's heated and loaded. Fill glass bottles.
//   Drying Rack     hang up to 4 tobacco leaves; after ~2 min they're cured tobacco.
//   Lab Table       cook cocaine -> crack, opium -> heroin, redstone (+ sugar) -> meth, quartz (+ sugar) -> ketamine.
//                   30 s; one batch in ten goes wrong (a fire flash, or toxic fumes).
//   Coffee Grinder  coffee beans -> ground coffee.
//   Kettle          on a fire, filled with a water bucket (4 cups): a bowl + ground coffee or tea leaves = coffee / tea.
//   Coffee Machine  a bowl + ground coffee = coffee. No fire, no water.
//   Beer Keg        pour beer in (up to 16), fill bottles from the tap, or drink straight from it.
//   Ashtray         a smoke you finish near one ends up in it (it fills up); use it to empty it.
//   Pool Table      take a shot.
//   Bar Stool       sit on it.
//   Hookah          load it with cured tobacco or weed (8 puffs); anyone can take a puff.
// What's inside a station is kept in a world dynamic property per block ("vice:stn:<dim>:<x>,<y>,<z>").
import * as mc from "@minecraft/server";
import {
  SEC, now, rand, randInt, safe, effect, sound, say, particle, tintVars, takeOne, hasItem, heldItem, inventory,
  dropItems, creative, consume, stubbers, glow, st,
} from "./main.js";

const { world, system, ItemStack } = mc;

// ---------------------------------------------------------------- stored contents
const key = (b) => `vice:stn:${b.dimension.id}:${b.location.x},${b.location.y},${b.location.z}`;
function load(b) {
  try { return JSON.parse(world.getDynamicProperty(key(b)) ?? "{}"); } catch { return {}; }
}
function save(b, data) {
  const k = key(b);
  const empty = !data || !Object.keys(data).length;
  safe(() => world.setDynamicProperty(k, empty ? undefined : JSON.stringify(data)));
  // the list of stations with something going on (for the bubbling / timers loop)
  let list = [];
  try { list = JSON.parse(world.getDynamicProperty("vice:stations") ?? "[]"); } catch {}
  const has = list.includes(k);
  if (empty && has) list = list.filter((x) => x !== k);
  else if (!empty && !has) list.push(k);
  safe(() => world.setDynamicProperty("vice:stations", JSON.stringify(list)));
}
const absTime = () => { try { return world.getAbsoluteTime(); } catch { return now(); } };
const top = (b) => ({ x: b.location.x + 0.5, y: b.location.y + 1.05, z: b.location.z + 0.5 });
const mid = (b) => ({ x: b.location.x + 0.5, y: b.location.y + 0.6, z: b.location.z + 0.5 });
function setState(b, k, v) { safe(() => b.setPermutation(b.permutation.withState(k, v))); }
function getState(b, k) { try { return b.permutation.getState(k); } catch { return undefined; } }
const nameOf = (id) => id.replace(/^(vice|minecraft):/, "").split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
function give(p, typeId, n = 1) {
  const left = safe2(() => inventory(p)?.addItem(new ItemStack(typeId, n)));
  if (left) dropItems(p.dimension, p.location, typeId, left.amount ?? n);
}
function safe2(fn) { try { return fn(); } catch { return undefined; } }
function bar(msg, p) { safe(() => p.onScreenDisplay.setActionBar(msg)); }
const pct = (x) => `${Math.min(99, Math.floor(x * 100))}%`;

const HEAT = new Set(["minecraft:campfire", "minecraft:soul_campfire", "minecraft:fire", "minecraft:soul_fire", "minecraft:lava",
  "minecraft:magma", "minecraft:lit_furnace", "minecraft:lit_smoker", "minecraft:lit_blast_furnace"]);
function heated(b) {
  const below = safe2(() => b.below());
  if (!below || !HEAT.has(below.typeId)) return false;
  return getState(below, "extinguished") !== true;
}

// ---------------------------------------------------------------- brew barrel
const FERMENT = 3600;                                  // world ticks (3 minutes)
const BREWS = { "minecraft:wheat": "vice:beer", "minecraft:sweet_berries": "vice:wine" };
function barrel(p, b) {
  const d = load(b), held = heldItem(p)?.typeId;
  if (d.out && absTime() - d.start >= FERMENT) { d.ready = true; setState(b, "vice:stage", 2); }
  if (d.ready) {
    if (held !== "minecraft:glass_bottle") return bar(`§6${nameOf(d.out)} is ready (${d.n} left). §7Hold a glass bottle to fill one.`, p);
    takeOne(p, "minecraft:glass_bottle");
    give(p, d.out);
    sound(p, "vice.pour", 1, 1, mid(b));
    if (--d.n <= 0) { save(b, {}); setState(b, "vice:stage", 0); bar("§7The barrel is empty.", p); }
    else { save(b, d); bar(`§6${d.n} ${nameOf(d.out)} left in the barrel.`, p); }
    return;
  }
  const out = BREWS[held];
  if (out && (!d.out || d.out === out) && (d.n ?? 0) < 8) {
    takeOne(p, held);
    d.out = out; d.n = (d.n ?? 0) + 1; d.start = absTime();
    save(b, d); setState(b, "vice:stage", 1);
    sound(p, "vice.pour", 0.6, 0.8, mid(b));
    return bar(`§6Brewing ${nameOf(out)} (${d.n}/8). §7Ready in about 3 minutes.`, p);
  }
  if (d.out) return bar(`§6Brewing ${nameOf(d.out)}: ${pct((absTime() - d.start) / FERMENT)} §7(${d.n} bottles)`, p);
  bar("§7Brew Barrel: add §fwheat§7 (beer) or §fsweet berries§7 (wine), up to 8.", p);
}

// ---------------------------------------------------------------- still
const DISTILL = 1800;                                  // ticks of heat (90 s)
const MASH = { "minecraft:potato": "vice:liquor", "minecraft:sugar_cane": "vice:moonshine" };
function still(p, b) {
  const d = load(b), held = heldItem(p)?.typeId;
  if (d.ready) {
    if (held !== "minecraft:glass_bottle") return bar(`§6${nameOf(d.out)} is ready (${d.n} left). §7Hold a glass bottle.`, p);
    takeOne(p, "minecraft:glass_bottle");
    give(p, d.out);
    sound(p, "vice.pour", 1, 1.2, mid(b));
    if (--d.n <= 0) { save(b, {}); setState(b, "vice:stage", 0); } else save(b, d);
    return;
  }
  const out = MASH[held];
  if (out && (!d.out || d.out === out) && (d.n ?? 0) < 8) {
    takeOne(p, held);
    d.out = out; d.n = (d.n ?? 0) + 1; d.heat ??= 0;
    save(b, d); setState(b, "vice:stage", 1);
    sound(p, "vice.pour", 0.5, 0.7, mid(b));
    return bar(heated(b) ? `§6Distilling ${nameOf(out)} (${d.n}/8).` : `§6Mash in (${d.n}/8). §cIt needs a fire under it.`, p);
  }
  if (d.out) return bar(`§6Distilling ${nameOf(d.out)}: ${pct(d.heat / DISTILL)}${heated(b) ? "" : " §c(no fire under it)"}`, p);
  bar("§7Still: add §fpotatoes§7 (liquor) or §fsugar cane§7 (moonshine), with a fire underneath.", p);
}

// ---------------------------------------------------------------- drying rack
const DRY = 2400;                                      // world ticks (2 minutes)
function rack(p, b) {
  const d = load(b), held = heldItem(p)?.typeId;
  const n = getState(b, "vice:leaves") ?? 0;
  if (n && !getState(b, "vice:dried") && absTime() - d.start >= DRY) setState(b, "vice:dried", true);
  if (getState(b, "vice:dried")) {
    give(p, "vice:cured_tobacco", n);
    sound(p, "dig.grass", 1, 1.3, mid(b));
    setState(b, "vice:dried", false); setState(b, "vice:leaves", 0); save(b, {});
    return bar(`§6You take down ${n} cured tobacco.`, p);
  }
  if (held === "vice:tobacco_leaf") {
    if (n >= 4) return bar("§7The rack is full.", p);
    takeOne(p, "vice:tobacco_leaf");
    setState(b, "vice:leaves", n + 1);
    save(b, { start: absTime() });
    sound(p, "dig.grass", 1, 1, mid(b));
    return bar(`§6Hung a leaf (${n + 1}/4). §7Cured in about 2 minutes.`, p);
  }
  bar(n ? `§6Drying: ${pct((absTime() - d.start) / DRY)}` : "§7Drying Rack: hang up to 4 §ftobacco leaves§7.", p);
}

// ---------------------------------------------------------------- lab table
const COOK = 600;                                      // world ticks (30 s)
const LAB = {
  "vice:cocaine": { out: "vice:crack", n: 2 },
  "vice:opium": { out: "vice:heroin", n: 1 },
  "minecraft:redstone": { out: "vice:meth", n: 2, plus: "minecraft:sugar" },
  "minecraft:quartz": { out: "vice:ketamine", n: 2, plus: "minecraft:sugar" },
};
function lab(p, b) {
  const d = load(b), held = heldItem(p)?.typeId;
  if (d.out) {
    if (absTime() - d.start >= COOK) return finishLab(b, d);
    return bar(`§5Cooking ${nameOf(d.out)}: ${pct((absTime() - d.start) / COOK)}. §7Stand back.`, p);
  }
  const r = LAB[held];
  if (!r) return bar("§7Lab Table: cook §fcocaine§7 (crack), §fopium§7 (heroin), §fredstone§7 + sugar (meth), §fquartz§7 + sugar (ketamine).", p);
  if (r.plus && !hasItem(p, r.plus)) return bar(`§7You also need ${nameOf(r.plus).toLowerCase()}.`, p);
  takeOne(p, held);
  if (r.plus) takeOne(p, r.plus);
  save(b, { out: r.out, n: r.n, start: absTime() });
  setState(b, "vice:busy", true);
  sound(p, "random.fizz", 0.7, 0.8, top(b));
  bar(`§5Cooking ${nameOf(r.out)}... §7(30 s)`, p);
}
function finishLab(b, d) {
  save(b, {});
  setState(b, "vice:busy", false);
  const at = top(b), dim = b.dimension;
  if (Math.random() < 0.1) {                           // the batch goes wrong
    if (Math.random() < 0.5) {
      safe(() => dim.createExplosion(at, 1.5, { breaksBlocks: false, causesFire: true }));
    } else {
      safe(() => dim.spawnParticle("vice:smoke_puff", at));
      for (const p of safe2(() => dim.getPlayers({ location: at, maxDistance: 5 })) ?? []) {
        effect(p, "poison", 8, 1); effect(p, "nausea", 15, 0);
        say(p, "§2Toxic fumes! §7The batch is ruined.");
      }
    }
    return;
  }
  dropItems(dim, at, d.out, d.n);
  safe(() => dim.playSound("random.fizz", at, { volume: 0.8, pitch: 1.4 }));
  for (const p of safe2(() => dim.getPlayers({ location: at, maxDistance: 8 })) ?? []) bar(`§5The ${nameOf(d.out).toLowerCase()} is done.`, p);
}

// ---------------------------------------------------------------- coffee
function grinder(p, b) {
  if (heldItem(p)?.typeId !== "vice:coffee_beans") return bar("§7Coffee Grinder: hold §fcoffee beans§7.", p);
  takeOne(p, "vice:coffee_beans");
  sound(p, "vice.grind", 1, rand(0.95, 1.05), mid(b));
  for (let i = 0; i < 3; i++) system.runTimeout(() => particle(p, "vice:powder", top(b), tintVars(0.3, 0.17, 0.07)), i * 6);
  system.runTimeout(() => { if (p.isValid) give(p, "vice:ground_coffee"); }, 24);
}
function kettle(p, b) {
  const d = load(b), held = heldItem(p)?.typeId;
  if (held === "minecraft:water_bucket") {
    if (!creative(p)) safe(() => { const inv = inventory(p); inv.setItem(p.selectedSlotIndex, new ItemStack("minecraft:bucket", 1)); });
    save(b, { water: 4 });
    sound(p, "bucket.empty_water", 0.8, 1.2, mid(b));
    return bar("§bKettle filled (4 cups).", p);
  }
  if (held !== "minecraft:bowl") return bar(`§7Kettle: fill it with a §fwater bucket§7 (${d.water ?? 0}/4 left), then use a §fbowl§7 with ground coffee or tea leaves.`, p);
  if (!(d.water > 0)) return bar("§7The kettle is empty. Fill it with a water bucket.", p);
  if (!heated(b)) return bar("§cThe kettle needs a fire under it.", p);
  const brew = hasItem(p, "vice:ground_coffee") ? ["vice:ground_coffee", "vice:coffee"] : hasItem(p, "vice:tea_leaves") ? ["vice:tea_leaves", "vice:tea"] : undefined;
  if (!brew) return bar("§7You need ground coffee or tea leaves.", p);
  takeOne(p, "minecraft:bowl"); takeOne(p, brew[0]);
  d.water--; save(b, d.water > 0 ? d : {});
  sound(p, "vice.whistle", 0.8, 1, mid(b));
  for (let i = 0; i < 4; i++) system.runTimeout(() => particle(p, "vice:smoke_wisp", top(b)), i * 8);
  system.runTimeout(() => { if (p.isValid) { give(p, brew[1]); sound(p, "vice.pour", 0.8, 1.1, mid(b)); } }, 36);
}
function coffeeMachine(p, b) {
  if (heldItem(p)?.typeId !== "minecraft:bowl" || !hasItem(p, "vice:ground_coffee")) return bar("§7Coffee Machine: hold a §fbowl§7, with ground coffee on you.", p);
  takeOne(p, "minecraft:bowl"); takeOne(p, "vice:ground_coffee");
  sound(p, "vice.pour", 0.8, 0.8, mid(b));
  system.runTimeout(() => sound(p, "random.fizz", 0.3, 1.6, mid(b)), 20);
  for (let i = 0; i < 4; i++) system.runTimeout(() => particle(p, "vice:smoke_wisp", top(b)), i * 10);
  system.runTimeout(() => { if (p.isValid) give(p, "vice:coffee"); }, 50);
}

// ---------------------------------------------------------------- bar
function keg(p, b) {
  const d = load(b), held = heldItem(p)?.typeId, n = d.n ?? 0;
  if (held === "vice:beer") {
    if (n >= 16) return bar("§7The keg is full.", p);
    takeOne(p, "vice:beer");
    give(p, "minecraft:glass_bottle");
    save(b, { n: n + 1 });
    sound(p, "vice.pour", 0.8, 0.9, mid(b));
    return bar(`§6Keg: ${n + 1}/16 beers.`, p);
  }
  if (!n) return bar("§7The keg is empty. Pour beer in.", p);
  save(b, n - 1 ? { n: n - 1 } : {});
  sound(p, "vice.pour", 1, 1, mid(b));
  if (held === "minecraft:glass_bottle") { takeOne(p, held); give(p, "vice:beer"); return bar(`§6You fill a bottle. ${n - 1} left.`, p); }
  consume(p, "vice:beer");                             // straight from the tap
  bar(`§6Straight from the tap. ${n - 1} left.`, p);
}
function ashtray(p, b) {
  if (!(getState(b, "vice:butts") > 0)) return bar("§7A clean ashtray.", p);
  setState(b, "vice:butts", 0);
  sound(p, "dig.sand", 1, 1.2, mid(b));
  bar("§7You empty the ashtray.", p);
}
// a smoke that ends near an ashtray goes in it (registered once main.js has loaded)
system.run(() => stubbers.push((p) => {
  const l = p.location;
  for (let dx = -4; dx <= 4; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -4; dz <= 4; dz++) {
    const b = safe2(() => p.dimension.getBlock({ x: Math.floor(l.x) + dx, y: Math.floor(l.y) + dy, z: Math.floor(l.z) + dz }));
    if (b?.typeId !== "vice:ashtray") continue;
    const n = getState(b, "vice:butts") ?? 0;
    if (n >= 3) { say(p, "§8The ashtray is overflowing. You stub it out on the edge."); return true; }
    setState(b, "vice:butts", n + 1);
    sound(p, "random.fizz", 0.3, 1.8, mid(b));
    say(p, "§8You stub it out in the ashtray.");
    return true;
  }
  return false;
}));
function pool(p, b) {
  sound(p, "vice.clack", 1, rand(0.9, 1.1), top(b));
  const drunk = st(p).drunk;
  const lines = drunk >= 4 ? ["§7You miss the cue ball entirely.", "§7You hit the wrong ball. Twice.", "§7Was that... your ball?"]
    : ["§aNice shot!", "§7Scratch.", "§aEight ball, corner pocket.", "§7Clean miss.", "§aTwo in one!"];
  bar(lines[Math.floor(Math.random() * lines.length)], p);
}
const seats = new Map();                               // seat entity id -> stool block location
function stool(p, b) {
  try { if (p.getComponent("minecraft:riding")?.entityRidingOn) return; } catch {}
  const seat = safe2(() => b.dimension.spawnEntity("vice:seat", { x: b.location.x + 0.5, y: b.location.y + 0.55, z: b.location.z + 0.5 }));
  if (!seat) return;
  seats.set(seat.id, { ...b.location, dim: b.dimension.id });
  safe(() => seat.getComponent("minecraft:rideable").addRider(p));
}
function hookah(p, b) {
  const d = load(b), held = heldItem(p)?.typeId;
  const fuel = held === "vice:cured_tobacco" || held === "vice:tobacco_leaf" ? "tobacco" : held === "vice:weed" ? "weed" : undefined;
  if (fuel && !(d.puffs > 0)) {
    takeOne(p, held);
    save(b, { puffs: 8, kind: fuel });
    setState(b, "vice:loaded", true);
    sound(p, "vice.lighter", 0.8, 1, top(b));
    return bar(`§6Hookah loaded with ${fuel === "weed" ? "weed" : "shisha"} (8 puffs). §7Anyone can take a puff.`, p);
  }
  if (!(d.puffs > 0)) return bar("§7Hookah: load it with §fcured tobacco§7 or §fweed§7.", p);
  const s = st(p);
  if (now() < s.busyUntil) return;
  s.busyUntil = now() + 30;
  d.puffs--;
  if (d.puffs > 0) save(b, d); else { save(b, {}); setState(b, "vice:loaded", false); }
  if (d.kind === "weed") s.lastHit = now();
  consume(p, "vice:hookah", top(b), d.kind);
  if (!d.puffs) bar("§7The bowl is spent.", p);
}

const HANDLERS = {
  "vice:brew_barrel": barrel, "vice:still": still, "vice:drying_rack": rack, "vice:lab_table": lab,
  "vice:coffee_grinder": grinder, "vice:kettle": kettle, "vice:coffee_machine": coffeeMachine, "vice:beer_keg": keg,
  "vice:ashtray": ashtray, "vice:pool_table": pool, "vice:bar_stool": stool, "vice:hookah": hookah,
};
const busyUse = new Map();
system.beforeEvents.startup.subscribe(({ blockComponentRegistry: reg }) => {
  reg.registerCustomComponent("vice:station", {
    onPlayerInteract: (e) => {
      const p = e.player, b = e.block;
      if (!p || now() - (busyUse.get(p.id) ?? -99) < 4) return;
      busyUse.set(p.id, now());
      safe(() => HANDLERS[b.typeId]?.(p, b));
    },
  });
});

// a broken station gives back what was in it
world.afterEvents.playerBreakBlock.subscribe((ev) => {
  const id = ev.brokenBlockPermutation.type.id;
  if (!HANDLERS[id]) return;
  const k = `vice:stn:${ev.dimension.id}:${ev.block.location.x},${ev.block.location.y},${ev.block.location.z}`;
  let d = {};
  try { d = JSON.parse(world.getDynamicProperty(k) ?? "{}"); } catch {}
  const at = { x: ev.block.location.x + 0.5, y: ev.block.location.y + 0.5, z: ev.block.location.z + 0.5 };
  if (d.ready && d.out) dropItems(ev.dimension, at, d.out, d.n);
  else if (d.out && (id === "vice:brew_barrel" || id === "vice:still")) {
    const back = Object.entries(id === "vice:brew_barrel" ? BREWS : MASH).find(([, o]) => o === d.out)?.[0];
    if (back) dropItems(ev.dimension, at, back, d.n);
  }
  if (id === "vice:beer_keg" && d.n) dropItems(ev.dimension, at, "vice:beer", d.n);
  const leaves = ev.brokenBlockPermutation.getState?.("vice:leaves");
  if (id === "vice:drying_rack" && leaves) dropItems(ev.dimension, at, ev.brokenBlockPermutation.getState("vice:dried") ? "vice:cured_tobacco" : "vice:tobacco_leaf", leaves);
  if (Object.keys(d).length) {
    safe(() => world.setDynamicProperty(k, undefined));
    let list = [];
    try { list = JSON.parse(world.getDynamicProperty("vice:stations") ?? "[]"); } catch {}
    safe(() => world.setDynamicProperty("vice:stations", JSON.stringify(list.filter((x) => x !== k))));
  }
});

// ---------------------------------------------------------------- every 2 s: timers, bubbling, seats
system.runInterval(() => {
  let list = [];
  try { list = JSON.parse(world.getDynamicProperty("vice:stations") ?? "[]"); } catch {}
  for (const k of list) {
    const m = /^vice:stn:(.+):(-?\d+),(-?\d+),(-?\d+)$/.exec(k);
    if (!m) continue;
    const dim = safe2(() => world.getDimension(m[1]));
    const b = safe2(() => dim?.getBlock({ x: +m[2], y: +m[3], z: +m[4] }));
    if (!b) continue;                                  // not loaded: barrels and racks still age by world time
    if (!HANDLERS[b.typeId]) { safe(() => world.setDynamicProperty(k, undefined)); continue; }
    let d = {};
    try { d = JSON.parse(world.getDynamicProperty(k) ?? "{}"); } catch {}
    const at = top(b);
    switch (b.typeId) {
      case "vice:brew_barrel":
        if (d.out && !d.ready) {
          if (absTime() - d.start >= FERMENT) { d.ready = true; save(b, d); setState(b, "vice:stage", 2); safe(() => dim.playSound("random.pop", at, { volume: 0.6, pitch: 0.8 })); }
          else if (Math.random() < 0.5) safe(() => dim.playSound("vice.bubble", at, { volume: 0.25, pitch: 0.6 }));
        }
        break;
      case "vice:still":
        if (d.out && !d.ready && heated(b)) {
          d.heat = (d.heat ?? 0) + 40;
          safe(() => dim.spawnParticle("vice:smoke_wisp", { x: at.x + 0.4, y: at.y - 0.2, z: at.z }));
          if (d.heat >= DISTILL) { d.ready = true; setState(b, "vice:stage", 2); safe(() => dim.playSound("random.pop", at, { volume: 0.6, pitch: 1.2 })); }
          save(b, d);
        }
        break;
      case "vice:drying_rack":
        if ((getState(b, "vice:leaves") ?? 0) && !getState(b, "vice:dried") && absTime() - d.start >= DRY) setState(b, "vice:dried", true);
        break;
      case "vice:lab_table":
        if (d.out) {
          safe(() => dim.spawnParticle("vice:smoke_wisp", at));
          if (absTime() - d.start >= COOK) finishLab(b, d);
        }
        break;
      case "vice:hookah":
        if (d.puffs > 0 && Math.random() < 0.5) safe(() => dim.spawnParticle("vice:smoke_wisp", at));
        break;
    }
  }
  // empty seats go away
  for (const [id, loc] of seats) {
    const seat = world.getEntity(id);
    const riders = safe2(() => seat?.getComponent("minecraft:rideable")?.getRiders()) ?? [];
    if (!seat || !riders.length) { safe(() => seat?.remove()); seats.delete(id); }
  }
}, 40);
// stray seats (after a reload) are cleared
system.runInterval(() => {
  for (const dimId of ["overworld", "nether", "the_end"]) {
    const dim = safe2(() => world.getDimension(dimId));
    for (const e of safe2(() => dim?.getEntities({ type: "vice:seat" })) ?? []) if (!seats.has(e.id)) safe(() => e.remove());
  }
}, 200);
