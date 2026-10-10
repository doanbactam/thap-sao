"""Props, hub buildings, room objects -> public/assets/sprites/*.png  (stored 2x, scale 0.5, bottom-centre anchor)
Re-run: python3 build_world_sprites.py   (writes _world_rec.json used by build_manifest_world.py)"""
from wlib import *
import colorsys
os.makedirs(SPR,exist_ok=True)
REC={}
def sheet(name,merge=6,min_area=2500): return components(despill(load(name+'.png')),min_area,merge)
def save(key,im,h=None,w=None,st=2,anchor=(0.5,1.0),extra=None):
    """h/w = ON-SCREEN size in px; stored at 2x"""
    im=trim(im)
    if h and w: im=fit(im,w*2,h*2)
    elif h: im=fit(im,h=h*2)
    elif w: im=fit(im,w=w*2)
    if st: im=stroke(im,st)
    im.save(os.path.join(SPR,key+'.png'))
    r=dict(type='image',file=f'sprites/{key}.png',anchor=list(anchor),scale=0.5,size=[im.width,im.height])
    if extra: r.update(extra)
    REC[key]=r; return im
def frames_sheet(key,ims,anims=None,anchor=(0.5,1.0),pad=4):
    """ims already sized (stored px); pack horizontally into uniform frames aligned bottom-centre"""
    fw=max(i.width for i in ims)+2*pad; fh=max(i.height for i in ims)+2*pad
    sh=Image.new('RGBA',(fw*len(ims),fh),(0,0,0,0))
    for k,i in enumerate(ims): sh.alpha_composite(i,(k*fw+(fw-i.width)//2, fh-pad-i.height if anchor[1]>0.8 else (fh-i.height)//2))
    sh.save(os.path.join(SPR,key+'.png'))
    r=dict(type='sheet',file=f'sprites/{key}.png',frameW=fw,frameH=fh,anchor=list(anchor),scale=0.5,frames=len(ims))
    if anims: r['anims']=anims
    REC[key]=r; return sh
def fillholes(im,color):
    a=np.array(im); al=a[...,3]>40
    holes=ndimage.binary_fill_holes(al)&~al
    holes=ndimage.binary_dilation(holes,iterations=1)&~(a[...,3]>200)
    a[holes]=list(color)+[255]
    return Image.fromarray(a,'RGBA')
def recolor(im,mask_fn,hue_to,sat_mul=1.0,val_mul=1.0):
    a=np.array(im).astype(np.float32)/255.
    r,g,b=a[...,0],a[...,1],a[...,2]
    mx=a[...,:3].max(-1); mn=a[...,:3].min(-1); d=mx-mn+1e-6
    h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))/6.
    s=d/(mx+1e-6); v=mx
    m=mask_fn(h,s,v)
    h2=np.where(m,hue_to,h); s2=np.where(m,np.clip(s*sat_mul,0,1),s); v2=np.where(m,np.clip(v*val_mul,0,1),v)
    i=np.floor(h2*6)%6; f=h2*6-np.floor(h2*6); p=v2*(1-s2); q=v2*(1-f*s2); t=v2*(1-(1-f)*s2)
    R=np.choose(i.astype(int),[v2,q,p,p,t,v2]); G=np.choose(i.astype(int),[t,v2,v2,q,p,p]); B=np.choose(i.astype(int),[p,p,t,v2,v2,q])
    out=np.stack([R,G,B,a[...,3]],-1)
    return Image.fromarray((out*255).astype(np.uint8),'RGBA')

