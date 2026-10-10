# Chroma key / component slicing / stroke helpers (adapted from the v2 art pipeline build_sprites.py/lib.py)
import numpy as np, os
from PIL import Image, ImageDraw
from scipy import ndimage
OUTLINE=(59,36,22,255)
def despill(im):
    a=np.array(im.convert('RGBA')).astype(np.int32); al=a[...,3]
    r,g,b=a[...,0],a[...,1],a[...,2]
    chroma=(g>140)&(g-np.maximum(r,b)>70)&(r<140)&(b<140)
    al=np.where(chroma,0,al)
    trans=al<128
    edge=(~trans)&ndimage.binary_dilation(trans,iterations=3)
    mx=np.maximum(r,b)
    a[...,1]=np.where(edge&(g>mx+10),mx+(g-mx)//4,g)
    al=np.where(al<40,0,al); a[...,3]=al
    return Image.fromarray(np.clip(a,0,255).astype(np.uint8),'RGBA')
def trim(im):
    bb=im.getchannel('A').point(lambda v:255 if v>20 else 0).getbbox()
    return im.crop(bb) if bb else im
def components(im,min_area=1500,merge=6):
    al=np.array(im)[...,3]>40
    lab,n=ndimage.label(ndimage.binary_dilation(al,iterations=merge))
    items=[]
    for i,sl in enumerate(ndimage.find_objects(lab)):
        area=int(((lab[sl]==i+1)&al[sl]).sum())
        if area<min_area: continue
        ys,xs=sl
        sub=np.array(im).copy(); sub[...,3]=np.where(lab==i+1,sub[...,3],0)
        crop=Image.fromarray(sub,'RGBA').crop((xs.start,ys.start,xs.stop,ys.stop))
        items.append(dict(img=crop,cx=(xs.start+xs.stop)/2,cy=(ys.start+ys.stop)/2,h=ys.stop-ys.start,area=area))
    items.sort(key=lambda d:d['cy'])
    rows,cur=[],[]
    for it in items:
        if cur and it['cy']-np.mean([c['cy'] for c in cur])>max(40,cur[-1]['h']*0.5): rows.append(cur);cur=[]
        cur.append(it)
    if cur: rows.append(cur)
    out=[]
    for r in rows: out+=sorted(r,key=lambda d:d['cx'])
    return out
def fit(im,w,h):
    s=min(w/im.width,h/im.height)
    return im.resize((max(1,round(im.width*s)),max(1,round(im.height*s))),Image.LANCZOS)
def stroke(im,px=2,color=OUTLINE):
    pad=px+1
    big=Image.new('RGBA',(im.width+2*pad,im.height+2*pad),(0,0,0,0)); big.paste(im,(pad,pad))
    al=np.array(big)[...,3]>90
    dist=ndimage.distance_transform_edt(~al)
    a=np.clip((px+0.8-dist)/1.0,0,1)
    lay=np.zeros((big.height,big.width,4),np.uint8); lay[...]=color; lay[...,3]=(a*255).astype(np.uint8)
    base=Image.fromarray(lay,'RGBA'); base.alpha_composite(big); return base
def to_cell(im,size=96,stroke_px=2,margin=4):
    inner=size-2*margin-2*(stroke_px+1)
    t=fit(trim(im),inner,inner)
    t=stroke(t,stroke_px)
    c=Image.new('RGBA',(size,size),(0,0,0,0)); c.alpha_composite(t,((size-t.width)//2,(size-t.height)//2)); return c
def contact(items,path,cell=160,cols=8,labels=None):
    n=len(items); rows=(n+cols-1)//cols
    c=Image.new('RGB',(cols*cell,rows*cell),(232,220,192)); d=ImageDraw.Draw(c)
    for i,it in enumerate(items):
        t=fit(it,cell-24,cell-30); x=(i%cols)*cell; y=(i//cols)*cell
        c.paste(t,(x+12,y+22),t); d.text((x+4,y+4),labels[i] if labels else str(i),fill=(170,0,0))
    c.save(path)
