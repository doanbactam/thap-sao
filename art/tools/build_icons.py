#!/usr/bin/env python3
"""Build the icons_items atlas (artifacts + tablets) for Tháp Sao.

Inputs : art/raw_icons/grid1..6.png (generated grids on chroma green), src/data/artifacts.ts + tablets.ts (ids, targets)
Outputs: public/assets/sprites/icons_items.png + .json (Phaser JSON-hash, 96x96 frames, name = icon field),
         art/sheets/icons_items_sheet.png (labelled contact sheet), art/icons_out/<frame>.png (individual frames)
Run    : python3 art/tools/build_icons.py   (needs numpy, scipy, Pillow, and `npx tsx` to dump the data)
"""
import json, os, sys, math, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iconlib import *
from PIL import ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RAW = os.path.join(ROOT, 'art', 'raw_icons')
OUT_FR = os.path.join(ROOT, 'art', 'icons_out'); os.makedirs(OUT_FR, exist_ok=True)
SIZE = 96

# grid -> component index -> artifact id (indices from the labelled probe sheets; dup/spare components omitted)
MAP = {
 'grid1': {0:'g_frost_shard',1:'g_snow_charm',2:'g_ice_lantern',3:'g_cold_mittens',4:'e_ember_coal',5:'e_matchbox',6:'g_glacier_heart',
           7:'g_icicle_spear',8:'g_polar_compass',9:'g_frozen_tear',11:'e_forge_bellows',12:'e_phoenix_feather',13:'e_pepper_pouch',
           15:'e_lava_lamp',16:'e_burning_crown',17:'e_kiln_brick'},
 'grid2': {0:'s_spark_bead',1:'s_copper_coil',2:'s_thunder_drum',3:'s_storm_kite',4:'s_lightning_rod',5:'s_static_sock',6:'s_tempest_eye',
           7:'s_battery_jar',8:'gd_wooden_buckler',9:'gd_iron_helm',10:'gd_thorn_vest',11:'gd_bastion_tower',12:'gd_turtle_shell',
           13:'gd_bandage_roll',14:'gd_oath_banner',15:'gd_stone_amulet'},
 'grid3': {0:'sh_cat_bell',1:'sh_smoke_pellet',2:'sh_moon_dagger',3:'sh_night_cloak',4:'sh_shadow_mask',5:'sh_raven_feather',6:'sh_eclipse_ring',
           8:'sh_unlit_hood',9:'l_dew_drop',10:'l_lotus_pin',11:'l_moon_pond_mirror',13:'l_water_jug',14:'l_clam_pearl',15:'l_rain_bell',
           16:'l_tide_crown',17:'l_koi_charm'},
 'grid4': {0:'w_paper_fan',1:'w_swift_sandals',2:'w_wind_whistle',3:'w_cloud_boots',4:'w_pinwheel',5:'w_bamboo_flute',6:'w_gale_scarf',
           7:'w_dandelion_seed',9:'a_icebolt_tome',10:'a_fireball_tome',11:'a_chain_scroll',15:'a_arcane_quill',16:'a_bubble_primer',
           17:'a_blink_card',18:'a_scholar_glasses',19:'a_grand_grimoire'},
 'grid5': {0:'c_sprout_pot',1:'c_bat_whistle',2:'c_wisp_lantern',3:'c_acorn_snack',4:'c_friend_badge',5:'c_nest_hat',6:'c_root_heart',
           7:'c_paw_print',9:'cu_rusty_nail',10:'cu_toad_vial',11:'cu_hex_doll',12:'cu_witch_candle',14:'cu_bone_dice',15:'cu_cursed_coin',
           16:'cu_plague_mask',17:'cu_doom_clock'},
 'grid6': {0:'a_ink_pot'},
}
SLABS = {'common': ('grid6', 1), 'rare': ('grid6', 2), 'epic': ('grid6', 4), 'legendary': ('grid6', 5)}

def dump_data():
    js = ("import a from './src/data/artifacts.ts'; import t from './src/data/tablets.ts';"
          "console.log(JSON.stringify({artifacts:a.map(x=>({id:x.id,icon:x.icon,tags:x.tags,rarity:x.rarity})),"
          "tablets:t.map(x=>({id:x.id,icon:x.icon,rarity:x.rarity,shape:x.shape,targets:x.targets}))}))")
    out = subprocess.check_output(['npx', 'tsx', '-e', js], cwd=ROOT, text=True)
    return json.loads(out.strip().splitlines()[-1])

