#!/usr/bin/env python3
"""Writes all of Vice Pack's JSON: items, placed blocks, block geometry, recipes, loot tables, texture atlases.

Run: python3 tools/vice_data.py   (then tools/vice_textures.py for the PNGs, tools/build_vice.py for the .mcaddon)
The tables below are the single place to add or change a substance's item, block or recipe.
"""
import json, os, shutil

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(root, "Vice Pack BP")
RP = os.path.join(root, "Vice Pack RP")
FMT = "1.21.90"


def dump(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)
        f.write("\n")


# ---------------------------------------------------------------- items
# id: (name, use animation or None = not held-to-use, seconds, converts_to, stack, placed block)
# Food items are placed with sneak + use on top of a block (the script does it); the others place natively.
ITEMS = {
    "beer":      ("Beer", "drink", 1.6, "minecraft:glass_bottle", 16, "beer_block"),
    "liquor":    ("Liquor", "drink", 1.6, "minecraft:glass_bottle", 16, "liquor_block"),
    "cigarette": ("Cigarette", "drink", 2.0, None, 16, "cigarette_block"),
    "cigar":     ("Cigar", "drink", 2.6, None, 16, "cigar_block"),
    "joint":     ("Joint", "drink", 2.2, None, 16, "joint_block"),
    "opium":     ("Opium", "drink", 2.2, None, 16, "opium_block"),
    "shrooms":   ("Shrooms", "eat", 1.4, None, 16, "shrooms_block"),
    "bong":      ("Bong", "drink", 1.8, "vice:bong", 1, "bong_block"),
    "cocaine":   ("Cocaine", None, 0, None, 16, "cocaine_lines"),
    "ketamine":  ("Ketamine", None, 0, None, 16, "ketamine_lines"),
    "weed":      ("Weed", None, 0, None, 64, "weed_plant"),
    "narcaine":  ("Narcaine", "drink", 0.8, None, 16, "narcaine_block"),
    "zynn":      ("Zynn", "eat", 1.0, None, 16, "zynn_block"),
    "coffee":    ("Coffee", "drink", 1.6, "minecraft:bowl", 16, "coffee_block"),
    "tea":       ("Tea", "drink", 1.6, "minecraft:bowl", 16, "tea_block"),
    "wine":      ("Wine", "drink", 1.6, "minecraft:glass_bottle", 16, "wine_block"),
    "pipe":      ("Pipe", "drink", 2.2, "vice:pipe", 1, "pipe_block"),
    "morphine":  ("Morphine", "eat", 0.6, None, 16, "morphine_block"),
    "tobacco_leaf":  ("Tobacco Leaf", None, 0, None, 64, None),
    "tobacco_seeds": ("Tobacco Seeds", None, 0, None, 64, "tobacco_plant"),
    "poppy_seeds":   ("Opium Poppy Seeds", None, 0, None, 64, "poppy_plant"),
    "coffee_beans":  ("Coffee Beans", None, 0, None, 64, "coffee_plant"),
    "tea_leaves":    ("Tea Leaves", None, 0, None, 64, "tea_plant"),
}
GROUP = "vice:vices"                  # the collapsible "VICES" group in the creative inventory
SOIL = ["minecraft:grass_block", "minecraft:dirt", "minecraft:coarse_dirt", "minecraft:podzol", "minecraft:farmland",
        "minecraft:moss_block", "minecraft:rooted_dirt", "minecraft:mud"]

