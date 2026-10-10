"""Compose engine-like mockups from the delivered assets: art/sheets/mockup_hub_1280x720.png and mockup_room_ch1..6.png.
Rendered on a 2x canvas (world sprites are stored at 2x) then downsampled to 1280x720."""
from wlib import *
import math, random
K=2; W,H=1280*K,720*K; T=96
MAN=json.load(open(os.path.join(PUB,'manifest.world.json')))
CH=json.load(open(os.path.join(ART,'tools','_chars_rec.json'))) if os.path.exists(os.path.join(ART,'tools','_chars_rec.json')) else {}
_cache={}
def img(key):
    if key in _cache: return _cache[key]
    e=MAN[key]; im=Image.open(os.path.join(PUB,e['file'])).convert('RGBA'); _cache[key]=im; return im
def frame(key,i=0,src=None):
    e=(src or MAN)[key]; im=Image.open(os.path.join(PUB,e['file'])).convert('RGBA')
    if e['type']=='sheet':
        fw,fh=e['frameW'],e['frameH']; cols=im.width//fw; return im.crop(((i%cols)*fw,(i//cols)*fh,(i%cols)*fw+fw,(i//cols)*fh+fh))
    return im
def put(c,im,x,y,anchor=(0.5,1.0),scale=1.0):
    if scale!=1.0: im=im.resize((max(1,int(im.width*scale)),max(1,int(im.height*scale))),Image.LANCZOS)
    c.alpha_composite(im,(int(x*K-im.width*anchor[0]),int(y*K-im.height*anchor[1])))
def shadow(c,x,y,w,h=None,a=70):
    h=h or w*0.35; s=Image.new('RGBA',(int(w*K)+20,int(h*K)+20),(0,0,0,0)); ImageDraw.Draw(s).ellipse((10,10,10+w*K,10+h*K),fill=(40,24,12,a))
    s=s.filter(ImageFilter.GaussianBlur(4)); c.alpha_composite(s,(int(x*K-s.width/2),int(y*K-s.height/2)))
def obj(c,key,x,y,i=0,sh=None):
    e=MAN[key]; im=frame(key,i); a=e.get('anchor',[0.5,1.0])
    if sh: shadow(c,x,y,sh)
    put(c,im,x,y,a)