_comp_cache = {}
def comps(g):
    if g not in _comp_cache:
        _comp_cache[g] = components(despill(Image.open(os.path.join(RAW, g + '.png'))))
    return _comp_cache[g]

# ---------------- tablet glyphs ----------------
S = 4                       # supersampling
OL = (59, 36, 22, 255)
COL = {'plus': (124, 196, 78, 255), 'minus': (226, 72, 61, 255), 'ignore': (244, 166, 59, 255),
       'max': (255, 214, 77, 255), 'double': (176, 124, 236, 255), 'copy': (95, 205, 228, 255)}

def arrow(d, cx, cy, ang, length, width, color, heads=1):
    """chunky outlined arrow from (cx,cy) along ang; heads = number of stacked chevron heads"""
    ux, uy = math.cos(ang), math.sin(ang); px, py = -uy, ux
    hl = width * 1.25; hw = width * 1.25
    tip = length
    shaft_end = tip - hl * (1 + 0.55 * (heads - 1))
    start = width * 0.9
    def P(a, b): return (cx + ux * a + px * b, cy + uy * a + py * b)
    polys = []
    if shaft_end > start:
        polys.append([P(start, -width / 2), P(shaft_end + 2, -width / 2), P(shaft_end + 2, width / 2), P(start, width / 2)])
    for h in range(heads):
        t = tip - h * hl * 0.55
        polys.append([P(t, 0), P(t - hl, -hw), P(t - hl, hw)])
    o = 3 * S
    for poly in polys:  # outline pass
        d.polygon(poly, fill=OL)
        d.line(poly + [poly[0]], fill=OL, width=o * 2, joint='curve')
    for poly in polys:
        d.polygon(poly, fill=color)

def arc_arrow(d, cx, cy, ang, length, width, color, heads=1):
    """curved 'hop' arrow for targets two cells away"""
    ux, uy = math.cos(ang), math.sin(ang); px, py = uy, -ux   # bulge to the left of travel (up for a rightward arrow)
    sx, sy = cx + ux * width * 0.6, cy + uy * width * 0.6
    ex, ey = cx + ux * length, cy + uy * length
    kx, ky = (sx + ex) / 2 + px * length * 0.75, (sy + ey) / 2 + py * length * 0.75
    hl = width * 1.25
    pts = []
    N = 24
    for i in range(N + 1):
        t = i / N * 0.80
        x = (1 - t) ** 2 * sx + 2 * (1 - t) * t * kx + t * t * ex; y = (1 - t) ** 2 * sy + 2 * (1 - t) * t * ky + t * t * ey
        pts.append((x, y))
    # head: tangent at t=1
    tx, ty = ex - kx, ey - ky; tl = math.hypot(tx, ty); tx, ty = tx / tl, ty / tl; nx, ny = -ty, tx
    bx, by = ex - tx * hl * 1.1, ey - ty * hl * 1.1
    head = [(ex, ey), (bx + nx * hl, by + ny * hl), (bx - nx * hl, by - ny * hl)]
    o = 3 * S
    d.line(pts, fill=OL, width=int(width + 2 * o), joint='curve'); d.polygon(head, fill=OL); d.line(head + [head[0]], fill=OL, width=o * 2, joint='curve')
    for q in (pts[0], pts[-1]):
        r = (width + 2 * o) / 2; d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=OL)
    d.line(pts, fill=color, width=int(width), joint='curve'); d.polygon(head, fill=color)
    r = width / 2; q = pts[0]; d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=color)

def star(d, x, y, r, color):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5; rr = r if i % 2 == 0 else r * 0.45
        pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr))
    d.polygon(pts, fill=OL); d.line(pts + [pts[0]], fill=OL, width=3 * S * 2, joint='curve'); d.polygon(pts, fill=color)

def ring(d, x, y, r, color):
    d.ellipse([x - r - 3 * S, y - r - 3 * S, x + r + 3 * S, y + r + 3 * S], fill=OL)
    d.ellipse([x - r, y - r, x + r, y + r], fill=color)
    ri = r * 0.45; d.ellipse([x - ri - 2 * S, y - ri - 2 * S, x + ri + 2 * S, y + ri + 2 * S], fill=OL)

