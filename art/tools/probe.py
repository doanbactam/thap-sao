import sys,os
sys.path.insert(0,os.path.dirname(__file__))
from iconlib import *
R=os.path.join(os.path.dirname(__file__),'..','raw_icons')
for g in sys.argv[1:]:
    im=despill(Image.open(os.path.join(R,g+'.png')))
    cs=components(im)
    print(g,len(cs),[c['area'] for c in cs])
    contact([c['img'] for c in cs],f'/tmp/probe_{g}.png',cell=120,cols=9)
