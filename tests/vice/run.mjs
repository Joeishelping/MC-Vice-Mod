// Headless check of Vice Pack's script against the mock API: every item, placing, the snort, the bong, the plant,
// overdoses. Fails on any thrown error, unknown id or missing effect.
import fs from "node:fs";
import { fire, advance, player, LOG, inv, block, ItemStack, BlockPermutation } from "@minecraft/server";
// main.js has to sit next to node_modules to find the mock
fs.copyFileSync(new URL("../../Vice Pack BP/scripts/main.js", import.meta.url), new URL("./main.copy.js", import.meta.url));
await import("./main.copy.js");

const comps = {};
fire("startup", { blockComponentRegistry: { registerCustomComponent: (n, c) => { comps[n] = c; } } });
const use = (id) => fire("use", { source: player, itemStack: { typeId: "vice:" + id } });
const count = (k, v) => LOG.filter((l) => l[0] === k && (v === undefined || l[1] === v)).length;
const msgs = () => LOG.filter((l) => l[0] === "msg").map((l) => l[1]);
const checks = [];
const check = (name, ok) => checks.push([name, !!ok]);
const hold = (id, n = 1) => { inv[0] = new ItemStack(id, n); };
const interact = (comp, b) => comps[comp].onPlayerInteract({ player, block: b, dimension: b.dimension });

// the haze eases in a level at a time, the HUD only shows when something changes
use("beer");
advance(20 * 3);
const fogs = () => LOG.filter((l) => l[0] === "cmd" && l[1].startsWith("fog @s push")).map((l) => +l[1].match(/_(\d+) /)[1]);
check("haze ramps up gradually", fogs().length >= 3 && fogs().every((lv, i) => lv === i + 1));
advance(20 * 5);
const bars0 = count("bar");
advance(20 * 20);
check("HUD not stuck on screen", count("bar") === bars0);
// narcaine clears it all
use("narcaine");
advance(5);
check("narcaine: effects removed, haze gone, sober", count("uneffect") > 10 && LOG.some((l) => l[1] === "fog @s remove vice_haze") && msgs().at(-1).includes("sober"));
const cmds0 = count("cmd"), bars1 = count("bar");
advance(20 * 30);
check("narcaine: nothing left running", count("cmd") === cmds0 && count("bar") === bars1);
fire("scriptevent", { id: "vice:sober", sourceEntity: player });
check("/scriptevent vice:sober", msgs().at(-1).includes("sober"));

// held use of everything
for (const i of ["beer", "liquor", "cigarette", "cigar", "joint", "opium", "shrooms"]) { use(i); advance(40); }
advance(20 * 100);
check("drunk, smoke, stoned, trip visuals", ["vice:smoke_puff", "vice:smoke_wisp", "vice:ember", "vice:swirl", "vice:trip_orb"].every((p) => count("particle", p) > 0) && count("knock") > 0);

// sneak-place a beer on the floor, then drink it from the floor
hold("vice:beer", 2);
player.isSneaking = true;
const pi = fire("interact", { player, itemStack: inv[0], block: block({ x: 3, y: 63, z: 3 }), blockFace: "Up", isFirstEvent: true });
const iu = fire("itemUse", { source: player, itemStack: inv[0] });
advance(2);
player.isSneaking = false;
check("sneak place cancels use", pi.cancel && iu.cancel);
check("beer placed, one taken", block({ x: 3, y: 64, z: 3 }).typeId === "vice:beer_block" && inv[0].amount === 1);
interact("vice:consumable", block({ x: 3, y: 64, z: 3 }));
check("drank placed beer", block({ x: 3, y: 64, z: 3 }).isAir && LOG.some((l) => l[0] === "drop" && l[1] === "minecraft:glass_bottle"));
// flat placement keeps a facing
advance(10);
hold("vice:joint");
player.isSneaking = true; fire("interact", { player, itemStack: inv[0], block: block({ x: 4, y: 63, z: 3 }), blockFace: "Up", isFirstEvent: true }); advance(2); player.isSneaking = false;
check("joint placed facing", block({ x: 4, y: 64, z: 3 }).permutation.getState("minecraft:cardinal_direction") && inv[0] === undefined);

// ketamine lines: 1 line placed by the item's block_placer, cut a second, snort both
const lb = block({ x: 5, y: 64, z: 5 });
lb.setPermutation(BlockPermutation.resolve("vice:ketamine_lines"));
hold("vice:ketamine", 1);
interact("vice:lines", lb);
check("cut a second line", lb.permutation.getState("vice:lines") === 2 && inv[0] === undefined);
const mark = LOG.length;
interact("vice:lines", lb); advance(40);
const since = LOG.slice(mark);
check("snort camera ran and cleared", since.filter((l) => l[0] === "camera" && l[1] === "InOutSine").length === 1
  && since.filter((l) => l[0] === "camera" && l[1] === "clear").length === 1 && since.filter((l) => l[0] === "input").map((l) => l[2]).join() === "false,true");