# ---------------- chapter props: (sheet index, name, on-screen height)
PROPS={
 1:('ch1_props',[(0,'tree',130),(1,'stump',84),(2,'boulder',54),(3,'boulder_b',46),(4,'log',40),(5,'mushrooms',56),(6,'bramble',56),(7,'lantern',72),(8,'stones',48)]),
 2:('ch2_props',[(0,'spire',96),(1,'minecart',56),(2,'crates',66),(3,'rubble',46),(4,'crystals',62),(5,'support',96),(6,'rubble_b',44),(7,'deadbush',48),(8,'barrel_flag',72)]),
 3:('ch3_props',[(0,'bookshelf',104),(1,'shelf_round',74),(2,'bookstack',62),(3,'desk',58),(4,'globe',70),(5,'candelabra',80),(6,'floating_rock',62),(7,'floating_rock_b',58),(8,'armchair',62)]),
 4:('ch4_props',[(0,'ice_pillar',96),(1,'pine',120),(2,'snow_boulder',60),(3,'snow_rocks',44),(4,'ice_crystals',66),(5,'snowman',64),(6,'signpost',62),(7,'fish_barrel',60),(8,'frost_bush',54)]),
 5:('ch5_props',[(0,'boiler',96),(1,'pipe_valve',62),(2,'gears',48),(3,'barrels',60),(4,'workbench',56),(5,'barrels_b',62),(6,'chimney',110),(7,'parts_crate',56),(8,'lamp',84)]),
 6:('ch6_props',[(0,'crystal',90),(1,'moon_rock',60),(2,'pillar',100),(3,'meteorite',56),(4,'brazier',62),(5,'ring_statue',76),(6,'crystal_flowers',60),(7,'crystal_b',70),(8,'glow_mushrooms',64),(9,'rubble',40)]),
}
for ch,(sh,lst) in PROPS.items():
    it=sheet(sh)
    for i,n,h in lst: save(f'prop_ch{ch}_{n}',it[i]['img'],h=h)
# breakables (whole, broken) - merge pieces generously
def brk(sheetname,pairs):
    it=sheet(sheetname,merge=22,min_area=3000)
    return it
def region(name,comps,idx):
    im=despill(load(name+'.png')); bx=[comps[i]['box'] for i in idx]
    b=(min(x[0] for x in bx),min(x[1] for x in bx),max(x[2] for x in bx),max(x[3] for x in bx))
    return im.crop(b)
ca=sheet('brk_a'); cb_=sheet('brk_b')
ba=[region('brk_a',ca,[0]),region('brk_a',ca,[1]),region('brk_a',ca,[2]),region('brk_a',ca,[3,4]),region('brk_a',ca,[5]),region('brk_a',ca,[6])]
bb=[region('brk_b',cb_,[0]),region('brk_b',cb_,[1,2]),region('brk_b',cb_,[3]),region('brk_b',cb_,[4]),region('brk_b',cb_,[5]),region('brk_b',cb_,[6])]
ba=[dict(img=x) for x in ba]; bb=[dict(img=x) for x in bb]
def brk_pair(key,whole,broken,h):
    W=trim(whole); B=trim(broken); s=h*2/W.height
    W=stroke(fit(W,h=h*2)); B=stroke(B.resize((max(1,round(B.width*s)),max(1,round(B.height*s))),Image.LANCZOS))
    frames_sheet(key,[W,B],anims={'whole':{'frames':[0],'fps':1,'loop':False},'broken':{'frames':[1],'fps':1,'loop':False}})
BRK_H={1:44,2:48,3:40,4:46,5:46,6:48}
for ch,(src,i) in {1:(ba,0),2:(ba,2),3:(ba,4),4:(bb,0),5:(bb,2),6:(bb,4)}.items():
    brk_pair(f'prop_ch{ch}_breakable',src[i]['img'],src[i+1]['img'],BRK_H[ch])
cw=sheet('cracked_wall')
save('prop_cracked_wall',cw[0]['img'],w=96)
save('prop_wall_block',cw[2]['img'],w=96)
save('prop_fence',cw[5]['img'],h=56)