# ---------------------------------------------------------------- placed blocks
# id: (shape, size in pixels, texture, custom component, drops)
#   cross = two crossed planes (like a flower), flat = lying on the surface (turns to face the player)
BLOCKS = {
    "beer_block":      ("cross", 10, "vice_beer", "vice:consumable", "beer"),
    "liquor_block":    ("cross", 11, "vice_liquor", "vice:consumable", "liquor"),
    "opium_block":     ("cross", 8, "vice_opium", "vice:consumable", "opium"),
    "shrooms_block":   ("cross", 10, "vice_shrooms", "vice:consumable", "shrooms"),
    "bong_block":      ("cross", 13, "vice_bong", "vice:reusable", "bong"),
    "zynn_block":      ("flat", 7, "vice_zynn", "vice:consumable", "zynn"),
    "coffee_block":    ("cross", 8, "vice_coffee", "vice:consumable", "coffee"),
    "tea_block":       ("cross", 8, "vice_tea", "vice:consumable", "tea"),
    "wine_block":      ("cross", 11, "vice_wine", "vice:consumable", "wine"),
    "pipe_block":      ("flat", 10, "vice_pipe", "vice:reusable", "pipe"),
    "morphine_block":  ("flat", 9, "vice_morphine", "vice:consumable", "morphine"),
    "narcaine_block":  ("cross", 8, "vice_narcaine", "vice:consumable", "narcaine"),
    "cigarette_block": ("flat", 9, "vice_cigarette", "vice:consumable", "cigarette"),
    "cigar_block":     ("flat", 11, "vice_cigar", "vice:consumable", "cigar"),
    "joint_block":     ("flat", 9, "vice_joint", "vice:consumable", "joint"),
    "cocaine_lines":   ("flat", 14, "vice_cocaine_lines", "vice:lines", None),     # 1..3 lines, the script drops them
    "ketamine_lines":  ("flat", 14, "vice_ketamine_lines", "vice:lines", None),
    "weed_plant":      ("cross", 16, "vice_weed_plant", "vice:crop", "weed"),
    "tobacco_plant":   ("cross", 16, "vice_tobacco_plant", "vice:crop", "tobacco_seeds"),
    "poppy_plant":     ("cross", 16, "vice_poppy_plant", "vice:crop", "poppy_seeds"),
    "coffee_plant":    ("cross", 16, "vice_coffee_plant", "vice:crop", "coffee_beans"),
    "tea_plant":       ("cross", 16, "vice_tea_plant", "vice:crop", "tea_leaves"),
}
CROPS = {b for b in BLOCKS if b.endswith("_plant")}

# ---------------------------------------------------------------- recipes (shapeless, crafting table)
# (recipe name, ingredients, count, result: defaults to the recipe name)
RECIPES = [(k, ing, n, k) for k, (ing, n) in {
    "beer": (["glass_bottle", "wheat", "wheat", "sugar"], 1),
    "liquor": (["glass_bottle", "potato", "potato", "potato", "sugar"], 1),
    "cigarette": (["paper", "dried_kelp"], 4),
    "cigar": (["paper", "dried_kelp", "dried_kelp", "dried_kelp"], 1),
    "cocaine": (["paper", "sugar", "glowstone_dust"], 2),
    "ketamine": (["glass_bottle", "sugar", "quartz"], 2),
    "opium": (["poppy", "poppy", "poppy", "brown_mushroom"], 1),
    "weed": (["fern", "bone_meal"], 1),
    "joint": (["paper", "vice:weed"], 1),
    "bong": (["glass", "glass", "glass", "glass_bottle"], 1),
    "shrooms": (["brown_mushroom", "red_mushroom", "glowstone_dust"], 2),
    "narcaine": (["glass_bottle", "glistering_melon_slice"], 2),
    "zynn": (["vice:tobacco_leaf", "paper", "iron_nugget"], 4),
    "coffee": (["bowl", "vice:coffee_beans", "vice:coffee_beans", "sugar"], 1),
    "tea": (["bowl", "vice:tea_leaves", "vice:tea_leaves"], 1),
    "wine": (["glass_bottle", "sweet_berries", "sweet_berries", "sweet_berries"], 1),
    "pipe": (["bowl", "stick"], 1),
    "morphine": (["vice:opium", "glass_bottle", "iron_nugget"], 2),
    "poppy_seeds": (["poppy"], 2),
    "tobacco_seeds": (["wheat_seeds", "dried_kelp"], 2),
    "coffee_beans": (["cocoa_beans", "bone_meal"], 2),
    "tea_leaves": (["oak_leaves", "bone_meal"], 1),
}.items()] + [
    ("cigarette_tobacco", ["paper", "vice:tobacco_leaf"], 4, "cigarette"),
    ("cigar_tobacco", ["paper", "vice:tobacco_leaf", "vice:tobacco_leaf", "vice:tobacco_leaf"], 1, "cigar"),
]

# ---------------------------------------------------------------- colour haze (fog), see hazeTick in main.js
HAZE_LEVELS = 8
HAZE = {
    "amber": "#f0a43a", "green": "#5fd35a", "magenta": "#e055d0", "ice": "#c4ecff", "purple": "#8a3cff",
    "orange": "#ff8a2a", "grey": "#5c5c6e", "red": "#8b0a0a",
    "gold": "#ffd27a", "mint": "#9ee6b0", "wine": "#9c1c4a",
}
for i in range(12):                                   # rainbow for the shroom trip
    import colorsys
    r, g, b = colorsys.hsv_to_rgb(i / 12, 0.75, 1.0)
    HAZE[f"hue{i}"] = "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


def haze_fog(color, hexcol, level):
    k = level / HAZE_LEVELS
    # level 1: a faint tint far away ... level 8: thick colour from 14 blocks out
    end = round(260 * (1 - k) ** 1.6 + 14, 1)
    air = {"fog_start": 0, "fog_end": end, "fog_color": hexcol, "render_distance_type": "fixed"}
    return {"format_version": "1.16.100", "minecraft:fog_settings": {
        "description": {"identifier": f"vice:haze_{color}_{level}"},
        "distance": {"air": air, "weather": dict(air)}}}


