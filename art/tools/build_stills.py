"""Key + slice + scale raw generations into high-res stills (2x the stored size) in art/stills_chars/."""
import sys, os, json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from charlib import *
from chars_spec import SPEC
OUT=os.path.join(ROOT,'art','stills_chars'); os.makedirs(OUT,exist_ok=True)
SS=2  # supersample factor for rig work
cache={}
HUE={'en_slime_moss':28}
DEGREEN={'boss_fallen_star','en_nebula_healer'}
def hue_shift(im,deg):
    import colorsys
    a=np.array(im).astype(np.float32)/255.
    hsv=np.array(Image.fromarray((a[...,:3]*255).astype(np.uint8)).convert('HSV')).astype(np.float32)
    sat=hsv[...,1]>60; val=hsv[...,2]>70
    hsv[...,0]=np.where(sat&val,(hsv[...,0]+deg*255/360)%255,hsv[...,0])
    rgb=np.array(Image.fromarray(hsv.astype(np.uint8),'HSV').convert('RGB'))
    return Image.fromarray(np.dstack([rgb,(a[...,3]*255).astype(np.uint8)]),'RGBA')
def get(f):
    if f not in cache: cache[f]=key(Image.open(os.path.join(RAW,f)))
    return cache[f]
only=sys.argv[1:]
for k,(f,ci,flip,kind,h,wf,hr,cat) in SPEC.items():
    if only and k not in only: continue
    im=get(f)
    if ci is not None: im=components(im)[ci]['img']
    im=trim(im)
    if flip: im=im.transpose(Image.FLIP_LEFT_RIGHT)
    if k in HUE: im=hue_shift(im,HUE[k])
    if k in DEGREEN:   # glow auras blended with the chroma bg: pull green-dominant pixels back to violet/blue
        a=np.array(im).astype(np.int32); r,g,b_=a[...,0],a[...,1],a[...,2]
        m=g>np.maximum(r,b_); a[...,1]=np.where(m,np.minimum(r,b_),g); im=Image.fromarray(a.astype(np.uint8),'RGBA')
    st=fit(im,w=int(h*wf*SS),h=h*SS)
    st.save(os.path.join(OUT,k+'.png'))
print('ok')
