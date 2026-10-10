"""Cut-out rig for Tháp Sao characters.
One still (art/stills_chars/<key>.png, supersampled 2x of stored size) -> animation frames.
Body is deformed with a seamless warp (squash/stretch about the feet, forward lean that grows with height,
rotation about the feet, translation); legs (auto-detected in the bottom band) are cut out and swung around
their hip pivots, drawn behind the body. Frames are rendered at 2x, downscaled, then get a uniform 2px #3B2416 stroke.
"""
import numpy as np, math
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from charlib import stroke, OUTLINE

SS=2

def detect_legs(al, kind, band_frac=None):
    """al: bool alpha (h,w). returns (legs list of dict(mask, pivot), cut_y)"""
    h,w=al.shape
    ys,xs=np.nonzero(al); top,bot=ys.min(),ys.max(); H=bot-top+1
    bf=band_frac or (0.17 if kind=='biped' else 0.24)
    cut=int(bot-H*bf)
    band=al.copy(); band[:cut]=False
    er=ndimage.binary_erosion(band,iterations=max(2,int(H*0.012)))
    lab,n=ndimage.label(er)
    legs=[]
    W=xs.max()-xs.min()+1
    for i in range(1,n+1):
        m=lab==i; yy,xx=np.nonzero(m)
        if len(yy)<H*H*0.002: continue
        if yy.max()<bot-H*0.07: continue          # doesn't reach the ground
        if xx.max()-xx.min()>W*0.42: continue     # too wide: a skirt/body, not a leg
        legs.append(m)
    if len(legs)<2 and kind=='biped':
        # legs touching: split the ground-reaching band blob at the emptiest column (valley) near its middle
        lab2,n2=ndimage.label(band)
        best=None
        for i in range(1,n2+1):
            m=lab2==i; yy,xx=np.nonzero(m)
            if yy.max()<bot-H*0.05 or len(yy)<50: continue
            if best is None or len(yy)>best[1]: best=(m,len(yy))
        if best is None: return [],cut
        m=best[0]; yy,xx=np.nonzero(m); xa,xb=xx.min(),xx.max()
        # only the lower part of the band counts for the valley (feet), the upper part may be a joined body
        low=m.copy(); low[:int(bot-H*0.09)]=False
        prof=low.sum(0)[xa:xb+1].astype(float)
        L=len(prof); lo,hi=int(L*0.3),int(L*0.7)
        if hi-lo<3: return [],cut
        sx=xa+lo+int(np.argmin(prof[lo:hi]))
        if prof[lo:hi].min()>0.35*prof.max(): return [],cut   # no real gap between the feet
        left=m.copy(); left[:,sx:]=False; right=m.copy(); right[:,:sx]=False
        legs=[left,right]
        out=[]
        for mm in legs:
            yy,xx=np.nonzero(mm)
            out.append(dict(mask=mm,pivot=(float(xx.mean()),float(cut)),cx=float(xx.mean())))
        out.sort(key=lambda d:d['cx'])
        return out,cut
    if len(legs)<2: return [],cut
    legs.sort(key=lambda m:-m.sum()); legs=legs[:4 if kind=='quad' else 2]
    # grow back to the original silhouette (inside band), assign every band pixel to nearest leg if close
    out=[]
    dist_stack=[]
    for m in legs: dist_stack.append(ndimage.distance_transform_edt(~m))
    D=np.stack(dist_stack); arg=D.argmin(0); dmin=D.min(0)
    grow=max(3,int(H*0.02))
    for i,m in enumerate(legs):
        mm=band&(arg==i)&(dmin<=grow)
        yy,xx=np.nonzero(mm)
        piv=(float(xx.mean()),float(cut))
        out.append(dict(mask=mm,pivot=piv,cx=float(xx.mean())))
    out.sort(key=lambda d:d['cx'])
    return out,cut

