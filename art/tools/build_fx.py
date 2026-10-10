"""Procedural VFX + projectile sheets in the house style (flat cartoon, dark-brown outline). Stored 2x, scale 0.5.
Frames laid out horizontally; projectiles face RIGHT (engine rotates)."""
from wlib import *
import math
SS=4; OLc=(59,36,22,255)
REC={}
def cv(w,h): return Image.new('RGBA',(w*SS,h*SS),(0,0,0,0))
def fin(im,w,h,alpha=1.0):
    im=im.resize((w,h),Image.LANCZOS)
    if alpha<1: a=np.array(im); a[...,3]=(a[...,3]*alpha).astype(np.uint8); im=Image.fromarray(a)
    return im
def S(p): return [(x*SS,y*SS) for x,y in p]
def poly(d,pts,fill,ol=3): d.polygon(S(pts),fill=fill,outline=OLc if ol else None,width=int(ol*SS) if ol else 0)
def ell(d,cx,cy,rx,ry,fill,ol=3): d.ellipse(((cx-rx)*SS,(cy-ry)*SS,(cx+rx)*SS,(cy+ry)*SS),fill=fill,outline=OLc if ol else None,width=int(ol*SS) if ol else 0)
def starpts(cx,cy,r1,r2,n=5,rot=-math.pi/2):
    return [(cx+(r1 if j%2==0 else r2)*math.cos(rot+j*math.pi/n),cy+(r1 if j%2==0 else r2)*math.sin(rot+j*math.pi/n)) for j in range(2*n)]
def save(key,frames,fps=14,loop=False,anchor=(0.5,0.5),animname='play'):
    w,h=frames[0].size; sh=Image.new('RGBA',(w*len(frames),h),(0,0,0,0))
    for i,f in enumerate(frames): sh.alpha_composite(f,(i*w,0))
    sh.save(os.path.join(SPR,key+'.png'))
    REC[key]=dict(type='sheet',file=f'sprites/{key}.png',frameW=w,frameH=h,anchor=list(anchor),scale=0.5,frames=len(frames),
                  anims={animname:{'frames':list(range(len(frames))),'fps':fps,'loop':loop}})
def crescent(d,cx,cy,R,thick,a0,a1,fill,ol=3,steps=40):
    """crescent arc band from angle a0 to a1 (radians), tapering at both ends"""
    outer=[];inner=[]
    for t in np.linspace(0,1,steps):
        a=a0+(a1-a0)*t; th=thick*math.sin(math.pi*min(1,t*1.05))**0.7
        outer.append((cx+R*math.cos(a),cy+R*math.sin(a))); inner.append((cx+(R-th)*math.cos(a),cy+(R-th)*math.sin(a)))
    poly(d,outer+inner[::-1],fill,ol)
# ---------- slashes
def slash(key,W,R,thick,cols,n=6):
    fr=[]
    for k in range(n):
        im=cv(W,W); d=ImageDraw.Draw(im); t=(k+1)/n
        span=math.radians(60+150*min(1,t*1.6)); mid=0
        a0=mid-span/2; a1=mid+span/2*min(1,0.4+t)
        th=thick*(1.0 if t<0.7 else (1-t)/0.3*0.9+0.1)
        crescent(d,W/2-R*0.35,W/2,R,th,a0,a1,cols[0])
        crescent(d,W/2-R*0.35,W/2,R-th*0.25,th*0.5,a0+0.15,a1-0.1,cols[1],ol=0)
        fr.append(fin(im,W,W,1.0 if t<0.75 else 1-(t-0.75)/0.25*0.6))
    save(key,fr,fps=20)