check("one line left, k-hole", lb.permutation.getState("vice:lines") === 1 && msgs().some((m) => m.includes("drifts away")));
interact("vice:lines", lb); advance(40);
check("last line gone", lb.isAir);

// bong: none without weed, then a hit with weed
const bb = block({ x: 6, y: 64, z: 6 });
bb.setPermutation(BlockPermutation.resolve("vice:bong_block"));
inv.fill(undefined);
interact("vice:reusable", bb);
check("bong needs weed", msgs().at(-1).includes("need"));
const noWeed = fire("itemUse", { source: player, itemStack: { typeId: "vice:bong" } });
check("held bong blocked without weed", noWeed.cancel);
inv[5] = new ItemStack("vice:weed", 2);
interact("vice:reusable", bb); advance(40);
check("bong hit used one weed", inv[5].amount === 1 && msgs().some((m) => m.includes("chill") || m.includes("Whoa")));
use("bong"); advance(40);
check("held bong used the last weed", inv[5] === undefined);

// weed plant: random ticks grow it, bone meal, harvest
const wb = block({ x: 7, y: 64, z: 7 });
wb.setPermutation(BlockPermutation.resolve("vice:weed_plant"));
hold("minecraft:bone_meal", 1);
interact("vice:crop", wb);
check("bone meal grows", wb.permutation.getState("vice:growth") === 1);
for (let i = 0; i < 40; i++) comps["vice:crop"].onRandomTick({ block: wb });
check("grows to 3", wb.permutation.getState("vice:growth") === 3);
interact("vice:crop", wb);
check("harvest drops weed, back to 1", wb.permutation.getState("vice:growth") === 1 && LOG.some((l) => l[0] === "drop" && l[1] === "vice:weed"));

// breaking lines gives powder back
fire("break", { player, block: block({ x: 9, y: 64, z: 9 }), dimension: lb.dimension, brokenBlockPermutation: BlockPermutation.resolve("vice:cocaine_lines", { "vice:lines": 3 }) });
check("broken lines drop 3", LOG.some((l) => l[0] === "drop" && l[1] === "vice:cocaine" && l[2] === 3));

// overdoses (cocaine snorted from lines) -- after the ketamine out-of-body trip is over
advance(20 * 10);
const cb = block({ x: 8, y: 64, z: 8 });
cb.setPermutation(BlockPermutation.resolve("vice:cocaine_lines", { "vice:lines": 3 }));
inv.fill(undefined);
for (let i = 0; i < 3; i++) { interact("vice:lines", cb); advance(50); }
use("liquor"); use("liquor"); use("liquor"); advance(40);
for (let i = 0; i < 3; i++) use("shrooms");
advance(20 * 120);
check("cocaine overdose", msgs().some((m) => m.includes("cocaine overdose")));
fire("scriptevent", { id: "vice:sober", sourceEntity: player }); advance(5);
for (let i = 0; i < 4; i++) use("liquor");
advance(40);
check("alcohol poisoning", msgs().some((m) => m.includes("alcohol poisoning")));
check("crash", msgs().some((m) => m.includes("rush is gone")));
check("bad trip", msgs().some((m) => m.includes("Bad trip")));
// new things: zynn, coffee, tea, wine, morphine, the pipe (burns a tobacco leaf)
inv.fill(undefined);
for (const i of ["zynn", "coffee", "tea", "wine", "morphine"]) { use(i); advance(20); }
const noLeaf = fire("itemUse", { source: player, itemStack: { typeId: "vice:pipe" } });
check("pipe needs tobacco", noLeaf.cancel);
inv[3] = new ItemStack("vice:tobacco_leaf", 1);
use("pipe"); advance(20);
check("pipe burned the leaf", inv[3] === undefined && msgs().some((m) => m.includes("good pipe")));

// every crop grows and harvests
for (const [crop, product] of [["tobacco", "vice:tobacco_leaf"], ["poppy", "vice:opium"], ["coffee", "vice:coffee_beans"], ["tea", "vice:tea_leaves"]]) {
  const cb = block({ x: 12, y: 64, z: 12 });
  cb.setPermutation(BlockPermutation.resolve(`vice:${crop}_plant`, { "vice:growth": 3 }));
  interact("vice:crop", cb);
  check(`${crop} harvest`, LOG.some((l) => l[0] === "drop" && l[1] === product) && cb.permutation.getState("vice:growth") === 1);
}

