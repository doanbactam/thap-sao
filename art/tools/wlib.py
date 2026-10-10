# shared helpers for Thap Sao world art (adapted from Bo Lac v2 lib.py)
import numpy as np, os, json
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy import ndimage
ROOT=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..'))
ART=os.path.join(ROOT,'art'); RAW=os.path.join(ART,'raw_world')
PUB=os.path.join(ROOT,'public','assets'); SPR=os.path.join(PUB,'sprites'); UID=os.path.join(PUB,'ui')
FONT=os.path.join(PUB,'fonts','Baloo2.ttf')
OUTLINE=(59,36,22,255)
def font(sz,w='ExtraBold'):
    f=ImageFont.truetype(FONT,sz)
    try: f.set_variation_by_name(w)
    except Exception: pass
    return f
def load(n): return Image.open(os.path.join(RAW,n)).convert('RGBA')
def despill(im):
    a=np.array(im).astype(np.int32); al=a[...,3]
    r,g,b=a[...,0],a[...,1],a[...,2]
    chroma=(g>150)&(r<110)&(b<110)&(g-np.maximum(r,b)>80)
    al=np.where(chroma,0,al)
    trans=al<128
    edge=(~trans)&ndimage.binary_dilation(trans,iterations=3)
    mx=np.maximum(r,b)
    a[...,1]=np.where(edge&(g>mx+10),mx+(g-mx)//4,g)
    al=np.where(al<40,0,al); a[...,3]=al
    return Image.fromarray(np.clip(a,0,255).astype(np.uint8),'RGBA')
def fill_holes(im):
    """make enclosed transparent holes opaque again (keyer can eat light-green interiors)"""
    a=np.array(im); al=a[...,3]>40
    filled=ndimage.binary_fill_holes(al); holes=filled&~al
    return holes
def trim(im,pad=0):
    bb=im.getchannel('A').point(lambda v:255 if v>20 else 0).getbbox()
    im=im.crop(bb)
    if pad:
        o=Image.new('RGBA',(im.width+2*pad,im.height+2*pad),(0,0,0,0)); o.paste(im,(pad,pad)); im=o
    return im
def components(im,min_area=2500,merge=8,rowtol=None):
    al=np.array(im)[...,3]>40
    lab,n=ndimage.label(ndimage.binary_dilation(al,iterations=merge))
    items=[]
    for i,sl in enumerate(ndimage.find_objects(lab)):
        area=int(((lab[sl]==i+1)&al[sl]).sum())
        if area<min_area: continue
        ys,xs=sl
        sub=np.array(im).copy(); sub[...,3]=np.where(lab==i+1,sub[...,3],0)
        crop=Image.fromarray(sub,'RGBA').crop((xs.start,ys.start,xs.stop,ys.stop))
        items.append(dict(img=crop,cx=(xs.start+xs.stop)/2,cy=(ys.start+ys.stop)/2,h=ys.stop-ys.start,area=area,box=(xs.start,ys.start,xs.stop,ys.stop)))
    items.sort(key=lambda d:d['cy'])
    rows,cur=[],[]
    for it in items:
        tol=rowtol or max(60,(cur[-1]['h'] if cur else 0)*0.45)
        if cur and it['cy']-np.mean([c['cy'] for c in cur])>tol: rows.append(cur);cur=[]
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
    lay=np.zeros((big.height,big.width,4),np.uint8); lay[...]=color; lay[...,3]=(a*255).astype(np.uint8)
    base=Image.fromarray(lay,'RGBA'); base.alpha_composite(big)
    return base
def labeled(items,path,cell=200,cols=8):
    n=len(items); rows=(n+cols-1)//cols
    c=Image.new('RGB',(cols*cell,rows*cell),(232,220,192)); d=ImageDraw.Draw(c)
    for i,it in enumerate(items):
        im=it['img'] if isinstance(it,dict) else it
        t=fit(im,cell-30,cell-30); x=(i%cols)*cell; y=(i//cols)*cell
        c.paste(t,(x+15,y+22),t); d.text((x+4,y+2),str(i),fill=(200,0,0),font=font(20))
    c.save(path)
