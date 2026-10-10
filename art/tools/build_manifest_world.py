"""Merge world records -> public/assets/manifest.world.json (only file of the shared manifests this agent writes)."""
from wlib import *
M={}
for f in ['_tiles_rec.json','_world_rec.json','_fx_rec.json','_ui_rec.json']:
    p=os.path.join(ART,'tools',f)
    if os.path.exists(p): M.update(json.load(open(p)))
M['icons_ui']=dict(type='atlas',file='sprites/icons_ui.png',atlas='sprites/icons_ui.json',scale=0.5,anchor=[0.5,0.5],
                   desc='96px frames shown at 48px; frame names ic_*, node_*, mod_*, combo_*, st_<StatKey>, btn_*, pot_*, mir_1..8, wic_<WeaponId>')
for k,v in M.items():
    v.pop('size',None)
REQ=['ts_hub']+[f'ts_ch{i}' for i in range(1,7)]+[f'prop_ch{i}_breakable' for i in range(1,7)]+['prop_cracked_wall',
 'hub_destiny_tree','hub_house','hub_tent_smith','hub_wardrobe','hub_weapon_rack','hub_mirror','hub_journal_stand','hub_training_dummy','hub_portal',
 'hub_campfire','hub_pond','hub_tree_a','hub_tree_b','hub_bush_berry','hub_mushrooms','hub_rock',
 'door_closed','door_open','door_boss','chest_money','altar_enchant_s','altar_enchant_m','altar_enchant_l','anvil','orb_levelup','heart_green',
 'dice_pickup','roots_tree','shop_stall','merchant_rat','obelisk','fountain_green','fountain_gold','fountain_red','blood_altar','pocket_portal','clover','training_dummy','portal_exit',
 'fx_slash_small','fx_slash_big','fx_thrust','fx_hit','fx_crit','fx_dash_dust','fx_explosion','fx_burn','fx_freeze','fx_shock','fx_poison','fx_heal','fx_levelup','fx_spawn',
 'fx_telegraph_circle','fx_telegraph_line','pj_bolt','pj_orb_magic','pj_enemy_orb','pj_enemy_arrow','pj_fireball','pj_icebolt','pj_lightning','pj_bomb','pj_star',
 'ui_btn_orange','ui_btn_green','ui_btn_red','ui_btn_wood','ui_btn_purple','ui_card_cream','ui_pill_dark','ui_bar_track','ui_bar_hp','ui_bar_mp','ui_bar_xp',
 'ui_cell','ui_cell_hi','ui_cell_bad','ui_panel_dark','ui_badge_red','ui_joystick_base','ui_joystick_knob','ui_rarity_frame_common','ui_rarity_frame_rare',
 'ui_rarity_frame_epic','ui_rarity_frame_legendary','ui_star_on','ui_star_off','icons_ui']
missing=[k for k in REQ if k not in M]
for ch in range(1,7):
    n=len([k for k in M if k.startswith(f'prop_ch{ch}_') and k!=f'prop_ch{ch}_breakable'])
    assert n>=8,(ch,n)
for k,v in M.items():
    for fk in ('file','atlas'):
        if fk in v: assert os.path.exists(os.path.join(PUB,v[fk])),(k,v[fk])
icons=json.load(open(os.path.join(SPR,'icons_ui.json')))['frames']
need=['ic_money','ic_sapphire','ic_dice','ic_hp','ic_mp','ic_dash']+[f'node_{n}' for n in 'levelup artifact enchant tablet money heart anvil dice shop roots boss start'.split()]+['mod_derangement','mod_miniboss']+\
 [f'combo_{c}' for c in 'glacier ember storm guardian shadow lake windsong academy companion curse'.split()]+[f'btn_{b}' for b in 'attack dash special potion bag pause rotate sell reroll map'.split()]+\
 [f'pot_{p}' for p in 'heal rage iron swift mystery mana'.split()]+[f'mir_{i}' for i in range(1,9)]+[f'wic_{w}' for w in 'swordshield greatsword dagger katana crossbow staff'.split()]+\
 ['st_'+s for s in 'maxHp maxMp mpRegen physical fire ice lightning magic defense evasion critChance critDamage attackSpeed moveSpeed dashCount dashRecovery luck barter lifesteal damagePct cooldownPct'.split()]
mi=[n for n in need if n not in icons]
json.dump(dict(sorted(M.items())),open(os.path.join(PUB,'manifest.world.json'),'w'),indent=1,ensure_ascii=False)
ml=json.load(open(os.path.join(PUB,'manifests.json')))
print('keys',len(M),'missing required',missing,'missing icons',mi,'icons',len(icons),'manifests.json has world:', 'manifest.world.json' in ml)