# ---------------- hub
nat=sheet('hub_nature_sheet')
save('hub_tree_a',nat[0]['img'],h=132); save('hub_tree_b',nat[1]['img'],h=140); save('hub_tree_c',nat[2]['img'],h=124)
save('hub_bush_berry',nat[3]['img'],h=50); save('hub_mushrooms',nat[4]['img'],h=40); save('hub_rock',nat[5]['img'],h=46); save('hub_flowers',nat[6]['img'],h=34)
stn=sheet('hub_stations')
save('hub_wardrobe',stn[0]['img'],h=88); save('hub_weapon_rack',stn[1]['img'],h=76); save('hub_mirror',stn[2]['img'],h=86)
save('hub_journal_stand',stn[3]['img'],h=66); save('hub_training_dummy',stn[4]['img'],h=72)
save('hub_destiny_tree',trim(despill(load('hub_destiny_tree.png'))),h=236)
save('hub_tent_smith',trim(despill(load('hub_tent_smith2.png'))),w=150)
save('hub_portal',trim(despill(load('hub_portal.png'))),h=140)
pond=trim(despill(load('hub_pond.png'))); save('hub_pond',pond,w=210,anchor=(0.5,0.6))
# house 2 frames: broken / repaired, same scale (by width 176 on-screen)
hf=trim(despill(load('hub_house_fixed.png'))); hb=trim(despill(load('hub_house_broken.png')))
s=176*2/hf.width
hf=stroke(fit(hf,w=176*2)); hb=stroke(hb.resize((round(hb.width*s),round(hb.height*s)),Image.LANCZOS))
frames_sheet('hub_house',[hb,hf],anims={'broken':{'frames':[0],'fps':1,'loop':False},'repaired':{'frames':[1],'fps':1,'loop':False}})
# campfire: base + 6 procedural cartoon flame frames
base=stroke(fit(trim(despill(load('hub_campfire_base.png'))),w=76*2))
def flame_frame(k,W=152,H=170,seed=0):
    SS=3; im=Image.new('RGBA',(W*SS,H*SS),(0,0,0,0)); d=ImageDraw.Draw(im)
    import math
    cx=W/2; by=H-40
    def tongue(x,h,wid,ph,col,olw):
        sway=math.sin(k/6*2*math.pi+ph)*wid*0.25
        pts=[]
        for t in np.linspace(0,1,24):
            y=by-h*t; ww=wid*(1-t)**0.8*math.sin(math.pi*min(1,t*1.3+0.15))
            pts.append((x+sway*t-ww,y))
        for t in np.linspace(1,0,24):
            y=by-h*t; ww=wid*(1-t)**0.8*math.sin(math.pi*min(1,t*1.3+0.15))
            pts.append((x+sway*t+ww,y))
        P=[(px*SS,py*SS) for px,py in pts]
        if olw: d.polygon(P,fill=(59,36,22,255)); 
        return P
    hs=[0.92,1.0,0.88,0.97,1.04,0.9]
    for (dx,hh,ww,ph) in [(-24,100,26,0.0),(24,92,25,1.7),(0,140,38,0.8)]:
        h=hh*hs[(k+int(ph*3))%6]
        P=tongue(cx+dx,h+6,ww+5,ph,None,True)
    for (dx,hh,ww,ph) in [(-24,100,26,0.0),(24,92,25,1.7),(0,140,38,0.8)]:
        h=hh*hs[(k+int(ph*3))%6]
        d.polygon(tongue(cx+dx,h,ww,ph,None,False),fill=(240,122,46,255))
    for (dx,hh,ww,ph) in [(-17,62,15,0.0),(17,56,14,1.7),(0,96,24,0.8)]:
        h=hh*hs[(k+int(ph*3)+1)%6]
        d.polygon(tongue(cx+dx,h,ww,ph,None,False),fill=(255,190,72,255))
    h=52*hs[(k+3)%6]; d.polygon(tongue(cx,h,12,0.4,None,False),fill=(255,240,170,255))
    # sparks
    rng=np.random.default_rng(k)
    for j in range(3):
        sx=cx+rng.uniform(-30,30); sy=by-150-((k*9+j*23)%40)
        d.ellipse(((sx-3)*SS,(sy-3)*SS,(sx+3)*SS,(sy+3)*SS),fill=(255,214,90,255),outline=(59,36,22,255),width=SS)
    return im.resize((W,H),Image.LANCZOS)
fr=[]
for k in range(6):
    c=Image.new('RGBA',(base.width,base.height+170),(0,0,0,0))
    c.alpha_composite(base,(0,170))
    f=flame_frame(k,W=base.width,H=240); c.alpha_composite(f,(0,c.height-240-int(base.height*0.22)))
    fr.append(c)
frames_sheet('hub_campfire',fr,anims={'idle':{'frames':[0,1,2,3,4,5],'fps':10,'loop':True}})

