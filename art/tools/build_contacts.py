"""Contact sheets (art/sheets/sheet_*.png) = still grid + per-character animation strips; GIF previews art/sheets/anim_*.gif."""
import sys,os,json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from charlib import *
from summary import frames, summary
from chars_spec import SPEC, WEAPONS
OUT=os.path.join(ROOT,'art','sheets'); os.makedirs(OUT,exist_ok=True)
rec=json.load(open(os.path.join(HERE,'_chars_rec.json')))
wrec=json.load(open(os.path.join(HERE,'_weapons_rec.json')))
GROUPS={'hero':[k for k in SPEC if k.startswith(('hero_','cmp_'))],
        'enemies':[k for k in SPEC if k.startswith('en_')],
        'bosses':[k for k in SPEC if k.startswith(('mb_','boss_'))],
        'npcs':[k for k in SPEC if k.startswith('npc_')]}
def grid(keys,cell,cols,title,extra=None):
    rows=(len(keys)+cols-1)//cols
    c=checker(cols*cell,rows*cell+30); d=ImageDraw.Draw(c); d.text((6,8),title,fill=(90,40,20))
    for i,k in enumerate(keys):
        fr,e=frames(k); im=fr[0][1]
        # show at on-screen size x2 (=stored size), bounded by cell
        im=trim(im); im.thumbnail((cell-12,cell-26))
        x=(i%cols)*cell; y=30+(i//cols)*cell
        c.paste(im,(x+(cell-im.width)//2,y+cell-8-im.height),im); d.text((x+4,y+3),k,fill=(120,0,0))
    return c
for g,keys in GROUPS.items():
    cell={'hero':170,'enemies':150,'bosses':300,'npcs':170}[g]; cols={'hero':9,'enemies':10,'bosses':6,'npcs':7}[g]
    top=grid(keys,cell,cols,f'Thap Sao - {g} (frame 0, stored 2x size)')
    parts=[top]
    if g=='hero':
        wk=list(WEAPONS); wc=Image.new('RGB',(top.width,120),(236,226,200)); d=ImageDraw.Draw(wc); x=10
        for k in wk:
            im=Image.open(os.path.join(ROOT,'public','assets',wrec[k]['file'])).convert('RGBA'); im=im.resize((im.width*2,im.height*2),Image.LANCZOS)
            wc.paste(im,(x,25),im); a=wrec[k]['anchor']; ax=x+a[0]*im.width; ay=25+a[1]*im.height
            d.ellipse([ax-3,ay-3,ax+3,ay+3],outline=(255,0,0)); d.text((x,5),k,fill=(120,0,0)); x+=im.width+30
        parts.append(wc)
    strips=summary('/tmp/_strip.png',keys,{'hero':80,'enemies':64,'bosses':120,'npcs':90}[g],maxw=10000)
    parts.append(strips)
    W=max(p.width for p in parts); H=sum(p.height for p in parts)
    sh=Image.new('RGB',(W,H),(255,255,255)); y=0
    for p in parts: sh.paste(p,(0,y)); y+=p.height
    if sh.width>4000: sh=sh.resize((4000,int(sh.height*4000/sh.width)),Image.LANCZOS)
    sh.save(os.path.join(OUT,f'sheet_{g}.png'))
    # GIF: grid of characters, all anims played in sequence
    seq={}
    L=0
    for k in keys:
        fr,e=frames(k); seq[k]=[im for an,im in fr]; L=max(L,len(fr))
    cell=cell; cols=min(cols,6); rows=(len(keys)+cols-1)//cols
    gif=[]
    for t in range(L):
        c=Image.new('RGB',(cols*cell,rows*cell),(98,128,76)); d=ImageDraw.Draw(c)
        for i,k in enumerate(keys):
            fr,e=frames(k) if False else (None,rec[k])
            im=seq[k][t%len(seq[k])].copy(); s=min((cell-8)/im.width,(cell-8)/im.height,1.0)
            im=im.resize((max(1,int(im.width*s)),max(1,int(im.height*s))),Image.LANCZOS)
            x=(i%cols)*cell; y=(i//cols)*cell
            ax=x+cell//2-int(e['anchor'][0]*im.width); ay=y+cell-10-int(e['anchor'][1]*im.height)
            c.paste(im,(ax,ay),im)
        gif.append(c.convert('P',palette=Image.ADAPTIVE,colors=200))
    gif[0].save(os.path.join(OUT,f'anim_{g}.gif'),save_all=True,append_images=gif[1:],duration=110,loop=0)
    print(g,sh.size)
