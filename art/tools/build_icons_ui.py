"""icons_ui atlas (Phaser JSON-hash), 96x96 frames (shown at 48 -> scale 0.5)."""
from wlib import *
C={k:components(despill(load(f'icons_{k}.png')),800,4) for k in 'abcde'}
M={ # frame name: (sheet, index)
 'ic_money':('a',0),'ic_sapphire':('a',1),'ic_dice':('a',2),'ic_hp':('a',3),'ic_mp':('a',9),'ic_dash':('a',10),
 'node_levelup':('a',11),'node_artifact':('a',12),'node_enchant':('a',13),'node_tablet':('d',21),'node_money':('a',19),
 'node_heart':('a',8),'node_anvil':('a',21),'node_dice':('a',22),'node_shop':('a',23),'node_roots':('a',16),
 'node_boss':('b',0),'node_start':('b',1),'mod_derangement':('b',2),'mod_miniboss':('b',3),
 'combo_glacier':('b',4),'combo_ember':('b',5),'combo_storm':('b',6),'combo_guardian':('b',11),'combo_shadow':('b',12),
 'combo_lake':('b',13),'combo_windsong':('b',14),'combo_academy':('b',7),'combo_companion':('b',20),'combo_curse':('b',21),
 'btn_attack':('b',22),'btn_special':('b',23),'btn_dash':('a',10),'btn_potion':('c',0),'btn_bag':('c',10),'btn_pause':('c',11),
 'btn_rotate':('c',12),'btn_sell':('c',13),'btn_reroll':('c',18),'btn_map':('c',15),
 'pot_heal':('c',0),'pot_rage':('c',1),'pot_iron':('c',2),'pot_swift':('c',3),'pot_mystery':('c',8),'pot_mana':('c',9),
 'wic_swordshield':('c',20),'wic_greatsword':('c',21),'wic_dagger':('c',22),'wic_katana':('c',23),'wic_crossbow':('d',22),'wic_staff':('d',23),
}
STATS=['maxHp','maxMp','mpRegen','physical','fire','ice','lightning','magic','defense','evasion','critChance','critDamage',
       'attackSpeed','moveSpeed','dashCount','dashRecovery','luck','barter','lifesteal','damagePct','cooldownPct']
for i,s in enumerate(STATS): M[f'st_{s}']=('d',i)
for i in range(8): M[f'mir_{i+1}']=('e',i)
HOLE_FILL={'node_heart':(126,206,96),'st_luck':(110,190,80)}
def fillholes(im,color):
    a=np.array(im); al=a[...,3]>40; holes=ndimage.binary_fill_holes(al)&~al
    holes=ndimage.binary_dilation(holes,iterations=1)&~(a[...,3]>200); a[holes]=list(color)+[255]
    return Image.fromarray(a,'RGBA')
F=96; names=list(M.keys()); cols=12; rows=(len(names)+cols-1)//cols
atlas=Image.new('RGBA',(cols*F,rows*F),(0,0,0,0)); frames={}
for i,n in enumerate(names):
    s,k=M[n]; im=trim(C[s][k]['img'])
    if n in HOLE_FILL: im=fillholes(im,HOLE_FILL[n])
    if n=='node_heart': im=trim(Image.open(os.path.join(SPR,'heart_green.png')).convert('RGBA'))
    if n=='btn_attack':  # crossed greatswords (generated version carried a letter-like rune)
        g=fit(trim(C['c'][21]['img']),F-14,F-14); cv=Image.new('RGBA',(F,F),(0,0,0,0))
        cv.alpha_composite(g,((F-g.width)//2,(F-g.height)//2)); cv.alpha_composite(g.transpose(Image.FLIP_LEFT_RIGHT),((F-g.width)//2,(F-g.height)//2)); im=trim(cv)
    im=fit(im,F-8,F-8); x=(i%cols)*F; y=(i//cols)*F
    atlas.alpha_composite(im,(x+(F-im.width)//2,y+(F-im.height)//2))
    frames[n]={'frame':{'x':x,'y':y,'w':F,'h':F},'rotated':False,'trimmed':False,'spriteSourceSize':{'x':0,'y':0,'w':F,'h':F},'sourceSize':{'w':F,'h':F}}
atlas.save(os.path.join(SPR,'icons_ui.png'))
json.dump({'frames':frames,'meta':{'app':'thap-sao art-world','image':'icons_ui.png','format':'RGBA8888','size':{'w':atlas.width,'h':atlas.height},'scale':'1'}},open(os.path.join(SPR,'icons_ui.json'),'w'),indent=1)
# labelled preview
labeled([dict(img=atlas.crop((frames[n]['frame']['x'],frames[n]['frame']['y'],frames[n]['frame']['x']+F,frames[n]['frame']['y']+F))) for n in names],os.path.join(ART,'sheets','icons_ui_preview.png'),110,12)
d=ImageDraw.Draw(p:=Image.open(os.path.join(ART,'sheets','icons_ui_preview.png')))
for i,n in enumerate(names): d.text(((i%12)*110+4,(i//12)*110+96),n,fill=(40,40,40),font=font(10,'Bold'))
p.save(os.path.join(ART,'sheets','icons_ui_preview.png'))
print(len(names),'icons')
