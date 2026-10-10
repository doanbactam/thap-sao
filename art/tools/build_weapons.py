"""Weapons: key + slice art/raw_chars/weapons.png, rotate to point right (handle left), size, stroke, grip origin."""
import sys,os,json,math
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from charlib import *
from chars_spec import WEAPONS
OUT=os.path.join(ROOT,'public','assets','sprites')
REC=os.path.join(HERE,'_weapons_rec.json')
src=key(Image.open(os.path.join(RAW,'weapons.png')))
comps=components(src,merge=10,min_area=2000)
rec={}
FORCE_FLIP={'wpn_katana'}  # PCA end-heuristic picks the wrong end for the slim katana
for k,(ci,L,kind) in WEAPONS.items():
    im=trim(comps[ci]['img'])
    if kind!='shield':
        a=np.array(im)[...,3]>100; ys,xs=np.nonzero(a)
        c=np.cov(np.vstack([xs-xs.mean(),ys-ys.mean()]))
        ev,evec=np.linalg.eigh(c); v=evec[:,1]
        ang=math.degrees(math.atan2(v[1],v[0]))
        if ang>90: ang-=180
        if ang<-90: ang+=180
        im=trim(im.rotate(ang,resample=Image.BICUBIC,expand=True))   # PIL ccw; image y down -> rotate by +ang levels it
        if kind=='staff' or kind=='blade':
            # handle = thinner end: compare alpha mass of left vs right 25%
            a=np.array(im)[...,3]>100; w=a.shape[1]
            if a[:,:w//4].sum()>a[:,-w//4:].sum() and kind=='blade': im=im.transpose(Image.FLIP_LEFT_RIGHT)
        if k in FORCE_FLIP: im=im.transpose(Image.FLIP_LEFT_RIGHT)
        im=fit(im,w=L-4)
    else:
        im=fit(im,h=L-4)
    im=stroke(im,2)
    a=np.array(im)[...,3]>100; H,W=a.shape
    if kind=='blade':
        prof=a.sum(0); guard=int(np.argmax(prof[:int(W*0.6)]))
        gx=max(3,guard//2+2); col=np.nonzero(a[:,gx])[0]; gy=(col.mean() if len(col) else H/2)
        origin=[round(gx/W,3),round(float(gy)/H,3)]
    elif kind=='staff':
        gx=int(W*0.28); col=np.nonzero(a[:,gx])[0]; origin=[round(gx/W,3),round(float(col.mean() if len(col) else H/2)/H,3)]
    elif kind=='crossbow':
        origin=[0.32,0.62]
    else: origin=[0.5,0.5]
    im.save(os.path.join(OUT,k+'.png'))
    rec[k]=dict(type='image',file=f'sprites/{k}.png',anchor=origin,scale=0.5,facing='right')
    print(k,im.size,origin)
json.dump(rec,open(REC,'w'),indent=1)