def item_json(iid, spec):
    name, anim, secs, conv, stack, block = spec
    comps = {
        "minecraft:icon": {"textures": {"default": f"vice_{iid}"}},
        "minecraft:display_name": {"value": name},
        "minecraft:max_stack_size": stack,
        "minecraft:tags": {"tags": ["vice:substance"]},
    }
    if anim:
        food = {"nutrition": 0, "saturation_modifier": 0, "can_always_eat": True}
        if conv:
            food["using_converts_to"] = conv
        comps["minecraft:use_animation"] = anim
        comps["minecraft:use_modifiers"] = {"use_duration": secs, "movement_modifier": 0.35}
        comps["minecraft:food"] = food
    elif block:
        placer = {"block": f"vice:{block}", "replace_block_item": False}
        if block in CROPS:
            placer["use_on"] = SOIL
        comps["minecraft:block_placer"] = placer
    return {"format_version": FMT, "minecraft:item": {
        "description": {"identifier": f"vice:{iid}", "menu_category": {"category": "items", "group": GROUP}},
        "components": comps}}


def geometry(shape, size):
    ident = f"geometry.vice_{shape}_{size}"
    full = {"uv": [0, 0], "uv_size": [16, 16]}
    flip = {"uv": [16, 0], "uv_size": [-16, 16]}
    if shape == "cross":
        h = size / 2
        cubes = [{"origin": [-h, 0, 0], "size": [size, size, 0], "pivot": [0, 0, 0], "rotation": [0, r, 0],
                  "uv": {"north": full, "south": flip}} for r in (45, -45)]
    else:
        h = size / 2
        cubes = [{"origin": [-h, 0.1, -h], "size": [size, 0, size], "uv": {"up": full, "down": full}}]
    return ident, {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": ident, "texture_width": 16, "texture_height": 16,
                        "visible_bounds_width": 2, "visible_bounds_height": 2, "visible_bounds_offset": [0, 0.5, 0]},
        "bones": [{"name": "root", "pivot": [0, 0, 0], "cubes": cubes}]}]}


def material(tex):
    return {"*": {"texture": tex, "render_method": "alpha_test", "face_dimming": False}}


def block_json(bid, spec):
    shape, size, tex, comp, drops = spec
    ident, _ = geometry(shape, size)
    h = max(2, size / 2)
    if shape == "cross":
        sel = {"origin": [-h * 0.7, 0, -h * 0.7], "size": [h * 1.4, min(16, size), h * 1.4]}
    else:
        sel = {"origin": [-h, 0, -h], "size": [size, 1.5, size]}
    desc = {"identifier": f"vice:{bid}", "menu_category": {"category": "none"}}
    comps = {
        "minecraft:geometry": ident,
        "minecraft:material_instances": material(tex + "_1" if "lines" in bid else tex + "_0" if bid in CROPS else tex),
        "minecraft:collision_box": False,
        "minecraft:selection_box": sel,
        "minecraft:destructible_by_mining": {"seconds_to_destroy": 0.05},
        "minecraft:destructible_by_explosion": {"explosion_resistance": 0},
        "minecraft:light_dampening": 0,
        "minecraft:placement_filter": {"conditions": [{"allowed_faces": ["up"]}]},
        "minecraft:loot": f"loot_tables/vice/{drops}.json" if drops else "loot_tables/empty.json",
        comp: {},
    }
    perms = []
    if bid in CROPS:
        comps["minecraft:placement_filter"] = {"conditions": [{"allowed_faces": ["up"], "block_filter": SOIL}]}
        desc["states"] = {"vice:growth": [0, 1, 2, 3]}
        perms += [{"condition": f"q.block_state('vice:growth') == {g}", "components": {
            "minecraft:material_instances": material(f"{tex}_{g}"),
            "minecraft:selection_box": {"origin": [-5, 0, -5], "size": [10, [5, 8, 12, 16][g], 10]}}} for g in range(4)]
    if "lines" in bid:
        desc["states"] = {"vice:lines": [1, 2, 3]}
        perms += [{"condition": f"q.block_state('vice:lines') == {n}", "components": {
            "minecraft:material_instances": material(f"{tex}_{n}")}} for n in (1, 2, 3)]
    if shape == "flat":
        desc["traits"] = {"minecraft:placement_direction": {"enabled_states": ["minecraft:cardinal_direction"]}}
        perms += [{"condition": f"q.block_state('minecraft:cardinal_direction') == '{d}'", "components": {
            "minecraft:transformation": {"rotation": [0, r, 0]}}}
            for d, r in (("north", 0), ("west", 90), ("south", 180), ("east", 270))]
    out = {"description": desc, "components": comps}
    if perms:
        out["permutations"] = perms
    return {"format_version": FMT, "minecraft:block": out}