FONT = None
def font(px):
    for f in ['/workspace/projects/64c57e1c-4a89-46cb-9149-73ad88e2e422/thap-sao/public/assets/fonts/Baloo2.ttf',
              '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']:
        if os.path.exists(f):
            try:
                ft = ImageFont.truetype(f, px)
                try: ft.set_variation_by_axes([800])
                except Exception: pass
                return ft
            except Exception: pass
    return ImageFont.load_default()

def tablet_icon(t, slab_img):
    shape = t['shape']; xs = [c[0] for c in shape]; ys = [c[1] for c in shape]
    w = max(xs) - min(xs) + 1; h = max(ys) - min(ys) + 1
    W = SIZE * S
    cell = int(W * 0.94 / max(w, h)); ox = (W - cell * w) // 2; oy = (W - cell * h) // 2
    canvas = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    if len(shape) == 1:
        slab = fit(trim(slab_img), cell - 6 * S, cell - 6 * S)
        canvas.alpha_composite(slab, (ox + (cell - slab.width) // 2, oy + (cell - slab.height) // 2))
    else:   # one long slab covering the whole footprint (rect footprints only)
        slab = trim(slab_img).resize((cell * w - 6 * S, cell * h - 6 * S), Image.LANCZOS)
        canvas.alpha_composite(slab, (ox + 3 * S, oy + 3 * S))
    centers = {}
    for (cx_, cy_) in shape:
        x0 = ox + (cx_ - min(xs)) * cell; y0 = oy + (cy_ - min(ys)) * cell
        centers[(cx_, cy_)] = (x0 + cell / 2, y0 + cell / 2)
    d = ImageDraw.Draw(canvas)
    # group ops by target cell
    groups = {}
    for tg in t['targets']:
        groups.setdefault(tuple(tg['at']), []).append(tg['op'])
    scale = cell / (SIZE * S * 0.94)          # 1 for 1x1, 0.5 for 1x2
    for at, ops in sorted(groups.items(), key=lambda kv: -max(abs(kv[0][0]), abs(kv[0][1]))):
        src = min(shape, key=lambda c: (max(abs(at[0] - c[0]), abs(at[1] - c[1])), abs(at[0] - c[0]) + abs(at[1] - c[1])))
        dx, dy = at[0] - src[0], at[1] - src[1]; dist = max(abs(dx), abs(dy))
        ang = math.atan2(dy, dx); cx, cy = centers[tuple(src)]
        diag = dx != 0 and dy != 0
        L = (cell * (0.40 if not diag else 0.47)) * (1 if dist == 1 else 1.0)
        width = cell * 0.13
        lvl = [o for o in ops if o['op'] == 'level']
        kind = 'plus'; heads = 1
        if lvl:
            amt = sum(o['amount'] for o in lvl); kind = 'plus' if amt > 0 else 'minus'; heads = min(3, abs(amt))
        elif ops[0]['op'] == 'ignoreConstraint': kind = 'ignore'
        elif ops[0]['op'] == 'maxLevel': kind = 'max'
        elif ops[0]['op'] == 'doubleTags': kind = 'double'
        elif ops[0]['op'] == 'copy': kind = 'copy'
        if dist >= 2: arc_arrow(d, cx, cy, ang, L, width * 0.85, COL[kind], heads)
        else: arrow(d, cx, cy, ang, L, width, COL[kind], heads)
        tipx, tipy = cx + math.cos(ang) * L * 0.55, cy + math.sin(ang) * L * 0.55
        if any(o['op'] == 'maxLevel' for o in ops) and lvl:   # ascend: level + star
            star(d, cx + math.cos(ang + 0.9) * L * 0.62, cy + math.sin(ang + 0.9) * L * 0.62, width * 0.95, COL['max'])
        if kind == 'max':
            star(d, cx + math.cos(ang) * L * 0.98, cy + math.sin(ang) * L * 0.98, width * 1.05, COL['max'])
        if kind == 'ignore':
            ring(d, tipx, tipy, width * 0.75, COL['ignore'])
    # centre badge
    for (c, (cx, cy)) in centers.items():
        kinds = {tg['op']['op'] for tg in t['targets']}
        r = cell * 0.11
        if 'doubleTags' in kinds or 'copy' in kinds:
            r = cell * 0.17
        d.ellipse([cx - r - 3 * S, cy - r - 3 * S, cx + r + 3 * S, cy + r + 3 * S], fill=OL)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(241, 222, 181, 255))
        if 'doubleTags' in kinds or 'copy' in kinds:
            label = '×2' if 'doubleTags' in kinds else '⧉'
            if label == '⧉':  # two overlapping squares
                q = r * 0.5
                for off in (-q * 0.45, q * 0.45):
                    d.rectangle([cx + off - q, cy + off - q, cx + off + q, cy + off + q], fill=COL['copy'], outline=OL, width=2 * S)
            else:
                ft = font(int(r * 1.35)); bb = d.textbbox((0, 0), label, font=ft)
                d.text((cx - (bb[0] + bb[2]) / 2, cy - (bb[1] + bb[3]) / 2), label, font=ft, fill=(118, 72, 196, 255))
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)