class Rig:
    def __init__(self, still, kind, band_frac=None, legs=True):
        self.kind=kind
        P=int(max(still.size)*0.35)
        self.P=P
        im=Image.new('RGBA',(still.width+2*P,still.height+2*P),(0,0,0,0)); im.paste(still,(P,P))
        self.src=im
        a=np.array(im).astype(np.float32)/255.
        self.arr=a
        al=a[...,3]>0.35
        ys,xs=np.nonzero(al)
        self.top,self.bot=ys.min(),ys.max(); self.H=self.bot-self.top+1
        low=ys>=self.bot-max(2,self.H*0.05)
        lowb=ys>=self.bot-self.H*0.3
        self.foot=(float(0.5*xs.mean()+0.5*xs[lowb].mean()), float(self.bot))
        self.legs=[]
        if legs and kind in ('biped','quad'):
            self.legs,self.cut=detect_legs(al,kind,band_frac)
        self.body=a.copy()
        if self.legs:
            allleg=np.zeros(al.shape,bool)
            for L in self.legs: allleg|=L['mask']
            self.body[allleg]=0
            # leg layers: leg pixels + an overlap strip above the cut (hidden behind body)
            strip=int(self.H*0.06)
            for L in self.legs:
                m=L['mask'].copy()
                yy,xx=np.nonzero(m); x0,x1=xx.min(),xx.max()
                ov=np.zeros_like(m); ov[self.cut-strip:self.cut, x0:x1+1]=True
                m2=m|(ov&al)
                layer=a.copy(); layer[~m2]=0
                L['img']=Image.fromarray((layer*255).astype(np.uint8),'RGBA')
        self.body_img=Image.fromarray((self.body*255).astype(np.uint8),'RGBA')

    def posed(self, leg_angles, legdx=None):
        if not self.legs or leg_angles is None: return self.src
        base=Image.new('RGBA',self.src.size,(0,0,0,0))
        legdx=legdx or [0]*len(self.legs)
        for L,ang,dx in zip(self.legs,leg_angles,legdx):
            px,py=L['pivot']
            base.alpha_composite(L['img'].rotate(ang,resample=Image.BICUBIC,center=(px,py),translate=(dx*self.H,0)))
        base.alpha_composite(self.body_img)
        return base

    def render(self, canvas, cfoot, p):
        """p: dict sx,sy,lean(frac of H),tx,ty(frac of H),rot(deg, + = top goes back/left),legs[list deg],tint(rgb,a),alpha"""
        src=self.posed(p.get('legs'),p.get('legdx'))
        a=np.array(src).astype(np.float32)/255.
        a[...,:3]*=a[...,3:4]
        Wc,Hc=canvas
        Y,X=np.mgrid[0:Hc,0:Wc].astype(np.float32)
        H=self.H
        sx=p.get('sx',1); sy=p.get('sy',1)
        u=X-cfoot[0]-p.get('tx',0)*H; v=Y-cfoot[1]-p.get('ty',0)*H
        th=math.radians(p.get('rot',0))
        if th:
            c,s=math.cos(th),math.sin(th)
            u,v=u*c-v*s, u*s+v*c
        lean=p.get('lean',0)*H
        if lean:
            t=np.clip(-v/(H*sy),0,1); u=u-lean*t**1.4
        xs=u/sx+self.foot[0]; ys=v/sy+self.foot[1]
        out=np.zeros((Hc,Wc,4),np.float32)
        for ch in range(4):
            out[...,ch]=ndimage.map_coordinates(a[...,ch],[ys,xs],order=1,cval=0)
        al=out[...,3:4]
        rgb=np.where(al>1e-4,out[...,:3]/np.maximum(al,1e-4),0)
        if 'tint' in p:
            col,amt=p['tint']; col=np.array(col,np.float32)/255.
            rgb=rgb*(1-amt)+col*amt
        alpha=al*p.get('alpha',1)
        return np.dstack([np.clip(rgb,0,1),alpha])

def sparkle(d,x,y,r,col):
    pts=[]
    for i in range(8):
        ang=i*math.pi/4; rr=r if i%2==0 else r*0.38
        pts.append((x+rr*math.cos(ang),y+rr*math.sin(ang)))
    d.polygon(pts,fill=col,outline=OUTLINE+(255,),width=max(1,int(r*0.18)))
