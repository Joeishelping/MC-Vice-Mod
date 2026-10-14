// The Vice Guide (item) and `/scriptevent vice:menu`: how everything works, how you're doing, and the settings.
import * as mc from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { getSettings, setSettings, states, now, SEC, cleanFor, safe } from "./main.js";

const { system } = mc;

const GUIDE = [
  ["Using things", "Hold use to drink, smoke, eat or take something. Sneak + use on the top of a block puts it down; use the placed one to have it from there. Cocaine and ketamine go down as lines you snort off the table. Bong, pipe and vape are reusable: they burn weed, cured tobacco or vape juice."],
  ["Growing", "Weed, tobacco seeds, opium poppy seeds, coffee beans and tea leaves plant on grass or dirt and grow in 4 stages (bone meal speeds them up). Breaking grass sometimes drops a seed."],
  ["Stations", "Brew Barrel: wheat -> beer, sweet berries -> wine (3 min). Still (fire underneath): potatoes -> liquor, sugar cane -> moonshine. Drying Rack: tobacco leaves -> cured tobacco. Lab Table: cocaine -> crack, opium -> heroin, redstone + sugar -> meth, quartz + sugar -> ketamine (watch out). Coffee Grinder: beans -> ground coffee. Kettle (fire, water bucket) and Coffee Machine: a bowl -> coffee or tea."],
  ["The bar", "Beer Keg (pour beer in, fill bottles or drink from the tap), Ashtray (finish a smoke near it), Hookah (load it, anyone can puff), Bar Stool (sit)."],
  ["Friends", "Sneak + use while looking at a player passes them what you hold. Sneak + use a drink in the air buys everyone near you a round. Standing in someone's weed smoke gets you a contact high."],
  ["Danger", "Overdoses take 30 s and can kill: Narcaine saves you. Mixing downers (alcohol, opioids, Xanax) can stop your breathing; coke + booze strains your heart; uppers hide how drunk you are. Habits form, withdrawal hurts. Sleep it off: a night's sleep clears hangovers and crashes and eases the cravings (you can't sleep while wired)."],
  ["Recovery", "Stay clean (no habit-forming use) and you earn Recovery Chips at 1 day, 3 days, 1 week and 30 days. A Nicotine Patch keeps nicotine cravings away for 10 minutes. Tea calms withdrawal; Xanax numbs it."],
];

function fmtClean(ticks) {
  if (ticks === undefined) return "never used anything habit-forming";
  const days = Math.floor(ticks / 24000), hours = Math.floor((ticks % 24000) / 1000);
  return `${days} day${days === 1 ? "" : "s"}, ${hours} hour${hours === 1 ? "" : "s"} clean`;
}

function status(p) {
  const s = states.get(p.id);
  const lines = [];
  if (s) {
    const left = (u) => Math.max(0, Math.ceil((u - now()) / SEC));
    const highs = [["Drunk", s.drunk > 0 ? `${s.drunk.toFixed(1)} / 10` : ""], ["Stoned", left(s.stonedUntil)], ["Tripping", left(s.tripUntil)],
      ["Wired (cocaine)", left(s.cokeUntil)], ["Rushing (crack)", left(s.crackUntil)], ["Tweaking (meth)", left(s.methUntil)],
      ["Nodding (heroin)", left(s.heroinUntil)], ["Sedated (opium)", left(s.opiumUntil)], ["Leaning", left(s.leanUntil)],
      ["Rolling (ecstasy)", left(s.mollyUntil)], ["Focused (adderall)", left(s.addyUntil)], ["Benzo'd (xanax)", left(s.xanUntil)],
      ["Caffeinated", left(s.caffeineUntil)], ["K-hole", left(s.kUntil)]];
    for (const [name, v] of highs) if (v) lines.push(`§f${name}: §7${typeof v === "number" ? v + " s" : v}`);
    const habits = Object.entries(s.addict ?? {}).filter(([, v]) => v > 0);
    if (habits.length) lines.push("", "§6Habits:", ...habits.map(([c, v]) => `§7${c}: ${"▮".repeat(Math.round(v))}${"▯".repeat(10 - Math.round(v))}`));
  }
  if (!lines.length) lines.push("§7Stone cold sober.");
  lines.push("", `§aRecovery: §7${fmtClean(cleanFor(p))}`);
  return lines.join("\n");
}

async function settingsForm(p) {
  const cur = getSettings();
  const f = new ModalFormData().title("Vice Pack Settings");
  f.slider("Colour haze strength (%)", 0, 100, { valueStep: 25, defaultValue: cur.haze });
  f.toggle("Camera effects (shakes, nodding off, out-of-body, snort camera, blackouts)", { defaultValue: cur.camera });
  f.toggle("Overdoses", { defaultValue: cur.overdoses });
  f.toggle("Habits and withdrawal", { defaultValue: cur.addiction });
  f.toggle("Hallucinations (sounds, shadow figures)", { defaultValue: cur.hallucinations });
  f.toggle("Slurred chat when drunk", { defaultValue: cur.slurring });
  const r = await f.show(p);
  if (r.canceled || !r.formValues) return;
  const [haze, camera, overdoses, addiction, hallucinations, slurring] = r.formValues;
  setSettings({ haze: Number(haze), camera: !!camera, overdoses: !!overdoses, addiction: !!addiction, hallucinations: !!hallucinations, slurring: !!slurring });
  p.sendMessage("§aVice Pack settings saved (for everyone in this world).");
}

export async function openMenu(p) {
  const f = new ActionFormData().title("Vice Guide").body("What do you want to know?")
    .button("How am I doing?").button("Guide").button("Settings");
  const r = await f.show(p);
  if (r.canceled) return;
  if (r.selection === 0) {
    await new MessageFormData().title("How am I doing?").body(status(p)).button1("Back").button2("Close").show(p).then((x) => { if (x.selection === 0) openMenu(p); });
  } else if (r.selection === 1) {
    const g = new ActionFormData().title("Guide").body("Pick a topic.");
    for (const [title] of GUIDE) g.button(title);
    const gr = await g.show(p);
    if (gr.canceled) return;
    const [title, text] = GUIDE[gr.selection];
    const back = await new MessageFormData().title(title).body(text).button1("Back").button2("Close").show(p);
    if (back.selection === 0) openMenu(p);
  } else if (r.selection === 2) {
    await settingsForm(p);
  }
}

system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
  itemComponentRegistry.registerCustomComponent("vice:guide", {
    onUse: (e) => { const p = e.source; if (p) system.run(() => openMenu(p).catch(() => {})); },
  });
});
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id === "vice:menu" && ev.sourceEntity?.typeId === "minecraft:player") system.run(() => openMenu(ev.sourceEntity).catch(() => {}));
});