def char(c,key,x,y,flip=False,anim='idle',fi=0):
    if key not in CH: return False
    e=CH[key]; im=Image.open(os.path.join(PUB,e['file'])).convert('RGBA'); fw,fh=e['frameW'],e['frameH']; cols=im.width//fw
    idx=e.get('anims',{}).get(anim,{}).get('frames',[0])[fi] if e.get('anims') else 0
    fr=im.crop(((idx%cols)*fw,(idx//cols)*fh,(idx%cols)*fw+fw,(idx//cols)*fh+fh))
    if flip: fr=fr.transpose(Image.FLIP_LEFT_RIGHT)
    s=e.get('scale',0.5)/0.5; a=e.get('anchor',[0.5,0.92]); bb=fr.getbbox()
    shadow(c,x,y,max(28,(bb[2]-bb[0])*s/K*0.7) if bb else 30)
    put(c,fr,x,y,a,scale=s); return True
# ---------------- UI helpers (1x design coords, @2x files)
def ui(n): return Image.open(os.path.join(PUB,'ui',n+'@2x.png')).convert('RGBA')
def nine(n,w,h):
    im=ui(n); l,r,t,b=[v*K for v in MAN[n]['nine']]; w,h=int(w*K),int(h*K); iw,ih=im.size
    out=Image.new('RGBA',(w,h),(0,0,0,0))
    for sx0,sx1,dx0,dx1 in [(0,l,0,l),(l,iw-r,l,w-r),(iw-r,iw,w-r,w)]:
        for sy0,sy1,dy0,dy1 in [(0,t,0,t),(t,ih-b,t,h-b),(ih-b,ih,h-b,h)]:
            if dx1>dx0 and dy1>dy0: out.alpha_composite(im.crop((sx0,sy0,sx1,sy1)).resize((dx1-dx0,dy1-dy0),Image.LANCZOS),(dx0,dy0))
    return out
ICO=Image.open(os.path.join(SPR,'icons_ui.png')).convert('RGBA'); ICJ=json.load(open(os.path.join(SPR,'icons_ui.json')))['frames']
def icon(n,size):
    f=ICJ[n]['frame']; im=ICO.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h'])); return im.resize((int(size*K),int(size*K)),Image.LANCZOS)
def txt(c,xy,s,sz,fill='#FFFFFF',stroke='#3B2416',sw=3,anchor='lm',w='ExtraBold'):
    ImageDraw.Draw(c).text((xy[0]*K,xy[1]*K),s,font=font(int(sz*K),w),fill=fill,stroke_width=int(sw*K) if stroke else 0,stroke_fill=stroke,anchor=anchor)
def tl(c,im,x,y): c.alpha_composite(im,(int(x*K),int(y*K)))
def pill(c,x,y,w,ic,val,plus=True):
    tl(c,nine('ui_pill_dark',w,40),x,y); put(c,icon(ic,42),x+14,y+19,(0.5,0.5)); txt(c,(x+40,y+18),val,21)
    if plus: tl(c,ui('ui_btn_plus'),x+w-35,y+4)
def bigbtn(c,x,y,ic,label,col='ui_btn_orange',w=104,h=92,badge=None):
    tl(c,nine(col,w,h),x,y); put(c,icon(ic,50),x+w/2,y+36,(0.5,0.5)); txt(c,(x+w/2,y+71),label,15,anchor='mm')
    if badge: put(c,ui('ui_badge_red'),x+w-8,y+6,(0.5,0.5)); txt(c,(x+w-8,y+5),badge,15,anchor='mm',sw=2)
def bar(c,x,y,w,fill,frac,ic,label):
    tl(c,nine('ui_bar_track',w,22),x,y); fw=max(18,int((w-6)*frac)); tl(c,nine(fill,fw,16),x+3,y+3)
    put(c,icon(ic,34),x-4,y+11,(0.5,0.5)); txt(c,(x+w/2+8,y+11),label,13,anchor='mm',sw=2.5)
def finish(c,path):
    out=c.convert('RGB').resize((1280,720),Image.LANCZOS); out.save(path); print('wrote',path)
# ---------------- tiles
def tile(ts,i):
    im=img(ts); return im.crop(((i%8)*T,(i//8)*T,(i%8)*T+T,(i//8)*T+T))
def ground(c,ts,grid,rng,dec_p=0.10):
    """grid[r][col]: 'f' floor,'l' liquid,'w' wall (resolved), returns nothing"""
    R=len(grid); C=len(grid[0])
    g=lambda r,q: grid[r][q] if 0<=r<R and 0<=q<C else 'x'
    for r in range(R):
        for q in range(C):
            t=grid[r][q]; x,y=q*T,r*T
            if t=='f':
                c.alpha_composite(tile(ts,int(rng.choice([0,0,0,0,1,2,3,4,5,7] if ts=='ts_ch5' else [0,0,1,2,3,4,5,6,7]))),(x,y))
                if rng.random()<dec_p: c.alpha_composite(tile(ts,8+int(rng.integers(0,8))),(x,y))
            elif t=='l':
                n,s,w_,e=g(r-1,q)=='f',g(r+1,q)=='f',g(r,q-1)=='f',g(r,q+1)=='f'
                if n and w_: i=30
                elif n and e: i=31
                elif n: i=26
                elif s: i=27
                elif w_: i=28
                elif e: i=29
                else: i=24 if rng.random()<0.7 else 25
                c.alpha_composite(tile(ts,i),(x,y))
            elif t in 'TUDEWNab':
                i={'T':16,'E':17,'W':18,'N':19,'a':20,'b':21,'U':22,'D':23}[t]; c.alpha_composite(tile(ts,i),(x,y))
# ================= HUB
def hub():
    rng=np.random.default_rng(4); c=Image.new('RGBA',(W,H),(47,111,176,255))
    C,R=27,15
    # island mask (organic blob, then tile-quantised)
    yy,xx=np.mgrid[0:R,0:C]
    m=((xx-13.2)/12.6)**2+((yy-7.4)/7.4)**2<1.0
    m[0,:]=False; m[:,0]=False; m[:,26]=False; m[14,:]=False
    m[1,:4]=False; m[1,22:]=False; m[13,:3]=False; m[13,23:]=False; m[2,:2]=False; m[2,25:]=False; m[12,:1]=False
    m[13,11:15]=True; m[14,12:14]=True  # little jetty to the bottom
    grid=[['f' if m[r,q] else 'l' for q in range(C)] for r in range(R)]
    ground(c,'ts_hub',grid,rng,dec_p=0.16)
    # big ochre dirt patches like the reference (decals)
    for k,x,y in [('hub_dirt_a',640,470),('hub_dirt_b',330,330),('hub_dirt_a',985,345),('hub_dirt_b',700,610),('hub_dirt_b',170,470)]:
        put(c,img(k),x,y,(0.5,0.5))
    put(c,img('hub_pond'),250,600,(0.5,0.6))
    L=[]  # (y, draw)
    def add(key,x,y,i=0,sh=None): L.append((y,lambda c=c,key=key,x=x,y=y,i=i,sh=sh: obj(c,key,x,y,i,sh)))
    def addc(key,x,y,flip=False): L.append((y,lambda: char(c,key,x,y,flip)))
    add('hub_destiny_tree',640,300,sh=150)
    add('hub_house',285,262,1,sh=150); add('hub_tent_smith',990,300,sh=120)
    add('hub_wardrobe',440,300,sh=50); add('hub_mirror',515,318,sh=44)
    add('hub_weapon_rack',1050,500,sh=60); add('hub_training_dummy',1145,470,sh=36)
    add('hub_journal_stand',480,470,sh=40); add('hub_campfire',640,478,sh=70)
    add('hub_portal',845,600,sh=110)
    for k,x,y in [('hub_tree_a',95,215),('hub_tree_b',175,160),('hub_tree_c',1180,230),('hub_tree_a',1215,380),('hub_tree_b',800,150),('hub_tree_a',470,150),('hub_tree_c',90,420),('hub_tree_b',1130,640),('hub_tree_a',380,680)]:
        add(k,x,y,sh=70)
    for k,x,y in [('hub_bush_berry',735,310),('hub_bush_berry',560,640),('hub_bush_berry',1180,560),('hub_mushrooms',150,300),('hub_mushrooms',905,450),('hub_rock',120,610),('hub_rock',1000,640),('hub_rock',360,560),
                  ('hub_flowers',540,385),('hub_flowers',760,420),('hub_flowers',310,430),('hub_flowers',1090,420),('hub_mushrooms',705,665)]:
        add(k,x,y,sh=26)
    addc('npc_elder',560,290); addc('npc_smith',915,330,True); addc('npc_tailor',395,330); addc('npc_trainer',1110,520,True)
    addc('npc_bard',700,500,True); addc('npc_sleeper',585,505); addc('npc_merchant',230,470); addc('hero_bong',640,560)
    addc('cmp_sprout',600,575)
    for r in range(1,R-1):
        for q in range(1,C-1):
            if m[r,q] and ((not m[r-1,q] and not m[r,q-1]) or (not m[r-1,q] and not m[r,q+1]) or (not m[r+1,q] and not m[r,q-1]) or (not m[r+1,q] and not m[r,q+1])):
                x=q*48+24+(-14 if not m[r,q-1] else 14 if not m[r,q+1] else 0); y=r*48+40
                if 120<x<1160 and y<600 and y>90: add(['hub_rock','hub_bush_berry','hub_mushrooms'][int(rng.integers(0,3))],x,y,sh=26)
    for y,f in sorted(L,key=lambda t:t[0]): f()
    # HUD (reference layout language)
    pill(c,18,14,150,'ic_money','1.250'); pill(c,178,14,130,'ic_sapphire','36'); pill(c,318,14,110,'ic_dice','2',plus=False)
    tl(c,nine('ui_btn_wood',56,56),1206,12); put(c,icon('btn_pause',34),1234,38,(0.5,0.5))
    for i,(ic,lb,bd) in enumerate([('node_artifact','Nhật Ký','!'),('mod_derangement','Thử Thách',None)]):
        y=124+76*i; tl(c,nine('ui_btn_purple',60,60),1208,y); put(c,icon(ic,38),1238,y+26,(0.5,0.5)); txt(c,(1238,y+50),lb,11,anchor='mm',sw=2)
        if bd: put(c,ui('ui_badge_red'),1262,y+4,(0.5,0.5)); txt(c,(1262,y+3),bd,15,anchor='mm',sw=2)
    # area name tag
    tl(c,nine('ui_card_header',180,40),550,14); txt(c,(640,33),'LÀNG MÂY',18,anchor='mm')
    btns=[('btn_bag','Túi Đồ',None),('wic_swordshield','Vũ Khí',None),('st_critChance','Tài Năng','3'),('combo_companion','Trang Phục',None),('node_levelup','Cây Sao','!')]
    x0=640-(5*104+4*14+180+14)/2
    tl(c,nine('ui_panel_dark',5*104+4*14+180+14+28,108),x0-14,608)
    for i,(ic,lb,bd) in enumerate(btns): bigbtn(c,x0+i*118,616,ic,lb,badge=bd)
    gx=x0+5*118; tl(c,nine('ui_btn_green',180,92),gx,616); put(c,frame('hub_portal').resize((70,70),Image.LANCZOS) if False else icon('node_start',48),gx+44,656,(0.5,0.5)); txt(c,(gx+112,650),'BẮT ĐẦU',20,anchor='mm'); txt(c,(gx+112,676),'Vào Tháp',13,anchor='mm',sw=2)
    finish(c,os.path.join(ART,'sheets','mockup_hub_1280x720.png'))
# ================= ROOMS
ROOM={1:dict(props=['tree','stump','boulder','log','mushrooms','bramble','lantern','stones'],obj=[('chest_money',0),('altar_enchant_s',0)],en=['en_slime_moss','en_mushroom_spore','en_beetle_charger'],name='RỪNG RÊU',pj='pj_enemy_orb'),
      2:dict(props=['spire','minecart','crates','rubble','crystals','support','deadbush','barrel_flag'],obj=[('shop_stall',0),('merchant_rat',0)],en=['en_rat_bandit','en_rat_bomber','en_rat_shield'],name='MỎ ĐÁ ĐỎ',pj='pj_bomb'),
      3:dict(props=['bookshelf','shelf_round','bookstack','desk','globe','candelabra','floating_rock','armchair'],obj=[('altar_enchant_l',0),('obelisk',0)],en=['en_book_flyer','en_candle_mage','en_ink_blob'],name='THƯ VIỆN BAY',pj='pj_enemy_orb'),
      4:dict(props=['ice_pillar','pine','snow_boulder','ice_crystals','snowman','signpost','fish_barrel','frost_bush'],obj=[('fountain_green',0),('heart_green',0)],en=['en_penguin_slider','en_ice_spirit','en_frost_wolf'],name='HỒ BĂNG',pj='pj_icebolt'),
      5:dict(props=['boiler','pipe_valve','gears','barrels','workbench','chimney','parts_crate','lamp'],obj=[('anvil',0),('dice_pickup',0)],en=['en_gear_bot','en_steam_turret','en_raccoon_mechanic'],name='XƯỞNG MÁY HƠI',pj='pj_enemy_orb'),
      6:dict(props=['crystal','moon_rock','pillar','meteorite','brazier','ring_statue','crystal_flowers','glow_mushrooms'],obj=[('blood_altar',0),('roots_tree',0)],en=['en_star_shard','en_void_eye','en_comet_hound'],name='LÕI SAO',pj='pj_star')}
def room(ch):
    rng=np.random.default_rng(10+ch); c=Image.new('RGBA',(W,H),(30,24,20,255)); C,R=27,15; ts=f'ts_ch{ch}'
    grid=[['f']*C for _ in range(R)]
    for q in range(C): grid[0][q]='T'; grid[1][q]='U'; grid[2][q]='D'; grid[14][q]='N'
    for r in range(R): grid[r][0]='E' if 0<r<14 else grid[r][0]; grid[r][26]='W' if 0<r<14 else grid[r][26]
    grid[0][0]=grid[1][0]=grid[2][0]=grid[0][26]=grid[1][26]=grid[2][26]='T'; grid[14][0]='a'; grid[14][26]='b'
    for r in range(9,13):
        for q in range(19,24): grid[r][q]='l'
    ground(c,ts,grid,rng,dec_p=0.06)
    put(c,frame('fx_telegraph_circle',1),880,505,(0.5,0.5),scale=0.9)
    S=ROOM[ch]; L=[]
    def add(key,x,y,i=0,sh=None): L.append((y,lambda key=key,x=x,y=y,i=i,sh=sh: obj(c,key,x,y,i,sh)))
    def addc(key,x,y,flip=False,anim='idle',fi=0): L.append((y,lambda: char(c,key,x,y,flip,anim,fi)))
    # door on north wall + cracked wall
    put(c,frame('door_closed'),640,146,(0.5,1.0)); put(c,frame('prop_cracked_wall'),1010,146,(0.5,1.0))
    P=[f'prop_ch{ch}_{n}' for n in S['props']]
    spots=[(110,300),(1180,290),(95,580),(250,215),(430,610),(1175,470),(830,205),(470,215)]
    for k,(x,y) in zip(P,spots): add(k,x,y,sh=50)
    for x,y in [(330,640),(372,662),(1215,640)]: add(f'prop_ch{ch}_breakable',x,y,0,sh=34)
    add(f'prop_ch{ch}_breakable',300,600,1)
    o1,o2=S['obj']; add(o1[0],260,420,sh=70)
    add(o2[0],380,440 if o2[0] not in('heart_green','dice_pickup') else 470,sh=40)
    for x,y in [(720,560),(745,575)]: add('heart_green' if ch!=4 else 'dice_pickup',x,y) if False else None
    addc('hero_bong',600,420,anim='attack',fi=2); 
    e=S['en']; addc(e[0],760,380,True); addc(e[1],880,520,True,anim='attack',fi=1); addc(e[2],700,300,True)
    for y,f in sorted(L,key=lambda t:t[0]): f()
    # fx overlays
    put(c,frame('fx_slash_small',3),640,400,(0.5,0.5))
    put(c,frame('fx_hit',2),735,360,(0.5,0.5))
    put(c,frame('fx_dash_dust',3),560,425,(0.7,0.75))
    put(c,frame(S['pj']),820,470,(0.5,0.5)); put(c,frame(S['pj'],1),780,450,(0.5,0.5))
    put(c,frame('pj_bolt'),520,330,(0.5,0.5)) if False else None
    put(c,frame('orb_levelup',2),470,520,(0.5,0.5))
    # HUD
    bar(c,40,16,210,'ui_bar_hp',0.72,'ic_hp','86/120'); bar(c,40,44,170,'ui_bar_mp',0.55,'ic_mp','33/60')
    for i in range(3): put(c,icon('ic_dash',26),36+i*28,84,(0.5,0.5)) if i<2 else put(c,icon('ic_dash',26).point(lambda v:v*0.45),36+i*28,84,(0.5,0.5))
    for i,cb in enumerate(['combo_ember','combo_guardian','combo_storm']):
        put(c,icon(cb,28),140+i*30,84,(0.5,0.5))
    pill(c,270,14,124,'ic_money','312',False); pill(c,404,14,104,'ic_sapphire','4',False); pill(c,518,14,90,'ic_dice','1',False)
    # minimap
    tl(c,nine('ui_panel_dark',230,128),1036,12); txt(c,(1151,30),f'{S["name"]}  {ch}-3',14,anchor='mm',sw=2.5)
    nodes=[(1066,92,'node_start'),(1106,70,'node_money'),(1106,112,'node_heart'),(1146,92,'node_levelup'),(1186,70,'node_shop'),(1186,112,'node_anvil'),(1230,92,'node_boss')]
    d=ImageDraw.Draw(c)
    for a,b in [(0,1),(0,2),(1,3),(2,3),(3,4),(3,5),(4,6),(5,6)]:
        d.line((nodes[a][0]*K,nodes[a][1]*K,nodes[b][0]*K,nodes[b][1]*K),fill=(255,240,210,140),width=3*K)
    for i,(x,y,n) in enumerate(nodes):
        if i==3: d.ellipse(((x-17)*K,(y-17)*K,(x+17)*K,(y+17)*K),fill=(255,214,90,200))
        put(c,icon(n,30 if i!=3 else 34),x,y,(0.5,0.5))
    # potion belt
    tl(c,nine('ui_panel_dark',4*60+18,78),14,628)
    for i,p in enumerate(['pot_heal','pot_mana','pot_swift',None]):
        tl(c,ui('ui_cell'),23+i*60,635)
        if p: put(c,icon(p,46),23+i*60+32,635+32,(0.5,0.5)); txt(c,(23+i*60+54,635+52),str(i+1),13,anchor='mm',sw=2)
    # action buttons
    bigbtn(c,1150,612,'btn_attack','Đánh'); bigbtn(c,1036,628,'btn_dash','Lướt',w=96,h=84) if False else None
    tl(c,nine('ui_btn_orange',84,78),1052,628); put(c,icon('btn_dash',44),1094,660,(0.5,0.5)); txt(c,(1094,690),'Lướt',13,anchor='mm',sw=2.5)
    tl(c,nine('ui_btn_purple',84,78),954,628); put(c,icon('btn_special',44),996,660,(0.5,0.5)); txt(c,(996,690),'Kỹ Năng',13,anchor='mm',sw=2.5)
    tl(c,nine('ui_btn_wood',56,56),1206,148); put(c,icon('btn_bag',36),1234,174,(0.5,0.5))
    finish(c,os.path.join(ART,'sheets',f'mockup_room_ch{ch}.png'))
import sys
which=sys.argv[1:] or ['hub','1','2','3','4','5','6']
for w in which:
    hub() if w=='hub' else room(int(w))
