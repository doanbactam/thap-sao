import sys,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from charlib import *
from chars_spec import SPEC
keys=[k for k in SPEC if any(k.startswith(p) for p in sys.argv[2:])]
cell=170; cols=8; rows=(len(keys)+cols-1)//cols
c=checker(cols*cell,rows*cell); d=ImageDraw.Draw(c)
for i,k in enumerate(keys):
    im=Image.open(os.path.join(ROOT,'art','stills_chars',k+'.png'))
    im=stroke(im.resize((im.width//2,im.height//2),Image.LANCZOS))
    im.thumbnail((cell-10,cell-24))
    x=(i%cols)*cell; y=(i//cols)*cell
    c.paste(im,(x+5,y+18),im); d.text((x+3,y+2),k,fill=(120,0,0))
c.save(sys.argv[1])
