"""Vice Pack furniture and crafting stations: 3D block models built from boxes, each face painted with one
material swatch from a shared 32x32 sheet (textures/blocks/vice_furniture.png). Used by vice_data.py.

Model space is the vanilla block's: x and z -8..8, y 0..16, with the front facing -z (it turns to face the player).
A box is (material, origin, size) or (material, origin, size, bone); boxes in a named bone can be shown or hidden
by block state (see VIS).
"""
import random

# material -> colour (each gets a 4x4 swatch with a little texture)
MATERIALS = {
    "oak": "#a0784a", "oak_dark": "#5e3e22", "iron": "#b4b8bd", "iron_dark": "#5f646a", "copper": "#c8784a",
    "copper_dark": "#8a4a2a", "brass": "#d4a83a", "glass": "#bfe6ef", "white": "#f0f0ec", "black": "#1c1c1e",
    "red": "#a82a2a", "leather": "#6a2a1a", "stone": "#8c8c8c", "felt": "#2f7a3a", "coffee": "#3e220e",
    "amber": "#d08a2a", "purple": "#8a3aa8", "water": "#3a6ad0", "fire": "#ff8a2a", "ceramic": "#e8e0d0",
    "ash": "#5a5a5a", "leaf_green": "#6a9a2a", "leaf_dry": "#a8783a", "bottle_green": "#2a6a2a",
    "bottle_brown": "#6a3a10", "bottle_clear": "#d6eef2", "neon_pink": "#ff4fd8", "neon_blue": "#4fd8ff",
    "orange": "#ff6a1a", "yellow": "#e8c83a",
}
MAT_INDEX = {m: i for i, m in enumerate(MATERIALS)}
SHEET = 32


