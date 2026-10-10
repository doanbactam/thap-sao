"""Tilesets ts_hub, ts_ch1..ts_ch6: 8x4 grid of 96px tiles (48px on screen, scale 0.5).
frames 0-7 floor variants (all share identical borders -> any arrangement is seamless)
8-15 decals (transparent), 16-23 walls, 24-31 liquid / cliff edges. See FRAME_NAMES."""
from wlib import *
T=96; OL=np.array([59,36,22],float)
FRAME_NAMES={**{i:f'floor_{i}' for i in range(8)},**{8+i:f'decal_{i}' for i in range(8)},
 16:'wall_top',17:'wall_top_edge_e',18:'wall_top_edge_w',19:'wall_top_edge_n',20:'wall_top_corner_ne',21:'wall_top_corner_nw',22:'wall_face_upper',23:'wall_face_lower',
 24:'liquid',25:'liquid_alt',26:'liquid_cliff_n',27:'liquid_edge_s',28:'liquid_edge_w',29:'liquid_edge_e',30:'liquid_cliff_nw',31:'liquid_cliff_ne'}
FRAME_DOC=("floor_*: interchangeable floor variants (identical borders). decal_*: transparent ground details drawn over floor. "
 "wall_top: wall mass seen from above; wall_top_edge_X: wall top whose X side borders the floor (edge_e = west wall column, edge_w = east wall column, edge_n = south wall row); "
 "wall_top_corner_ne/nw: wall top with inner notch where floor touches only diagonally (south wall corners); wall_face_upper + wall_face_lower: the north wall front face is 2 tiles tall - upper (with the cap band) on top, lower (with the floor contact shadow) directly above the floor row; stack them. "
 "liquid(_alt): water/lava/void fill; liquid_cliff_n: liquid cell directly BELOW a floor cell (cliff face + rim at top); liquid_edge_s: liquid cell directly ABOVE floor; "
 "liquid_edge_w/e: floor on the west/east side; liquid_cliff_nw/ne: floor to the north AND west/east.")
def rgb(n): return np.array(Image.open(os.path.join(RAW,n)).convert('RGB')).astype(float)
def crop_tile(tex,x,y,cs,out=T):
    H,W,_=tex.shape; x%=max(1,W-cs); y%=max(1,H-cs)
    return np.array(Image.fromarray(tex[y:y+cs,x:x+cs].astype(np.uint8)).resize((out,out),Image.LANCZOS)).astype(float)
def wrap_tile(tex,x,y,cs,out=T,B=None):
    """seamless tile from a crop: crossfade wrap (v2 seamless()) on a cs+B crop"""
    B=B or cs//4; H,W,_=tex.shape; x=min(x,W-cs-B-1); y=min(y,H-cs-B-1)
    im=tex[y:y+cs+B,x:x+cs+B].copy()
    t=im[:, :cs].copy(); w=(np.arange(B)/B)[None,:,None]; t[:, :B]=im[:, cs:cs+B]*(1-w)+im[:, :B]*w; im=t
    t=im[:cs].copy(); w=(np.arange(B)/B)[:,None,None]; t[:B]=im[cs:cs+B]*(1-w)+im[:B]*w
    return np.array(Image.fromarray(np.clip(t,0,255).astype(np.uint8)).resize((out,out),Image.LANCZOS)).astype(float)
def wrap_x(img,B=None):
    h,w,_=img.shape; B=B or w//5; cs=w-B
    t=img[:, :cs].copy(); ww=(np.arange(B)/B)[None,:,None]; t[:, :B]=img[:, cs:cs+B]*(1-ww)+img[:, :B]*ww
    return t
yy,xx=np.mgrid[0:T,0:T]
def border_mask(m0=10,m1=22):
    d=np.minimum(np.minimum(xx,T-1-xx),np.minimum(yy,T-1-yy)).astype(float)
    return np.clip((d-m0)/(m1-m0),0,1)[...,None]
BM=border_mask()
def variants(tex,cs,seeds,base_xy=(40,40)):
    base=wrap_tile(tex,*base_xy,cs); out=[base]
    for (x,y) in seeds:
        v=crop_tile(tex,x,y,cs); out.append(base*(1-BM)+v*BM)
    return out
def to_img(a): return Image.fromarray(np.clip(a,0,255).astype(np.uint8)).convert('RGBA')
def shade(a,f): return a*f
def line(a,side,w=3,col=OL):
    a=a.copy()
    if side=='n': a[:w]=col
    if side=='s': a[-w:]=col
    if side=='w': a[:, :w]=col
    if side=='e': a[:, -w:]=col
    return a