# ---------------- room objects
ra=sheet('room_a'); rb=sheet('room_b'); rc=sheet('room_c')
save('door_closed',ra[0]['img'],w=100); save('door_open',ra[1]['img'],w=100); save('door_boss',ra[2]['img'],w=120)
save('anvil',ra[5]['img'],h=54); save('obelisk',ra[6]['img'],h=100); save('blood_altar',ra[7]['img'],h=72)
# chest: closed, squash, hop, open
cc=trim(ra[3]['img']); co=trim(ra[4]['img']); s=60*2/cc.width
cc2=stroke(fit(cc,w=120)); co2=stroke(co.resize((round(co.width*s),round(co.height*s)),Image.LANCZOS))
sq=stroke(fit(cc,w=120).resize((128,int(fit(cc,w=120).height*0.88)),Image.LANCZOS))
hop=Image.new('RGBA',(cc2.width,cc2.height+14),(0,0,0,0)); hop.alpha_composite(cc2,(0,0))
frames_sheet('chest_money',[cc2,sq,hop,co2],anims={'closed':{'frames':[0],'fps':1,'loop':False},'open':{'frames':[0,1,2,3],'fps':10,'loop':False},'opened':{'frames':[3],'fps':1,'loop':False}})
save('altar_enchant_s',rb[0]['img'],h=50); save('altar_enchant_m',rb[1]['img'],h=72); save('altar_enchant_l',rb[2]['img'],h=96)
save('shop_stall',rb[3]['img'],w=124); save('merchant_rat',rb[4]['img'],h=58); save('roots_tree',rb[5]['img'],w=96)
heart=fillholes(rb[6]['img'],(126,206,96)); save('heart_green',heart,h=30,anchor=(0.5,0.5))
save('dice_pickup',rb[7]['img'],h=30,anchor=(0.5,0.5))
icd=components(despill(load('icons_d.png')),800,4)
save('clover',fillholes(icd[16]['img'],(110,190,80)),h=30,anchor=(0.5,0.5))
# fountains: gold + red generated; green = red recoloured (generated green came out washed by the keyer)
save('fountain_gold',rc[1]['img'],w=84); red=rc[2]['img']; save('fountain_red',red,w=84)
grn=recolor(red,lambda h,s,v:((h<0.06)|(h>0.92))&(s>0.35)&(v>0.3),0.30,0.95,1.0); save('fountain_green',grn,w=84)
save('pocket_portal',rc[4]['img'],h=66); save('portal_exit',rc[5]['img'],w=100); save('training_dummy',rc[6]['img'],h=66)
# level-up orb: procedural pulsing golden orb with star (6 frames)
def orb(k,S=96):
    SS=4; im=Image.new('RGBA',(S*SS,S*SS),(0,0,0,0)); d=ImageDraw.Draw(im); import math
    p=math.sin(k/6*2*math.pi); c=S/2; r=26+2*p
    g=Image.new('RGBA',im.size,(0,0,0,0)); gd=ImageDraw.Draw(g); R=(r+12+3*p)*SS
    gd.ellipse((c*SS-R,c*SS-R,c*SS+R,c*SS+R),fill=(255,214,90,110)); g=g.filter(ImageFilter.GaussianBlur(6*SS)); im.alpha_composite(g)
    d.ellipse(((c-r-3)*SS,(c-r-3)*SS,(c+r+3)*SS,(c+r+3)*SS),fill=OUTLINE)
    d.ellipse(((c-r)*SS,(c-r)*SS,(c+r)*SS,(c+r)*SS),fill=(240,170,50,255))
    d.ellipse(((c-r)*SS,(c-r)*SS,(c+r-4)*SS,(c+r-6)*SS),fill=(255,206,86,255))
    d.ellipse(((c-r*0.6)*SS,(c-r*0.75)*SS,(c-r*0.05)*SS,(c-r*0.35)*SS),fill=(255,246,200,255))
    pts=[]
    for j in range(10):
        a=-math.pi/2+j*math.pi/5+k*0.05; rr=(15 if j%2==0 else 6.5)
        pts.append(((c+rr*math.cos(a))*SS,(c+3+rr*math.sin(a))*SS))
    d.polygon(pts,fill=(255,255,255,255),outline=OUTLINE,width=2*SS)
    for j in range(3):
        a=k/6*2*math.pi+j*2.1; sx=c+(r+10)*math.cos(a); sy=c+(r+10)*math.sin(a)*0.8
        d.polygon([(sx*SS,(sy-5)*SS),((sx+1.5)*SS,(sy-1.5)*SS),((sx+5)*SS,sy*SS),((sx+1.5)*SS,(sy+1.5)*SS),(sx*SS,(sy+5)*SS),((sx-1.5)*SS,(sy+1.5)*SS),((sx-5)*SS,sy*SS),((sx-1.5)*SS,(sy-1.5)*SS)],fill=(255,250,210,255))
    return im.resize((S,S),Image.LANCZOS)
frames_sheet('orb_levelup',[orb(k) for k in range(6)],anims={'idle':{'frames':[0,1,2,3,4,5],'fps':8,'loop':True}},anchor=(0.5,0.5))
json.dump(REC,open(os.path.join(ART,'tools','_world_rec.json'),'w'),indent=1)
print(len(REC),'sprite keys')