def swatch_uv(mat):
    i = MAT_INDEX[mat]
    return [(i % 8) * 4, (i // 8) * 4]


def draw_sheet(hexc):
    px = [[(0, 0, 0, 0)] * SHEET for _ in range(SHEET)]
    r = random.Random(3)
    for mat, col in MATERIALS.items():
        base = hexc(col)
        u, v = swatch_uv(mat)
        for y in range(4):
            for x in range(4):
                k = r.uniform(-12, 12)
                if mat.startswith("oak") and y in (1, 3):
                    k -= 14                                   # wood grain
                if mat.startswith("neon") or mat == "fire":
                    k = abs(k)
                px[v + y][u + x] = tuple(max(0, min(255, int(c + k))) for c in base[:3]) + (255,)
    return px


def ring(mat, y, r, h=1, bone=None):
    """a square band around a centred box"""
    b = [(mat, (-r, y, -r), (2 * r, h, 0.6)), (mat, (-r, y, r - 0.6), (2 * r, h, 0.6)),
         (mat, (-r, y, -r), (0.6, h, 2 * r)), (mat, (r - 0.6, y, -r), (0.6, h, 2 * r))]
    return [x + (bone,) if bone else x for x in b]


def legs(mat, x0, z0, x1, z1, h, w=1):
    return [(mat, (x, 0, z), (w, h, w)) for x in (x0, x1) for z in (z0, z1)]


GLYPHS = {"O": ["111", "101", "101", "101", "111"], "P": ["111", "101", "111", "100", "100"],
          "E": ["111", "100", "110", "100", "111"], "N": ["101", "111", "111", "111", "101"]}


def neon_text(word, x0, y_top, mat):
    out = []
    for i, ch in enumerate(word):
        for row, bits in enumerate(GLYPHS[ch]):
            for col, b in enumerate(bits):
                if b == "1":
                    x = x0 + i * 4 + col
                    out.append((mat, (-(x + 1), y_top - row, -1.0), (1, 1, 0.5)))   # mirrored: reads right from the front
    return out


FURNITURE = {
    "brew_barrel": dict(name="Brew Barrel", sound="wood", states={"vice:stage": [0, 1, 2]}, recipe=["barrel", "iron_ingot", "iron_ingot"], boxes=[
        ("oak", (-6, 0, -6), (12, 14, 12)), ("iron", (-6.5, 2, -6.5), (13, 1, 13)), ("iron", (-6.5, 11, -6.5), (13, 1, 13)),
        ("oak_dark", (-5.5, 14, -5.5), (11, 0.5, 11)), ("brass", (-0.5, 3, -8), (1, 1, 2)), ("brass", (-0.5, 2, -8), (1, 1, 0.6)),
        ("white", (-2, 14.5, -2), (4, 0.6, 4), "foam")]),
    "still": dict(name="Still", sound="metal", states={"vice:stage": [0, 1, 2]}, recipe=["copper_ingot", "copper_ingot", "copper_ingot", "bucket"], boxes=[
        ("copper", (-5, 0, -5), (10, 7, 10)), ("copper_dark", (-5.5, 2, -5.5), (11, 1, 11)), ("copper", (-4, 7, -4), (8, 3, 8)),
        ("copper", (-1, 10, -1), (2, 4, 2)), ("copper", (-1, 13, -1), (8, 1, 2)), ("copper_dark", (6, 4, -1), (2, 10, 2)),
        ("brass", (6, 3, -3), (2, 1, 3)), ("glass", (5, 0, -7), (3, 3, 3)), ("bottle_clear", (5.5, 0.2, -6.5), (2, 1.5, 2), "drip")]),
    "drying_rack": dict(name="Drying Rack", sound="wood", states={"vice:leaves": [0, 1, 2, 3, 4], "vice:dried": [False, True]},
                        recipe=["stick", "stick", "stick", "stick", "string"], boxes=[
        ("oak_dark", (-7, 0, -0.5), (1, 15, 1)), ("oak_dark", (6, 0, -0.5), (1, 15, 1)), ("oak", (-7, 14, -0.5), (14, 1, 1)),
        ("oak_dark", (-7.5, 0, -2), (2, 1, 4)), ("oak_dark", (5.5, 0, -2), (2, 1, 4))]
        + [("leaf_green", (-5.5 + i * 3, 6, -0.25), (2.4, 8, 0.5), f"green{i}") for i in range(4)]
        + [("leaf_dry", (-5.5 + i * 3, 7, -0.25), (2.4, 7, 0.5), f"dry{i}") for i in range(4)]),
    "lab_table": dict(name="Lab Table", sound="metal", states={"vice:busy": [False, True]}, recipe=["crafting_table", "brewing_stand"], boxes=[
        ("stone", (-8, 10, -5), (16, 1, 10))] + legs("iron_dark", -7.5, -4.5, 6.5, 3.5, 10) + [
        ("iron_dark", (-6, 11, -2.5), (5, 1, 5)), ("glass", (-5, 12, -1.5), (3, 4, 3)), ("purple", (-4.5, 12.2, -1), (2, 2, 2)),
        ("glass", (-4, 16, -0.5), (1, 0.01, 1)), ("glass", (1, 11, -3), (2, 3, 2)), ("glass", (4, 11, -1), (2, 5, 2)),
        ("bottle_clear", (4.3, 11.2, -0.7), (1.4, 2, 1.4)), ("glass", (-2, 15, -0.25), (6, 0.5, 0.5)),
        ("white", (1, 11, 2), (4, 0.3, 3)), ("fire", (-5, 11.2, -1), (2, 0.8, 2), "flame")]),
    "coffee_grinder": dict(name="Coffee Grinder", sound="wood", recipe=["iron_ingot", "oak_planks", "stick"], boxes=[
        ("oak", (-3, 0, -3), (6, 5, 6)), ("oak_dark", (-1.5, 1, -3.2), (3, 1.5, 0.3)), ("brass", (-0.5, 1.5, -3.4), (1, 0.6, 0.3)),
        ("iron", (-2.5, 5, -2.5), (5, 2, 5)), ("coffee", (-2, 7, -2), (4, 0.3, 4)), ("iron_dark", (-0.5, 7, -0.5), (1, 3, 1)),
        ("iron_dark", (-0.5, 9.5, -0.5), (4, 1, 1)), ("oak_dark", (3, 10, -0.5), (1, 2, 1))]),
    "kettle": dict(name="Kettle", sound="metal", recipe=["iron_ingot", "iron_ingot", "iron_nugget"], boxes=[
        ("iron", (-4, 0, -4), (8, 6, 8)), ("iron_dark", (-4.3, 1, -4.3), (8.6, 0.6, 8.6)), ("iron_dark", (-3, 6, -3), (6, 1, 6)),
        ("black", (-0.5, 7, -0.5), (1, 1, 1)), ("iron", (-1, 2, -7), (2, 2, 3)), ("iron", (-0.75, 3.5, -8), (1.5, 1.5, 1.5)),
        ("black", (-0.5, 9, -3), (1, 1, 6)), ("black", (-0.5, 6, -3), (1, 3, 1)), ("black", (-0.5, 6, 2), (1, 3, 1))]),
    "coffee_machine": dict(name="Coffee Machine", sound="metal", recipe=["iron_ingot", "iron_ingot", "redstone", "glass_pane"], boxes=[
        ("black", (-5, 0, -2), (10, 12, 8)), ("iron", (-5, 12, -2), (10, 1, 8)), ("iron_dark", (-3, 8, -5), (6, 2, 3)),
        ("glass", (-2, 0.5, -6), (4, 5, 4)), ("coffee", (-1.5, 0.6, -5.5), (3, 2.5, 3)), ("black", (-1, 5.5, -6), (2, 0.6, 4)),
        ("red", (3, 10, -2.3), (1, 1, 0.3)), ("neon_blue", (1, 10, -2.3), (1, 1, 0.3))]),
    "beer_keg": dict(name="Beer Keg", sound="metal", recipe=["barrel", "iron_ingot", "copper_ingot"], boxes=[
        ("iron", (-5, 0, -5), (10, 13, 10)), ("iron_dark", (-5.5, 0, -5.5), (11, 1, 11)), ("iron_dark", (-5.5, 12, -5.5), (11, 1, 11)),
        ("iron_dark", (-5.5, 6, -5.5), (11, 1, 11)), ("brass", (-1, 13, -1), (2, 1, 2)), ("brass", (-0.5, 14, -0.5), (1, 2, 1)),
        ("brass", (-0.5, 15, -2.5), (1, 1, 2)), ("black", (-0.5, 16, -0.5), (1, 0.01, 1))]),
    "ashtray": dict(name="Ashtray", sound="stone", states={"vice:butts": [0, 1, 2, 3]}, recipe=["brick", "brick"], boxes=[
        ("black", (-3, 0, -3), (6, 1, 6))] + ring("stone", 1, 3) + [
        ("ash", (-2, 1, -2), (4, 0.2, 4)),
        ("white", (-1.8, 1.1, -1), (2, 0.5, 0.5), "b0"), ("orange", (-2.2, 1.1, -1), (0.5, 0.5, 0.5), "b0"),
        ("white", (0, 1.1, 0.5), (0.5, 0.5, 2), "b1"), ("orange", (0, 1.1, 0), (0.5, 0.5, 0.5), "b1"),
        ("white", (-0.5, 1.1, -2), (2, 0.5, 0.5), "b2"), ("orange", (1.5, 1.1, -2), (0.5, 0.5, 0.5), "b2")]),
    "bar_counter": dict(name="Bar Counter", sound="wood", recipe=["dark_oak_planks", "dark_oak_planks", "dark_oak_planks", "oak_planks"],
                        count=2, full=True, boxes=[
        ("oak_dark", (-8, 0, -6), (16, 14, 14)), ("oak", (-8, 14, -8), (16, 2, 16)), ("black", (-8, 0, -6.5), (16, 1, 0.5)),
        ("brass", (-8, 3, -8), (16, 1, 1))]),
    "liquor_shelf": dict(name="Liquor Shelf", sound="wood", recipe=["oak_planks", "oak_planks", "glass_bottle", "glass_bottle"], boxes=[
        ("oak_dark", (-8, 0, 5), (16, 16, 3)), ("oak_dark", (-8, 0, 1), (1, 16, 4)), ("oak_dark", (7, 0, 1), (1, 16, 4)),
        ("oak", (-8, 0, 1), (16, 1, 4)), ("oak", (-8, 5, 1), (16, 1, 4)), ("oak", (-8, 11, 1), (16, 1, 4)),
        ("bottle_green", (-6, 1, 2), (2, 4, 2)), ("bottle_brown", (-3, 1, 2), (2, 3, 2)), ("bottle_clear", (0, 1, 2), (2, 4, 2)),
        ("amber", (3, 1, 2), (2, 3, 2)), ("bottle_brown", (-5, 6, 2), (2, 4, 2)), ("purple", (-2, 6, 2), (2, 3, 2)),
        ("bottle_green", (1, 6, 2), (2, 4, 2)), ("bottle_clear", (4, 6, 2), (2, 4, 2)), ("amber", (-4, 12, 2), (2, 3, 2)),
        ("bottle_clear", (2, 12, 2), (2, 4, 2))]),
    "neon_sign": dict(name="Neon Sign", sound="glass", light=12, recipe=["glowstone_dust", "redstone", "glass_pane", "pink_dye"], boxes=[
        ("black", (-8, 2, -0.5), (16, 8, 1)), ("iron_dark", (-6, 0, -1.5), (1, 2, 3)), ("iron_dark", (5, 0, -1.5), (1, 2, 3)),
        ("neon_blue", (-8, 9.5, -0.8), (16, 0.5, 0.3)), ("neon_blue", (-8, 2, -0.8), (16, 0.5, 0.3))]
        + neon_text("OPEN", -7.5, 8, "neon_pink")),
    "pool_table": dict(name="Pool Table", sound="wood", full=True, recipe=["green_wool", "oak_planks", "oak_planks", "stick"], boxes=[
        ("oak_dark", (-8, 7, -8), (16, 2, 16)), ("felt", (-8, 9, -8), (16, 1, 16)),
        ("oak_dark", (-8, 10, -8), (16, 1.5, 1.5)), ("oak_dark", (-8, 10, 6.5), (16, 1.5, 1.5)),
        ("oak_dark", (-8, 10, -6.5), (1.5, 1.5, 13)), ("oak_dark", (6.5, 10, -6.5), (1.5, 1.5, 13))]
        + legs("oak_dark", -7, -7, 5, 5, 7, 2) + [
        ("black", (-6.5, 10, -6.5), (1, 0.1, 1)), ("black", (5.5, 10, -6.5), (1, 0.1, 1)), ("black", (-6.5, 10, 5.5), (1, 0.1, 1)),
        ("black", (5.5, 10, 5.5), (1, 0.1, 1)), ("white", (-3, 10, -1), (1, 1, 1)), ("red", (2, 10, 1), (1, 1, 1)),
        ("yellow", (3, 10, -2), (1, 1, 1)), ("black", (1, 10, 0), (1, 1, 1)), ("neon_blue", (4, 10, 2), (1, 1, 1)),
        ("oak", (-5, 10, 3), (8, 0.5, 0.5))]),
    "bar_stool": dict(name="Bar Stool", sound="metal", recipe=["oak_planks", "stick", "stick", "red_wool"], boxes=[
        ("leather", (-4, 10, -4), (8, 2, 8)), ("iron", (-1, 1, -1), (2, 9, 2)), ("iron_dark", (-3.5, 0, -3.5), (7, 1, 7))]
        + ring("iron", 5, 3, 0.5)),
    "hookah": dict(name="Hookah", sound="glass", states={"vice:loaded": [False, True]}, recipe=["glass_bottle", "iron_ingot", "string", "copper_ingot"], boxes=[
        ("glass", (-3, 0, -3), (6, 5, 6)), ("water", (-2.5, 0.5, -2.5), (5, 3, 5)), ("brass", (-0.5, 5, -0.5), (1, 7, 1)),
        ("brass", (-2.5, 10, -2.5), (5, 0.5, 5)), ("ceramic", (-1.5, 12, -1.5), (3, 2, 3)), ("fire", (-1, 14, -1), (2, 0.5, 2), "coal"),
        ("leather", (0.5, 4, -0.5), (6, 1, 1)), ("leather", (6, 1, -0.5), (1, 3, 1)), ("brass", (6, 0.2, -0.5), (1, 1, 1))]),
}
# which bones show when (Molang over the block's states)
VIS = {
    "brew_barrel": {"foam": "q.block_state('vice:stage') == 2"},
    "still": {"drip": "q.block_state('vice:stage') >= 1"},
    "lab_table": {"flame": "q.block_state('vice:busy')"},
    "ashtray": {f"b{i}": f"q.block_state('vice:butts') > {i}" for i in range(3)},
    "hookah": {"coal": "q.block_state('vice:loaded')"},
    "drying_rack": {**{f"green{i}": f"q.block_state('vice:leaves') > {i} && !q.block_state('vice:dried')" for i in range(4)},
                    **{f"dry{i}": f"q.block_state('vice:leaves') > {i} && q.block_state('vice:dried')" for i in range(4)}},
}
# interactive ones (the script handles them through the vice:station component)
STATIONS = {"brew_barrel", "still", "drying_rack", "lab_table", "coffee_grinder", "kettle", "coffee_machine", "beer_keg",
            "ashtray", "pool_table", "bar_stool", "hookah"}


def geometry(fid):
    spec = FURNITURE[fid]
    bones = {"root": []}
    for b in spec["boxes"]:
        mat, origin, size = b[:3]
        bone = b[3] if len(b) > 3 else "root"
        uv = {"uv": swatch_uv(mat), "uv_size": [4, 4]}
        cube = {"origin": list(origin), "size": [max(s, 0.01) for s in size],
                "uv": {f: dict(uv) for f in ("north", "south", "east", "west", "up", "down")}}
        bones.setdefault(bone, []).append(cube)
    out = [{"name": "root", "pivot": [0, 0, 0], "cubes": bones.pop("root")}]
    for name, cubes in bones.items():
        out.append({"name": name, "parent": "root", "pivot": [0, 0, 0], "cubes": cubes})
    ident = f"geometry.vice_{fid}"
    return ident, {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": ident, "texture_width": SHEET, "texture_height": SHEET,
                        "visible_bounds_width": 2, "visible_bounds_height": 2, "visible_bounds_offset": [0, 0.5, 0]},
        "bones": out}]}


def bounds(fid):
    """the box around the model, kept inside the block (for collision and selection)"""
    lo, hi = [8, 16, 8], [-8, 0, -8]
    for b in FURNITURE[fid]["boxes"]:
        o, s = b[1], b[2]
        for i in range(3):
            lo[i] = min(lo[i], o[i]); hi[i] = max(hi[i], o[i] + s[i])
    lo = [max(-8, lo[0]), max(0, lo[1]), max(-8, lo[2])]
    hi = [min(8, hi[0]), min(16, hi[1]), min(8, hi[2])]
    return {"origin": [round(v, 2) for v in lo], "size": [round(max(0.5, hi[i] - lo[i]), 2) for i in range(3)]}