slash('fx_slash_small',192,72,36,[(255,250,232,255),(255,205,110,255)])
slash('fx_slash_big',288,110,56,[(255,236,160,255),(255,150,60,255)],7)
# thrust
fr=[]
for k in range(5):
    W,H=256,96; im=cv(W,H); d=ImageDraw.Draw(im); t=(k+1)/5; L=60+180*min(1,t*1.5); th=22*(1-max(0,t-0.6)/0.4*0.8)
    poly(d,[(16,H/2),(16+L*0.15,H/2-th),(16+L,H/2),(16+L*0.15,H/2+th)],(255,248,225,255))
    poly(d,[(30,H/2),(30+L*0.2,H/2-th*0.45),(16+L*0.92,H/2),(30+L*0.2,H/2+th*0.45)],(255,200,96,255),ol=0)
    for j in range(3):
        y=H/2+(j-1)*th*1.3; poly(d,[(10+j*14,y-2),(10+j*14+L*0.4,y-1),(10+j*14+L*0.4,y+1),(10+j*14,y+2)],(255,250,235,255),ol=1.5)
    fr.append(fin(im,W,H,1 if t<0.8 else 0.5))
save('fx_thrust',fr,fps=20,anchor=(0.06,0.5))
# hit / crit bursts
def burst(key,W,n,cols,rays=8,extra=False):
    fr=[]
    for k in range(n):
        im=cv(W,W); d=ImageDraw.Draw(im); t=(k+0.6)/n; c=W/2
        r1=W*0.18+W*0.25*min(1,t*1.8); r2=r1*0.45
        if t>0.6: r1*=1-(t-0.6)*1.2; r2*=1-(t-0.6)*1.2
        if extra:
            for j in range(rays):
                a=j*2*math.pi/rays+0.2; L1=r1*1.05; L2=r1*1.05+W*0.12*min(1,t*2)
                poly(d,[(c+L1*math.cos(a-0.06),c+L1*math.sin(a-0.06)),(c+L2*math.cos(a),c+L2*math.sin(a)),(c+L1*math.cos(a+0.06),c+L1*math.sin(a+0.06))],cols[1],ol=2)
        poly(d,starpts(c,c,r1,r2,rays//2+2 if extra else 4,rot=k*0.2),cols[0])
        poly(d,starpts(c,c,r1*0.55,r2*0.55,rays//2+2 if extra else 4,rot=k*0.2),cols[1],ol=0)
        ell(d,c,c,r2*0.5,r2*0.5,(255,255,255,255),ol=0)
        fr.append(fin(im,W,W,1 if t<0.7 else 1-(t-0.7)/0.3*0.7))
    save(key,fr,fps=22)
burst('fx_hit',128,5,[(255,240,190,255),(255,190,80,255)])
burst('fx_crit',176,6,[(255,120,80,255),(255,226,110,255)],rays=10,extra=True)
# dash dust
fr=[]
for k in range(6):
    W,H=144,96; im=cv(W,H); d=ImageDraw.Draw(im); t=(k+1)/6
    for j,(x,y,r) in enumerate([(100,62,16),(72,66,20),(44,60,15),(24,68,11)]):
        tt=max(0,t-j*0.08); rr=r*(0.5+tt*0.9)*(1 if tt<0.7 else 1-(tt-0.7)*1.5)
        if rr>2: ell(d,x-tt*20,y-tt*10,rr,rr*0.8,(241,222,181,255)); ell(d,x-tt*20-rr*0.25,y-tt*10-rr*0.25,rr*0.45,rr*0.32,(255,246,222,255),ol=0)
    fr.append(fin(im,W,H,1 if t<0.6 else 1-(t-0.6)))
save('fx_dash_dust',fr,fps=16,anchor=(0.7,0.75))
# explosion 8f
fr=[]
rng=np.random.default_rng(7); puffs=[(rng.uniform(-1,1),rng.uniform(-1,1),rng.uniform(0.5,1)) for _ in range(9)]
for k in range(8):
    W=256; im=cv(W,W); d=ImageDraw.Draw(im); t=(k+1)/8; c=W/2
    if t<0.3: ell(d,c,c,30+t*200,30+t*200,(255,240,170,255)); 
    for (px,py,s) in puffs:
        R=W*0.17*s*(0.4+t*1.1); x=c+px*W*0.22*min(1,t*2); y=c+py*W*0.2*min(1,t*2)-t*20
        col=(255,196,72,255) if t<0.35 else ((240,122,46,255) if t<0.6 else (150,130,122,255))
        if t>0.85: R*=0.8
        ell(d,x,y,R,R,col); ell(d,x-R*0.25,y-R*0.3,R*0.45,R*0.35,(255,236,150,255) if t<0.6 else (190,176,168,255),ol=0)
    fr.append(fin(im,W,W,1 if t<0.75 else 1-(t-0.75)*2.4))
save('fx_explosion',fr,fps=16)
# burn (loop) - small flames
def flame(d,cx,by,h,w,ph,k,cols):
    for (hh,ww,col) in [(1,1,cols[0]),(0.65,0.62,cols[1]),(0.35,0.3,cols[2])]:
        sw=math.sin(k/6*2*math.pi+ph)*w*0.25; pts=[]
        H=h*hh*(0.9+0.12*math.sin(k*1.7+ph)); Wd=w*ww
        for t in np.linspace(0,1,18): pts.append((cx+sw*t-Wd*(1-t)**0.8*math.sin(math.pi*min(1,t*1.3+0.15)),by-H*t))
        for t in np.linspace(1,0,18): pts.append((cx+sw*t+Wd*(1-t)**0.8*math.sin(math.pi*min(1,t*1.3+0.15)),by-H*t))
        poly(d,pts,col,ol=3 if hh==1 else 0)
fr=[]
for k in range(6):
    W,H=96,128; im=cv(W,H); d=ImageDraw.Draw(im)
    flame(d,30,110,58,14,0.3,k,[(240,122,46,255),(255,190,72,255),(255,240,170,255)])
    flame(d,66,112,50,13,1.9,k,[(240,122,46,255),(255,190,72,255),(255,240,170,255)])
    flame(d,48,116,80,20,1.0,k,[(240,122,46,255),(255,190,72,255),(255,240,170,255)])
    fr.append(fin(im,W,H))
save('fx_burn',fr,fps=12,loop=True,anchor=(0.5,0.9),animname='loop')
# freeze: ice spikes grow
fr=[]
spikes=[(-34,10,40,-0.5),(0,0,60,0),(30,8,46,0.45),(-14,14,30,-0.2),(16,16,32,0.25)]
for k in range(6):
    W=128; im=cv(W,W); d=ImageDraw.Draw(im); t=min(1,(k+1)/4); c=W/2
    for (dx,dy,h,a) in spikes:
        hh=h*t; bx=c+dx; by=c+28+dy*0.4
        tip=(bx+math.sin(a)*hh,by-math.cos(a)*hh)
        poly(d,[(bx-9,by),tip,(bx+9,by)],(168,227,240,255)); poly(d,[(bx-2,by-2),tip,(bx+5,by-2)],(240,252,255,255),ol=0)
    if k>=4:
        for j in range(4): a=j*1.6+k; ell(d,c+math.cos(a)*40,c+math.sin(a)*30,3,3,(255,255,255,255),ol=1)
    fr.append(fin(im,W,W))
save('fx_freeze',fr,fps=14,anchor=(0.5,0.75))
# shock: zigzag bolts (loop)
fr=[]
rng=np.random.default_rng(3)
for k in range(6):
    W=128; im=cv(W,W); d=ImageDraw.Draw(im); c=W/2
    for b in range(3):
        a=rng.uniform(0,2*math.pi); pts=[(c,c)]; L=rng.uniform(36,56)
        for s in range(1,5):
            r=L*s/4; jitter=rng.uniform(-10,10)
            pts.append((c+r*math.cos(a)-jitter*math.sin(a),c+r*math.sin(a)+jitter*math.cos(a)))
        d.line(S(pts),fill=OLc,width=9*SS,joint='curve'); d.line(S(pts),fill=(255,226,80,255),width=5*SS,joint='curve'); d.line(S(pts),fill=(255,255,230,255),width=2*SS,joint='curve')
    ell(d,c,c,10,10,(255,240,140,255),ol=2)
    fr.append(fin(im,W,W))
save('fx_shock',fr,fps=18,loop=True,animname='loop')
# poison bubbles (loop)
fr=[]
bub=[(30,0.0,8),(56,0.35,11),(72,0.7,7),(44,0.5,6),(64,0.15,5)]
for k in range(6):
    W,H=96,128; im=cv(W,H); d=ImageDraw.Draw(im)
    for (x,ph,r) in bub:
        t=((k/6)+ph)%1; y=116-t*96; rr=r*(1 if t<0.85 else (1-t)/0.15)
        if rr>1.5: ell(d,x+math.sin(t*6+ph*9)*5,y,rr,rr,(140,206,70,255),ol=2.5); ell(d,x-rr*0.3+math.sin(t*6+ph*9)*5,y-rr*0.35,rr*0.3,rr*0.25,(220,250,170,255),ol=0)
    fr.append(fin(im,W,H))
save('fx_poison',fr,fps=10,loop=True,anchor=(0.5,0.9),animname='loop')
# heal: green plus signs rising
def plus(d,cx,cy,s,col):
    t=s*0.34
    poly(d,[(cx-t,cy-s),(cx+t,cy-s),(cx+t,cy-t),(cx+s,cy-t),(cx+s,cy+t),(cx+t,cy+t),(cx+t,cy+s),(cx-t,cy+s),(cx-t,cy+t),(cx-s,cy+t),(cx-s,cy-t),(cx-t,cy-t)],col,ol=2.5)
fr=[]
pl=[(40,0.0,12),(84,0.3,9),(62,0.6,14),(28,0.75,7),(96,0.5,7)]
for k in range(6):
    W,H=128,160; im=cv(W,H); d=ImageDraw.Draw(im)
    g=cv(W,H); ImageDraw.Draw(g).ellipse((20*SS,120*SS,108*SS,150*SS),fill=(140,230,120,120)); im.alpha_composite(g.filter(ImageFilter.GaussianBlur(6*SS)))
    for (x,ph,s) in pl:
        t=((k/6)+ph)%1; y=140-t*120; ss=s*(1 if t<0.8 else (1-t)/0.2)
        if ss>2: plus(d,x,y,ss,(124,214,96,255))
    fr.append(fin(im,W,H))
save('fx_heal',fr,fps=10,anchor=(0.5,0.85))
# levelup: golden pillar + rings + stars (8f)
fr=[]
for k in range(8):
    W,H=192,256; im=cv(W,H); d=ImageDraw.Draw(im); t=(k+1)/8; c=W/2
    g=cv(W,H); gd=ImageDraw.Draw(g); pw=40*(1 if t<0.7 else (1-t)/0.3)
    gd.rounded_rectangle(((c-pw)*SS,(20+ (1-min(1,t*2))*200)*SS,(c+pw)*SS,230*SS),radius=int(pw*SS),fill=(255,224,120,150))
    im.alpha_composite(g.filter(ImageFilter.GaussianBlur(4*SS)))
    for j in range(2):
        tt=(t*1.4+j*0.4)%1; ry=12+tt*8; rx=40+tt*40; y=226-tt*120
        d.ellipse(((c-rx)*SS,(y-ry)*SS,(c+rx)*SS,(y+ry)*SS),outline=OLc,width=6*SS); d.ellipse(((c-rx)*SS,(y-ry)*SS,(c+rx)*SS,(y+ry)*SS),outline=(255,214,90,255),width=3*SS)
    for j in range(5):
        a=j*1.3+t*4; x=c+math.cos(a)*(30+j*8); y=200-((t+j*0.2)%1)*170
        poly(d,starpts(x,y,9,4),(255,236,130,255),ol=2)
    fr.append(fin(im,W,H,1 if t<0.85 else 0.6))
save('fx_levelup',fr,fps=12,anchor=(0.5,0.9))
# spawn: violet swirl portal opening/closing (8f)
fr=[]
for k in range(8):
    W=160; im=cv(W,W); d=ImageDraw.Draw(im); c=W/2; t=(k+1)/8
    s=math.sin(math.pi*t); rx=60*s; ry=30*s
    if rx>3:
        ell(d,c,c+30,rx,ry,(142,108,216,255)); ell(d,c,c+30,rx*0.7,ry*0.7,(182,155,240,255),ol=0); ell(d,c,c+30,rx*0.35,ry*0.35,(240,230,255,255),ol=0)
        for j in range(6):
            a=j*math.pi/3+t*6; x=c+math.cos(a)*rx*0.9; y=c+30+math.sin(a)*ry*0.9-20*t
            poly(d,starpts(x,y,6,2.5,4),(255,255,255,255),ol=1.5)
    fr.append(fin(im,W,W))
save('fx_spawn',fr,fps=12,anchor=(0.5,0.69))
# telegraphs (ground, translucent red, pulsing loop)
fr=[]
for k in range(4):
    W=192; im=cv(W,W); d=ImageDraw.Draw(im); c=W/2; p=0.5+0.5*math.sin(k/4*2*math.pi)
    d.ellipse((6*SS,6*SS,(W-6)*SS,(W-6)*SS),fill=(226,60,50,int(70+40*p)),outline=(170,30,30,230),width=5*SS)
    r=(W/2-14)*(0.35+0.65*((k+1)/4)); d.ellipse(((c-r)*SS,(c-r)*SS,(c+r)*SS,(c+r)*SS),outline=(255,120,100,200),width=3*SS)
    fr.append(fin(im,W,W))
save('fx_telegraph_circle',fr,fps=8,loop=True,animname='loop')
fr=[]
for k in range(4):
    W,H=256,64; im=cv(W,H); d=ImageDraw.Draw(im)
    d.rounded_rectangle((4*SS,6*SS,(W-4)*SS,(H-6)*SS),radius=20*SS,fill=(226,60,50,95),outline=(170,30,30,230),width=4*SS)
    for j in range(5):
        x=20+((j*48+k*12)%220)
        d.line(S([(x,18),(x+14,32),(x,46)]),fill=(255,140,120,220),width=5*SS,joint='curve')
    fr.append(fin(im,W,H))
save('fx_telegraph_line',fr,fps=10,loop=True,anchor=(0.0,0.5),animname='loop')
# ---------- projectiles (face right)
def pj(key,W,H,draw,n=4,fps=12):
    fr=[]
    for k in range(n):
        im=cv(W,H); d=ImageDraw.Draw(im); draw(d,k,W,H,im); fr.append(fin(im,W,H))
    save(key,fr,fps=fps,loop=True,animname='fly')
def bolt(d,k,W,H,im,shaft=(201,138,75,255),head=(170,176,184,255),fl=(226,72,61,255)):
    c=H/2; poly(d,[(6,c-3),(W-18,c-3),(W-18,c+3),(6,c+3)],shaft,ol=2.5)
    poly(d,[(W-20,c-8),(W-3,c),(W-20,c+8)],head,ol=2.5)
    poly(d,[(4,c-9),(18,c-2),(18,c+2),(4,c+9),(10,c)],fl,ol=2)
pj('pj_bolt',72,28,lambda d,k,W,H,im:bolt(d,k,W,H,im),n=1)
pj('pj_enemy_arrow',72,28,lambda d,k,W,H,im:bolt(d,k,W,H,im,shaft=(140,96,60,255),head=(120,120,128,255),fl=(70,60,60,255)),n=1)
def orb_draw(cols):
    def f(d,k,W,H,im):
        c=W/2; p=math.sin(k/4*2*math.pi)
        g=cv(W,H); ImageDraw.Draw(g).ellipse((2*SS,2*SS,(W-2)*SS,(H-2)*SS),fill=cols[0][:3]+(110,)); im.alpha_composite(g.filter(ImageFilter.GaussianBlur(3*SS)))
        r=W*0.3+p*1.5; ell(d,c,c,r,r,cols[0]); ell(d,c,c,r*0.62,r*0.62,cols[1],ol=0); ell(d,c-r*0.3,c-r*0.35,r*0.25,r*0.2,(255,255,255,255),ol=0)
    return f
pj('pj_orb_magic',48,48,orb_draw([(122,140,240,255),(200,210,255,255)]))
pj('pj_enemy_orb',44,44,orb_draw([(232,70,110,255),(255,170,190,255)]))
def fireball(d,k,W,H,im):
    c=H/2
    for j in range(4):
        x=W-26-j*12; r=14-j*3+(1 if (k+j)%2 else 0)
        ell(d,x,c+math.sin(k+j)*2,r,r*0.85,[(240,122,46,255),(250,150,56,255),(255,190,72,255),(255,210,110,255)][j],ol=2.5)
    ell(d,W-24,c,15,13,(240,122,46,255)); ell(d,W-21,c-1,9,8,(255,196,72,255),ol=0); ell(d,W-19,c-3,4,3,(255,246,200,255),ol=0)
pj('pj_fireball',84,44,fireball)
def icebolt(d,k,W,H,im):
    c=H/2; poly(d,[(8,c),(26,c-11),(W-6,c),(26,c+11)],(168,227,240,255)); poly(d,[(20,c-1),(30,c-6),(W-14,c-1)],(244,252,255,255),ol=0)
    for j in range(3): ell(d,10-j*3+(k%2)*2,c+(j-1)*8,2.5,2.5,(255,255,255,255),ol=1)
pj('pj_icebolt',76,36,icebolt)
def lightning(d,k,W,H,im):
    rng=np.random.default_rng(k+11); c=H/2; pts=[(4,c)]
    for s in range(1,7): pts.append((4+(W-10)*s/6,c+rng.uniform(-12,12)*(0 if s==6 else 1)))
    d.line(S(pts),fill=OLc,width=10*SS,joint='curve'); d.line(S(pts),fill=(255,226,80,255),width=6*SS,joint='curve'); d.line(S(pts),fill=(255,255,235,255),width=2*SS,joint='curve')
    ell(d,W-8,c,7,7,(255,240,140,255),ol=2)
pj('pj_lightning',100,44,lightning)
def bomb(d,k,W,H,im):
    c=W/2+2; ell(d,c,c+3,17,17,(70,64,72,255)); ell(d,c-6,c-3,5,4,(140,134,150,255),ol=0)
    poly(d,[(c-5,c-16),(c+5,c-16),(c+5,c-11),(c-5,c-11)],(120,110,100,255),ol=2)
    d.line(S([(c,c-16),(c+5,c-22),(c+10,c-21)]),fill=OLc,width=4*SS); d.line(S([(c,c-16),(c+5,c-22),(c+10,c-21)]),fill=(201,138,75,255),width=2*SS)
    s=5+(k%2)*2; poly(d,starpts(c+11,c-22,s,s*0.4,4,rot=k*0.4),(255,214,90,255),ol=1.5)
pj('pj_bomb',52,52,bomb)
def star(d,k,W,H,im):
    c=W/2; g=cv(W,H); ImageDraw.Draw(g).ellipse((4*SS,4*SS,(W-4)*SS,(H-4)*SS),fill=(255,214,90,110)); im.alpha_composite(g.filter(ImageFilter.GaussianBlur(3*SS)))
    poly(d,starpts(c,c,W*0.38,W*0.17,5,rot=-math.pi/2+k*math.pi/10),(255,214,90,255)); poly(d,starpts(c,c-1,W*0.2,W*0.09,5,rot=-math.pi/2+k*math.pi/10),(255,246,200,255),ol=0)
pj('pj_star',48,48,star)
json.dump(REC,open(os.path.join(ART,'tools','_fx_rec.json'),'w'),indent=1)
print(len(REC),'fx keys')
