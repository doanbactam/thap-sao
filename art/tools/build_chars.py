"""Animate every character still into a uniform sprite sheet + write public/assets/manifest.characters.json.
usage: python3 build_chars.py [key ...]   (no args = all)"""
import sys, os, json, math
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from charlib import *
from chars_spec import SPEC
from rig import Rig, sparkle, SS
import anims as A
STILLS=os.path.join(ROOT,'art','stills_chars')
OUT=os.path.join(ROOT,'public','assets','sprites'); os.makedirs(OUT,exist_ok=True)
REC=os.path.join(ROOT,'art','tools','_chars_rec.json')
BAND={'hero_redcat':0.13,'hero_fox':0.15,'hero_scarecrow':0.15,'en_rat_shield':0.15,'en_candle_mage':0.14,'mb_rat_captain':0.15,
      'boss_mushroom_king':0.13,'boss_rat_chief':0.12,'boss_owl_librarian':0.12,'mb_yeti':0.14,'mb_ink_golem':0.14}
NOLEGS=set(['en_mole_digger','en_gear_bot','boss_owl_librarian','mb_saw_crab','en_beetle_charger','cmp_sprout'])

def anim_table(key,kind,cat,nlegs):
    t={'idle':A.idle(kind)}
    if cat=='npc': return t
    t['run']=A.run(kind,nlegs); t['attack']=A.attack(kind,nlegs)
    if cat=='hero': t['dash']=A.dash(kind); t['cast']=A.cast(kind)
    if cat=='boss': t['attack2']=A.attack2(kind); t['phase']=A.phase(kind)
    t['hurt']=A.hurt(kind); t['die']=A.die(kind)
    return t

def glow(img,amt,col=(190,120,255)):
    al=np.array(img)[...,3]
    g=Image.fromarray(al).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(4))
    lay=Image.new('RGBA',img.size,col+(0,)); lay.putalpha(g.point(lambda v:int(v*0.85*amt)))
    lay.alpha_composite(img); return lay

def build(key):
    f,ci,flip,kind,h,wf,hr,cat=SPEC[key]
    still=Image.open(os.path.join(STILLS,key+'.png'))
    rig=Rig(still,kind,BAND.get(key),legs=key not in NOLEGS)
    nl=len(rig.legs)
    table=anim_table(key,kind,'boss' if cat=='boss' else ('hero' if cat=='hero' else ('npc' if cat=='npc' else 'x')),nl)
    H=rig.H
    # big canvas with feet at fixed point
    SW=max(H,rig.src.width-2*rig.P); Wc=int(SW*1.6+H*1.6); Hc=int(H*1.7); cf=(Wc/2,H*1.45)
    frames=[]  # (np rgba float, params)
    for an,fl in table.items():
        for p in fl:
            p=dict(p)
            if 'legs_k' in p and nl>=2:
                b,fw=p['legs_k']; p['legs']=A.legs_pose(nl,fw,b)
            frames.append((an,rig.render((Wc,Hc),cf,p),p))
    # union bbox incl. ghosts / sparks margins
    x0,y0,x1,y1=Wc,Hc,0,0
    for an,fr,p in frames:
        ys,xs=np.nonzero(fr[...,3]>0.05)
        gx=[g[0]*H for g in p.get('ghosts',[])]
        x0=min(x0,xs.min()+min([0]+gx)); x1=max(x1,xs.max()); y0=min(y0,ys.min()); y1=max(y1,ys.max())
        if 'sparks' in p: y0=min(y0,cf[1]-H*1.12); x0=min(x0,cf[0]-H*0.62); x1=max(x1,cf[0]+H*0.62)
    m=int(H*0.03)+6
    X0=int(x0-m); X1=int(x1+m); Y0=int(y0-m); Y1=int(y1+m)
    def even(v): return v+(v%SS)
    fw=even(X1-X0); fh=even(Y1-Y0)
    pad=3
    FW=fw//SS+2*pad; FH=fh//SS+2*pad
    out=[]
    for an,fr,p in frames:
        crop=fr[Y0:Y0+fh,X0:X0+fw]
        im=Image.fromarray((crop*255).astype(np.uint8),'RGBA').resize((fw//SS,fh//SS),Image.LANCZOS)
        im=stroke(im,2)            # adds 3px border each side -> FW x FH
        if p.get('aura'): im=glow(im,p['aura'])
        hS=H/SS
        if p.get('ghosts'):
            base=Image.new('RGBA',im.size,(0,0,0,0))
            for gx,ga in reversed(p['ghosts']):
                arr=np.array(im).astype(np.float32)
                arr[...,:3]=arr[...,:3]*0.45+np.array([150,225,230])*0.55; arr[...,3]*=ga
                g=Image.fromarray(arr.astype(np.uint8),'RGBA').transform(im.size,Image.AFFINE,(1,0,-gx*hS,0,1,0),resample=Image.BILINEAR)
                base.alpha_composite(g)
            base.alpha_composite(im); im=base
        if p.get('sparks'):
            r,a=p['sparks']; d=ImageDraw.Draw(im)
            fx=(cf[0]-X0)/SS+pad; fy=(cf[1]-Y0)/SS+pad
            for k in range(5):
                ang=k/5*2*math.pi+r*2.5
                x=fx+math.cos(ang)*hS*0.5*(0.6+r*0.5); y=fy-hS*0.55+math.sin(ang)*hS*0.32
                sz=max(3,hS*0.08*a*(1.2 if k%2 else 0.8))
                sparkle(d,x,y,sz,(200,255,250,255) if k%2 else (110,230,225,255))
        out.append((an,im))
    # sheet
    n=len(out); cols=min(n,8,4096//FW); rows=(n+cols-1)//cols
    assert rows*FH<=4096, (key,'sheet too tall')
    sheet=Image.new('RGBA',(cols*FW,rows*FH),(0,0,0,0))
    animsj={}; idx=0
    for i,(an,im) in enumerate(out):
        sheet.paste(im,((i%cols)*FW,(i//cols)*FH))
        animsj.setdefault(an,{'frames':[],'fps':A.FPS[an],'loop':A.LOOP.get(an,False)})['frames'].append(i)
    sheet.save(os.path.join(OUT,key+'.png'),optimize=True)
    ax=((cf[0]-X0)/SS+pad)/FW; ay=((cf[1]-Y0)/SS+pad)/FH
    entry=dict(type='sheet',file=f'sprites/{key}.png',frameW=FW,frameH=FH,anims=animsj,anchor=[round(ax,4),round(ay,4)],
               scale=0.5,facing='right',hitRadius=hr)
    return entry,nl,sheet.size

if __name__=='__main__':
    keys=sys.argv[1:] or list(SPEC)
    rec=json.load(open(REC)) if os.path.exists(REC) else {}
    for k in keys:
        e,nl,sz=build(k); rec[k]=e
        json.dump(rec,open(REC,'w'),indent=1)
        print(k,'legs',nl,'frame',e['frameW'],e['frameH'],'sheet',sz,flush=True)
    json.dump(rec,open(REC,'w'),indent=1)
