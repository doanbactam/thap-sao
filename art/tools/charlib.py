"""Tháp Sao character pipeline helpers: keying, despill, slicing, fitting, stroke."""
import numpy as np, os
from PIL import Image, ImageDraw
from scipy import ndimage
HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
RAW=os.path.join(ROOT,'art','raw_chars')
OUTLINE=(59,36,22)

def border_color(a):
    b=np.concatenate([a[:8].reshape(-1,3),a[-8:].reshape(-1,3),a[:,:8].reshape(-1,3),a[:,-8:].reshape(-1,3)])
    return np.median(b,0)

def key(im):
    """remove a flat chroma background (green / magenta / any flat colour sampled from the border)."""
    a=np.array(im.convert('RGB')).astype(np.int32)
    r,g,b=a[...,0],a[...,1],a[...,2]
    bg=border_color(a)
    dist=np.sqrt(((a-bg)**2).sum(-1))
    bgm = dist<70
    if bg[1]>bg[0]+40 and bg[1]>bg[2]+40:       # green family
        fam=(g>1.45*np.maximum(r,b)+5)&(g>70)
        mode='g'
    elif bg[0]>bg[1]+40 and bg[2]>bg[1]+40:     # magenta family
        fam=(np.minimum(r,b)>1.35*g+10)&(np.minimum(r,b)>80)&(np.abs(r-b)<90)
        mode='m'
    else:
        fam=np.zeros_like(bgm); mode='x'
    bgm=bgm|fam
    # only remove regions connected to the border OR big enough (holes between limbs)
    lab,n=ndimage.label(bgm)
    keep=np.zeros(n+1,bool)
    edge=np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]]))
    keep[edge]=True
    sizes=ndimage.sum(np.ones_like(lab),lab,range(n+1))
    keep[sizes>150]=True; keep[0]=False
    bgm=keep[lab]
    if mode=='g': bgm|=(g>170)&(r<110)&(b<110)&(g>1.8*np.maximum(r,b))   # enclosed pure-chroma holes
    if mode=='m': bgm|=(r>170)&(b>170)&(g<90)
    fg=~bgm
    fg=ndimage.binary_opening(fg,iterations=1)
    # drop specks
    lab,n=ndimage.label(fg); sizes=ndimage.sum(fg,lab,range(n+1))
    fg=(sizes>60)[lab]&fg
    # despill an edge band
    near=ndimage.binary_dilation(~fg,iterations=3)&fg
    out=a.copy()
    if mode=='g':
        mx=np.maximum(r,b); sp=near&(g>mx+12)
        out[...,1]=np.where(sp,mx+(g-mx)//5,g)
        # strongly spilled pixels -> outline
        hard=near&(g>1.25*mx+20)&(g>90)
        out[hard]=OUTLINE
    elif mode=='m':
        mn=np.minimum(r,b); sp=near&(mn>g+20)
        out[...,0]=np.where(sp,np.minimum(r,g+(r-g)//3+20),r)
        out[...,2]=np.where(sp,np.minimum(b,g+(b-g)//3),b)
        hard=near&(mn>1.3*g+30)
        out[hard]=OUTLINE
    else:
        sp=near&(dist<120); out[sp]=OUTLINE
    al=np.where(fg,255,0)
    rgba=np.dstack([np.clip(out,0,255),al]).astype(np.uint8)
    return Image.fromarray(rgba,'RGBA')

def trim(im,thr=20):
    bb=im.getchannel('A').point(lambda v:255 if v>thr else 0).getbbox()
    return im.crop(bb) if bb else im

def components(im,merge=14,min_area=3000):
    al=np.array(im)[...,3]>40
    lab,n=ndimage.label(ndimage.binary_dilation(al,iterations=merge))
    items=[]
    arr=np.array(im)
    for i,sl in enumerate(ndimage.find_objects(lab)):
        m=(lab[sl]==i+1)&al[sl]; area=int(m.sum())
        if area<min_area: continue
        sub=arr[sl].copy(); sub[...,3]=np.where(lab[sl]==i+1,sub[...,3],0)
        ys,xs=sl
        items.append(dict(img=Image.fromarray(sub,'RGBA'),cx=(xs.start+xs.stop)/2,cy=(ys.start+ys.stop)/2,
                          box=(xs.start,ys.start,xs.stop,ys.stop),area=area,h=ys.stop-ys.start))
    # reading order: rows then x
    items.sort(key=lambda d:d['cy'])
    rows,cur=[],[]
    for it in items:
        if cur and it['cy']-np.mean([c['cy'] for c in cur])>max(80,np.mean([c['h'] for c in cur])*0.5): rows.append(cur);cur=[]
        cur.append(it)
    if cur: rows.append(cur)
    out=[]
    for r in rows: out+=sorted(r,key=lambda d:d['cx'])
    return out

def fit(im,w=None,h=None):
    if w and h: s=min(w/im.width,h/im.height)
    elif w: s=w/im.width
    else: s=h/im.height
    return im.resize((max(1,round(im.width*s)),max(1,round(im.height*s))),Image.LANCZOS)

def stroke(im,px=2,color=OUTLINE):
    pad=px+1
    big=Image.new('RGBA',(im.width+2*pad,im.height+2*pad),(0,0,0,0)); big.paste(im,(pad,pad))
    al=np.array(big)[...,3]>90
    dist=ndimage.distance_transform_edt(~al)
    a=np.clip((px+0.8-dist)/1.0,0,1)
    lay=np.zeros((big.height,big.width,4),np.uint8); lay[...,:3]=color; lay[...,3]=(a*255).astype(np.uint8)
    base=Image.fromarray(lay,'RGBA'); base.alpha_composite(big)
    return base

def checker(w,h,c1=(236,226,200),c2=(222,210,182),s=12):
    im=Image.new('RGB',(w,h),c1); d=ImageDraw.Draw(im)
    for y in range(0,h,s):
        for x in range(0,w,s):
            if (x//s+y//s)%2: d.rectangle([x,y,x+s-1,y+s-1],fill=c2)
    return im