// ---------------------------------------------------------------- v1.5
const sober = () => { fire("scriptevent", { id: "vice:sober", sourceEntity: player }); advance(5); };
// every single thing you can use actually does something (coffee used to do nothing at all)
const effectsOf = (id) => { sober(); const m = LOG.length; use(id); advance(3); return LOG.slice(m).filter((l) => l[0] === "effect").map((l) => l[1]); };
for (const id of ["beer", "liquor", "wine", "cigarette", "cigar", "joint", "opium", "morphine", "heroin", "shrooms", "zynn",
  "coffee", "tea", "white_monster", "crack", "meth", "cocaine", "ketamine"]) {
  check(`${id} has effects`, effectsOf(id).length >= (id === "beer" || id === "cigarette" ? 1 : 2));
}
check("coffee: speed + haste", ["speed", "haste"].every((e) => effectsOf("coffee").includes(e)));
check("tea: regeneration + absorption", ["regeneration", "absorption"].every((e) => effectsOf("tea").includes(e)));
// caffeine crash comes later
sober(); use("coffee"); advance(20 * 155);
check("caffeine crash", msgs().some((m) => m.includes("Caffeine crash")));
// meth: paranoia (sounds + shadow figures), then the comedown
sober(); use("meth");
let m0 = LOG.length; advance(20 * 60);
check("meth paranoia: shadow figures", LOG.slice(m0).some((l) => l[0] === "particle" && l[1] === "vice:shadow"));
advance(20 * 125);
check("meth comedown", msgs().some((m) => m.includes("comedown")));
// crack: a rush, then the crash; two in a row is an overdose
sober(); use("crack"); advance(20 * 27);
check("crack crash", msgs().some((m) => m.includes("hits like a truck")));
use("crack"); advance(5);
check("second crack hit: overdose", msgs().some((m) => m.includes("crack overdose")));
// heroin: nodding off (the camera drops), and an overdose that kills unless Narcaine comes
sober(); use("heroin"); m0 = LOG.length; advance(20 * 20);
check("heroin: nodding off", LOG.slice(m0).filter((l) => l[0] === "camera" && l[1] === "InOutSine").length >= 1);
sober(); use("heroin"); advance(20); use("heroin"); advance(20);
check("heroin overdose starts", msgs().some((m) => m.includes("breathing slows")));
m0 = LOG.length; advance(20 * 32);
check("unanswered opioid overdose is deadly", LOG.slice(m0).some((l) => l[0] === "effect" && l[1] === "wither" && l[3] === 2) && msgs().some((m) => m.includes("breathing stops")));
sober(); use("heroin"); advance(20); use("heroin"); advance(20 * 5);
inv.fill(undefined); use("narcaine"); m0 = LOG.length; advance(20 * 40);
check("Narcaine stops an overdose", !LOG.slice(m0).some((l) => l[0] === "effect" && l[1] === "wither"));
// ketamine: out of body
sober(); m0 = LOG.length; use("ketamine"); advance(60);
check("ketamine: out-of-body camera", LOG.slice(m0).some((l) => l[0] === "camera" && l[1] === "InOutSine"));
advance(20 * 10);
// drinking: vomit and a hangover
sober(); for (let i = 0; i < 3; i++) use("liquor"); m0 = LOG.length; advance(20 * 60 * 6);
check("drunk enough to throw up", msgs().some((m) => m.includes("hurk")));
check("hangover", msgs().some((m) => m.includes("Hangover")));
// addiction: three smokes hook you, going without brings withdrawal; it's kept with the player
sober(); for (let i = 0; i < 3; i++) { use("cigarette"); advance(20); }
check("habit kept with the player", JSON.parse(player.getDynamicProperty("vice:addict")).nicotine >= 3);
advance(20 * 300);
check("nicotine withdrawal", msgs().some((m) => m.includes("kill for a smoke")));
sober();
check("Narcaine ends the habit", player.getDynamicProperty("vice:addict") === undefined);

// a placed narcaine works too
const nb = block({ x: 10, y: 64, z: 10 });
nb.setPermutation(BlockPermutation.resolve("vice:narcaine_block"));
interact("vice:consumable", nb);
check("placed narcaine", nb.isAir && msgs().at(-1).includes("sober"));
check("no API misuse", count("error") === 0);

for (const l of LOG) if (l[0] === "error") console.error("API misuse:", l[1]);
for (const [n, ok] of checks) console.log(ok ? "  ok  " : "  FAIL", n);
console.log({ effects: count("effect"), fades: count("fade"), particles: count("particle"), cmds: count("cmd"), cameras: count("camera") });
if (checks.some(([, ok]) => !ok)) { console.error("FAIL"); process.exit(1); }
console.log("OK");