if __name__ == "__main__":
    for sub in ("items", "blocks", "recipes", "loot_tables"):
        shutil.rmtree(os.path.join(BP, sub), ignore_errors=True)
    shutil.rmtree(os.path.join(RP, "models"), ignore_errors=True)
    shutil.rmtree(os.path.join(RP, "fogs"), ignore_errors=True)
    for color, hexcol in HAZE.items():
        for lv in range(1, HAZE_LEVELS + 1):
            dump(os.path.join(RP, "fogs", f"haze_{color}_{lv}.json"), haze_fog(color, hexcol, lv))

    for iid, spec in ITEMS.items():
        dump(os.path.join(BP, "items", f"{iid}.json"), item_json(iid, spec))
    item_tex = {f"vice_{iid}": {"textures": f"textures/items/vice_{iid}"} for iid in ITEMS}
    dump(os.path.join(RP, "textures", "item_texture.json"),
         {"resource_pack_name": "vice_pack", "texture_name": "atlas.items", "texture_data": item_tex})

    terrain, geos = {}, {}
    for bid, spec in BLOCKS.items():
        dump(os.path.join(BP, "blocks", f"{bid}.json"), block_json(bid, spec))
        ident, geo = geometry(spec[0], spec[1])
        geos[ident] = geo
        tex = spec[2]
        if bid in CROPS:
            for g in range(4):
                terrain[f"{tex}_{g}"] = {"textures": f"textures/blocks/{tex}_{g}"}
        elif "lines" in bid:
            for n in (1, 2, 3):
                terrain[f"{tex}_{n}"] = {"textures": f"textures/blocks/{tex}_{n}"}
        else:
            terrain[tex] = {"textures": f"textures/items/{tex}"}      # placed items reuse their icon
    for ident, geo in geos.items():
        dump(os.path.join(RP, "models", "blocks", ident.replace("geometry.", "") + ".geo.json"), geo)
    dump(os.path.join(RP, "textures", "terrain_texture.json"),
         {"resource_pack_name": "vice_pack", "texture_name": "atlas.terrain", "padding": 8, "num_mip_levels": 4, "texture_data": terrain})
    # placing / breaking sounds
    dump(os.path.join(RP, "blocks.json"), {"format_version": "1.21.40", **{f"vice:{b}": {"sound": "glass" if b in ("beer_block", "liquor_block", "bong_block", "wine_block", "coffee_block", "tea_block") else "grass"} for b in BLOCKS}})

    drops = {spec[4] for spec in BLOCKS.values() if spec[4]}
    for d in drops:
        dump(os.path.join(BP, "loot_tables", "vice", f"{d}.json"),
             {"pools": [{"rolls": 1, "entries": [{"type": "item", "name": f"vice:{d}", "weight": 1}]}]})

    for name, ing, n, result in RECIPES:
        dump(os.path.join(BP, "recipes", f"{name}.json"), {"format_version": "1.20.10", "minecraft:recipe_shapeless": {
            "description": {"identifier": f"vice:craft_{name}"}, "tags": ["crafting_table"],
            "unlock": {"context": "AlwaysUnlocked"},
            "ingredients": [{"item": i if ":" in i else f"minecraft:{i}"} for i in ing],
            "result": {"item": f"vice:{result}", "count": n}}})

    # one collapsible "VICES" group in the creative inventory (Items tab), like the vanilla Stone group
    shutil.rmtree(os.path.join(BP, "item_catalog"), ignore_errors=True)
    dump(os.path.join(BP, "item_catalog", "crafting_item_catalog.json"), {"format_version": "1.21.60", "minecraft:crafting_items_catalog": {
        "categories": [{"category_name": "items", "groups": [{
            "group_identifier": {"icon": "vice:beer", "name": GROUP},
            "items": [f"vice:{i}" for i in ITEMS]}]}]}})
    for pack in (BP, RP):
        with open(os.path.join(pack, "texts", "en_US.lang"), "w") as f:
            f.write("pack.name=Vice Pack\npack.description=Beer, liquor, smokes, weed, shrooms, coffee and drugs with effects\n"
                    f"{GROUP}=VICES\nitemGroup.name.vices=VICES\n")
    print(f"{len(ITEMS)} items, {len(BLOCKS)} blocks, {len(geos)} geometries, {len(RECIPES)} recipes, {len(HAZE) * HAZE_LEVELS} fogs")
