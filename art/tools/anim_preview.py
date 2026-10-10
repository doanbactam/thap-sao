"""Preview: every anim of a key as rows of frames on a checker (scaled x2), with an anchor cross. -> /tmp or given path"""
import sys,os,json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from charlib import *
rec=json.load(open(os.path.join(HERE,'_chars_rec.json')))
def strip(key,zoom=1.0):
    e=rec[key]; sh=Image.open(os.path.join(ROOT,'public','assets',e['file'])).convert('RGBA')
    FW,FH=e['frameW'],e['frameH']; cols=sh.width//FW
    an=e['anims']; maxf=max(len(v['frames']) for v in an.values())
    W=int(FW*zoom); Hh=int(FH*zoom)
    c=checker(maxf*W+90,len(an)*Hh); d=ImageDraw.Draw(c)
    for r,(name,v) in enumerate(an.items()):
        d.text((4,r*Hh+4),name,fill=(120,0,0))
        for j,fi in enumerate(v['frames']):
            fr=sh.crop(((fi%cols)*FW,(fi//cols)*FH,(fi%cols+1)*FW,(fi//cols+1)*FH)).resize((W,Hh),Image.NEAREST if zoom>=1 else Image.LANCZOS)
            x=90+j*W; y=r*Hh
            c.paste(fr,(x,y),fr)
            ax=x+e['anchor'][0]*W; ay=y+e['anchor'][1]*Hh
            d.line([ax-4,ay,ax+4,ay],fill=(255,0,0)); d.line([ax,ay-4,ax,ay+4],fill=(255,0,0))
            d.rectangle([x,y,x+W-1,y+Hh-1],outline=(200,190,170))
    return c
if __name__=='__main__':
    out=sys.argv[1]; keys=sys.argv[3:]; z=float(sys.argv[2])
    ims=[strip(k,z) for k in keys]
    W=max(i.width for i in ims); H=sum(i.height for i in ims)
    c=Image.new('RGB',(W,H),(255,255,255)); y=0
    for i in ims: c.paste(i,(0,y)); y+=i.height
    c.save(out)
