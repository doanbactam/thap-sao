"""Compact animation summary: one row per key with selected frames (all anims, first N frames) at a fixed cell height."""
import sys,os,json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from charlib import *
rec=json.load(open(os.path.join(HERE,'_chars_rec.json')))
def frames(key):
    e=rec[key]; sh=Image.open(os.path.join(ROOT,'public','assets',e['file'])).convert('RGBA')
    FW,FH=e['frameW'],e['frameH']; cols=sh.width//FW
    out=[]
    for an,v in e['anims'].items():
        for fi in v['frames']:
            out.append((an,sh.crop(((fi%cols)*FW,(fi//cols)*FH,(fi%cols+1)*FW,(fi//cols+1)*FH))))
    return out,e
def summary(path,keys,cellh=90,maxw=2400):
    rows=[]
    for k in keys:
        fr,e=frames(k); s=cellh/e['frameH']
        cw=max(1,int(e['frameW']*s))
        r=checker(min(maxw,150+cw*len(fr)),cellh+14); d=ImageDraw.Draw(r); d.text((3,3),k,fill=(120,0,0))
        prev=None
        for i,(an,im) in enumerate(fr):
            x=150+i*cw
            if x+cw>maxw: break
            t=im.resize((cw,cellh),Image.LANCZOS); r.paste(t,(x,14),t)
            if an!=prev: d.text((x+2,1),an,fill=(0,0,140)); d.line([x,0,x,cellh+14],fill=(160,140,120))
            prev=an
            ax=x+e['anchor'][0]*cw; ay=14+e['anchor'][1]*cellh; d.point([(ax,ay)],fill=(255,0,0))
        rows.append(r)
    W=max(r.width for r in rows); H=sum(r.height for r in rows)
    c=Image.new('RGB',(W,H),(255,255,255)); y=0
    for r in rows: c.paste(r,(0,y)); y+=r.height
    c.save(path); return c
if __name__=='__main__':
    keys=[k for k in rec if any(k.startswith(p) for p in sys.argv[3:])]
    summary(sys.argv[1],keys,int(sys.argv[2]))