def main():
    data = dump_data()
    frames = {}
    have = {}
    for g, m in MAP.items():
        cs = comps(g)
        for idx, aid in m.items():
            have[aid] = cs[idx]['img']
    missing = [a['id'] for a in data['artifacts'] if a['id'] not in have]
    if missing: raise SystemExit(f'missing artifact art: {missing}')
    for a in data['artifacts']:
        frames[a['icon']] = to_cell(have[a['id']], SIZE, 2, 3)
    slab_imgs = {r: comps(g)[i]['img'] for r, (g, i) in SLABS.items()}
    for t in data['tablets']:
        frames[t['icon']] = tablet_icon(t, slab_imgs[t['rarity']])
    # atlas
    names = list(frames.keys()); cols = 12; rows = (len(names) + cols - 1) // cols
    atlas = Image.new('RGBA', (cols * SIZE, rows * SIZE), (0, 0, 0, 0)); meta = {}
    for i, n in enumerate(names):
        x, y = (i % cols) * SIZE, (i // cols) * SIZE
        atlas.alpha_composite(frames[n], (x, y)); frames[n].save(os.path.join(OUT_FR, n + '.png'))
        meta[n] = {'frame': {'x': x, 'y': y, 'w': SIZE, 'h': SIZE}, 'rotated': False, 'trimmed': False,
                   'spriteSourceSize': {'x': 0, 'y': 0, 'w': SIZE, 'h': SIZE}, 'sourceSize': {'w': SIZE, 'h': SIZE}}
    sp = os.path.join(ROOT, 'public', 'assets', 'sprites'); os.makedirs(sp, exist_ok=True)
    atlas.save(os.path.join(sp, 'icons_items.png'), optimize=True)
    json.dump({'frames': meta, 'meta': {'app': 'thap-sao art/tools/build_icons.py', 'version': '1.0', 'image': 'icons_items.png',
               'format': 'RGBA8888', 'size': {'w': atlas.width, 'h': atlas.height}, 'scale': '1'}},
              open(os.path.join(sp, 'icons_items.json'), 'w'), indent=1)
    # manifest (own file only)
    mp = os.path.join(ROOT, 'public', 'assets', 'manifest.icons.json')
    man = json.load(open(mp)) if os.path.exists(mp) else {}
    man['icons_items'] = {'type': 'atlas', 'file': 'sprites/icons_items.png', 'atlas': 'sprites/icons_items.json'}
    json.dump(man, open(mp, 'w'), indent=1)
    # contact sheet: cream card background, 48px preview + 96px
    sheet_cols = 12; cellw, cellh = 120, 150
    rows = (len(names) + sheet_cols - 1) // sheet_cols
    sh = Image.new('RGB', (sheet_cols * cellw, rows * cellh), (255, 244, 220)); d = ImageDraw.Draw(sh); ft = font(12)
    for i, n in enumerate(names):
        x, y = (i % sheet_cols) * cellw, (i // sheet_cols) * cellh
        d.rectangle([x + 2, y + 2, x + cellw - 3, y + cellh - 3], outline=(205, 176, 131), width=1)
        sh.paste(frames[n], (x + 12, y + 6), frames[n])
        small = frames[n].resize((48, 48), Image.LANCZOS); sh.paste(small, (x + 66, y + 100), small)
        d.text((x + 4, y + 104), n.replace('art_', '').replace('tab_', 't:')[:11], fill=(59, 36, 22), font=ft)
    os.makedirs(os.path.join(ROOT, 'art', 'sheets'), exist_ok=True)
    sh.save(os.path.join(ROOT, 'art', 'sheets', 'icons_items_sheet.png'))
    print(f'frames: {len(names)} ({len(data["artifacts"])} artifacts, {len(data["tablets"])} tablets); atlas {atlas.size}')

if __name__ == '__main__':
    main()