def lip(a,side,w=8,f=1.18):
    a=a.copy()
    sl={'n':np.s_[:w],'s':np.s_[-w:],'w':np.s_[:, :w],'e':np.s_[:, -w:]}[side]
    a[sl]=np.clip(a[sl]*f,0,255); return a
def decal_tiles(sheetname,idx,maxs=84):
    it=components(despill(load(sheetname+'.png')),600,10); out=[]
    for i in idx:
        im=trim(it[i]['img']); im=fit(im,maxs,maxs) if max(im.size)>maxs or True else im
        s=min(1.0,maxs/max(im.size)); 
        im=stroke(im,2); c=Image.new('RGBA',(T,T),(0,0,0,0)); c.alpha_composite(im,((T-im.width)//2,(T-im.height)//2)); out.append(c)
    return out
def wall_set(face_tex,top_rgb,cs_face,face_xy=(0,0),alt_xy=(300,200)):
    # face: horizontally seamless, 96 tall: top 10px lip/cap, bottom 10px contact shadow
    def face(xy,part):
        H,W,_=face_tex.shape; x,y=xy; x=min(x,W-int(cs_face*1.25)-1); y=min(y,H-2*cs_face-1)
        crop=face_tex[y:y+2*cs_face, x:x+int(cs_face*1.25)]
        f=wrap_x(crop); f=np.array(Image.fromarray(np.clip(f,0,255).astype(np.uint8)).resize((T,2*T),Image.LANCZOS)).astype(float)
        f[:12]=np.clip(top_rgb*1.12,0,255); f[12:15]=OL           # cap band + outline (top of the 2-tile face)
        f[15:24]=f[15:24]*0.8                                       # shade under the cap
        g=np.linspace(0,1,18)[:,None,None]; f[-18:]=f[-18:]*(1-0.5*g); f[-3:]=OL   # floor contact shadow
        return f[:T] if part=='upper' else f[T:]
    top=np.ones((T,T,3))*top_rgb
    # subtle top pattern: faint checker of stones
    n=np.random.default_rng(3).normal(0,4,(T//8,T//8)); n=np.kron(n,np.ones((8,8)))[...,None]; top=np.clip(top+n,0,255)
    e=lambda s:line(lip(top,s,10,1.15),s,3)
    def corner(sx):
        t=top.copy(); m=((xx>T-14) if sx=='e' else (xx<14))&(yy<14)
        t[m]=np.clip(top_rgb*1.15,0,255)
        o=(((xx>T-17)&(xx<=T-14)&(yy<17))|((xx>T-17)&(yy>=14)&(yy<17))) if sx=='e' else (((xx<17)&(xx>=14)&(yy<17))|((xx<17)&(yy>=14)&(yy<17)))
        t[o]=OL; return t
    return [top,e('e'),e('w'),e('n'),corner('e'),corner('w'),face(face_xy,'upper'),face(face_xy,'lower')]
def liquid_set(liq,cs,cliff_tex,cliff_cs,rim=(184,236,241),floor_rgb=None):
    base=wrap_tile(liq,30,30,cs); alt=base*(1-BM)+crop_tile(liq,cs+90,cs//2,cs)*BM
    H,W,_=cliff_tex.shape
    cl=wrap_x(cliff_tex[0:cliff_cs, 0:int(cliff_cs*1.25)]); cl=np.array(Image.fromarray(np.clip(cl,0,255).astype(np.uint8)).resize((T,T),Image.LANCZOS)).astype(float)*0.78
    def cliff_n(b):
        t=b.copy(); ch=46
        t[:ch]=cl[:ch]; t[:3]=OL; t[ch-10:ch]=t[ch-10:ch]*0.8
        g=np.linspace(0.7,1,ch)[:,None,None]; t[:ch]*=g[::-1]*0+1
        t[ch:ch+3]=OL; t[ch+3:ch+8]=np.array(rim,float)   # foam / rim line
        t[ch+8:ch+20]=t[ch+8:ch+20]*0.82                # depth shade under the cliff
        return t
    def edge_s(b):
        t=b.copy(); t[-22:-8]=t[-22:-8]*0.55+np.array(rim,float)*0.45; t[-8:]=np.array(rim,float); t[-11:-8]=OL; t[-3:]=OL; return t
    def edge_side(b,side):
        t=b.copy(); sl=np.s_[:, :12] if side=='w' else np.s_[:, -12:]
        t[sl]=cl[:T, :12] if side=='w' else cl[:T, -12:]
        if side=='w': t[:, 12:15]=OL; t[:, 15:19]=np.array(rim,float); t[:, :3]=OL
        else: t[:, -15:-12]=OL; t[:, -19:-15]=np.array(rim,float); t[:, -3:]=OL
        return t
    def cliff_corner(side): return edge_side(cliff_n(base),side)
    return [base,alt,cliff_n(base),edge_s(base),edge_side(base,'w'),edge_side(base,'e'),cliff_corner('w'),cliff_corner('e')]
def assemble(key,floors,decals,walls,liquids):
    sh=Image.new('RGBA',(8*T,4*T),(0,0,0,0))
    for i,a in enumerate(floors[:8]): sh.paste(to_img(a),((i%8)*T,0))
    for i,d in enumerate(decals[:8]): sh.alpha_composite(d,((i%8)*T,T))
    for i,a in enumerate(walls[:8]): sh.paste(to_img(a),((i%8)*T,2*T))
    for i,a in enumerate(liquids[:8]): sh.paste(to_img(a),((i%8)*T,3*T))
    sh.save(os.path.join(SPR,key+'.png'))
    # 4x4 random floor tiling check
    rng=np.random.default_rng(1); chk=Image.new('RGB',(6*T,6*T))
    for gx in range(6):
        for gy in range(6): chk.paste(to_img(floors[rng.integers(0,8)]).convert('RGB'),(gx*T,gy*T))
    chk.save(os.path.join(ART,'sheets',f'tilecheck_{key}.png'))
    return sh
def mean_rgb(tex): return tex.reshape(-1,3).mean(0)
REC={}
def reg(key):
    REC[key]=dict(type='sheet',file=f'sprites/{key}.png',frameW=T,frameH=T,scale=0.5,anchor=[0,0],frames=32,frameNames={str(k):v for k,v in FRAME_NAMES.items()},frameDoc=FRAME_DOC)
S=[(130,500),(600,140),(700,620),(260,760),(520,380),(820,820),(60,300)]
# ---- hub: grass / dirt-free floor, earth cliff, deep blue sea
g=rgb('tex_hub_grass.png'); w=rgb('tex_hub_wall.png'); wat=rgb('tex_hub_water.png')
fl=variants(g,300,S)
dec=decal_tiles('dec_hub',[8,3,4,5,6,7,9,5])
walls=wall_set(w,np.array([120,150,80.]),360)   # hub 'walls' = grass-topped earth cliff
liq=liquid_set(wat,360,w,300,rim=(150,205,235))
assemble('ts_hub',fl,dec,walls,liq); reg('ts_hub')
CH={1:dict(f='tex_ch1_floor.png',w='tex_ch1_wall.png',l='tex_ch1_liquid.png',top=(84,104,78),rim=(150,200,150),dec=[0,1,2,6,8,9,10,11]),
    2:dict(f='tex_ch2_floor.png',w='tex_ch2_wall2.png',l='tex_ch2_liquid.png',top=(122,62,48),rim=(255,206,96),dec=[0,1,3,4,5,6,7,9]),
    3:dict(f='tex_ch3_floor.png',w='tex_ch3_wall.png',l='tex_ch3_liquid.png',top=(92,62,96),rim=(236,230,255),dec=[0,1,2,3,4,5,7,8]),
    4:dict(f='tex_ch4_floor.png',w='tex_ch4_wall.png',l='tex_ch4_liquid.png',top=(150,196,222),rim=(230,248,255),dec=[0,1,2,6,7,8,9,3]),
    5:dict(f='tex_ch5_floor.png',w='tex_ch5_wall.png',l='tex_ch5_liquid.png',top=(92,84,80),rim=(255,170,90),dec=[0,1,2,3,4,5,7,8]),
    6:dict(f='tex_ch6_floor.png',w='tex_ch6_wall.png',l='tex_ch6_liquid.png',top=(46,40,92),rim=(150,230,255),dec=[0,1,2,3,4,6,7,8])}
def planks(tex):
    """ch3: procedural staggered planks (3 rows of 32px), grain sampled from the generated wood texture"""
    rows=[(196,140,84),(184,128,74),(204,150,92)]; out=[]
    joints=[[30,70,50],[64,20,80],[46,84,14],[12,58,40],[78,36,62],[24,48,88],[54,10,70],[86,66,28]]
    grain=wrap_tile(tex,100,100,260); gl=grain.mean(-1,keepdims=True); gl=(gl-gl.mean())*0.35
    for v in range(8):
        a=np.zeros((T,T,3))
        for r in range(3):
            a[r*32:(r+1)*32]=np.array(rows[r],float)+gl[r*32:(r+1)*32]
            a[r*32:r*32+3]=a[r*32:r*32+3]*0.55+OL*0.45           # board gap
            a[r*32+3:r*32+6]=np.clip(a[r*32+3:r*32+6]*1.08,0,255)  # top highlight
            jx=joints[v][r]; a[r*32:(r+1)*32, jx:jx+3]=a[r*32:(r+1)*32, jx:jx+3]*0.55+OL*0.45
            if (v+r)%3==0:  # nail heads
                for nx in (jx+7,jx-7):
                    if 4<nx<T-4: a[r*32+14:r*32+18, nx:nx+3]=(230,190,90)
        out.append(a)
    return out
def plates(tex):
    """ch5: one riveted iron plate per tile (intentional plate grid)"""
    base=wrap_tile(tex,60,60,280); out=[]
    rng=np.random.default_rng(5)
    for v in range(8):
        a=crop_tile(tex,int(rng.integers(0,600)),int(rng.integers(0,600)),280)*0.5+base*0.5
        a[:3]=a[:3]*0.4+OL*0.6; a[:, :3]=a[:, :3]*0.4+OL*0.6
        a[3:6, 3:]=np.clip(a[3:6, 3:]*1.2,0,255); a[3:, 3:6]=np.clip(a[3:, 3:6]*1.12,0,255)
        a[-4:]=a[-4:]*0.8; a[:, -4:]=a[:, -4:]*0.8
        for (rx,ry) in [(12,12),(T-14,12),(12,T-14),(T-14,T-14)]:
            m=(xx-rx)**2+(yy-ry)**2
            a[m<=12]=OL; a[m<=6]=(170,176,184); a[(m<=2)]=(220,224,230)
        if v==3: # oil stain
            m=((xx-50)/22.)**2+((yy-56)/14.)**2<1; a[m]=a[m]*0.55
        if v==6: # small vent
            for k in range(3): a[38+k*8:41+k*8, 36:60]=a[38+k*8:41+k*8, 36:60]*0.45+OL*0.55
        out.append(a)
    return out
for ch,c in CH.items():
    f=rgb(c['f']); w=rgb(c['w']); l=rgb(c['l'])
    if ch==3: fl=planks(f)
    elif ch==5: fl=plates(f)
    else: fl=variants(f,300 if ch!=4 else 340,S)
    if ch==5:  # crop away the frame the generator drew around the pit
        h,wd,_=l.shape; l=l[int(h*0.12):int(h*0.88),int(wd*0.12):int(wd*0.88)]
    dec=decal_tiles(f'dec_ch{ch}',c['dec'])
    walls=wall_set(w,np.array(c['top'],float),300 if ch!=5 else 420)
    liq=liquid_set(l,340 if ch!=5 else 260,w,300,rim=c['rim'])
    assemble(f'ts_ch{ch}',fl,dec,walls,liq); reg(f'ts_ch{ch}')
# hub big ground decals (extra keys): procedural ochre dirt patches like the reference (solid fill, darker rim, pebbles)
def dirt_patch(wd,ht,seed):
    rng=np.random.default_rng(seed); Wp,Hp=wd*2,ht*2; yy2,xx2=np.mgrid[0:Hp,0:Wp]
    m=np.zeros((Hp,Wp),bool)
    for _ in range(9):
        cx=rng.uniform(0.25,0.75)*Wp; cy=rng.uniform(0.3,0.7)*Hp; rx=rng.uniform(0.15,0.3)*Wp; ry=rng.uniform(0.2,0.38)*Hp
        m|=((xx2-cx)/rx)**2+((yy2-cy)/ry)**2<1
    m=ndimage.gaussian_filter(m.astype(float),6)>0.5
    a=np.zeros((Hp,Wp,4),np.uint8)
    rim=m&~ndimage.binary_erosion(m,iterations=7); edge=m&~ndimage.binary_erosion(m,iterations=3)
    a[m]=(207,162,81,255); a[rim]=(185,136,78,255); a[edge]=(155,113,75,255)
    hl=ndimage.binary_erosion(m,iterations=18)&(ndimage.gaussian_filter(rng.random((Hp,Wp)),18)>0.52); a[hl]=(218,178,98,255)
    im=Image.fromarray(a,'RGBA'); d=ImageDraw.Draw(im)
    for _ in range(int(wd/18)):
        x,y=rng.uniform(0.2,0.8)*Wp,rng.uniform(0.3,0.7)*Hp
        if m[int(y),int(x)]:
            r=rng.uniform(3,6); d.ellipse((x-r,y-r*0.7,x+r,y+r*0.7),fill=(155,113,75,255),outline=(59,36,22,255),width=2)
    return im
for key,wd,ht,sd in [('hub_dirt_a',240,130,1),('hub_dirt_b',150,90,2)]:
    dirt_patch(wd,ht,sd).save(os.path.join(SPR,key+'.png'))
    REC[key]=dict(type='image',file=f'sprites/{key}.png',anchor=[0.5,0.5],scale=0.5,desc='big ground decal for the hub (draw under objects)')
json.dump(REC,open(os.path.join(ART,'tools','_tiles_rec.json'),'w'),indent=1)
print('ok',len(REC))
