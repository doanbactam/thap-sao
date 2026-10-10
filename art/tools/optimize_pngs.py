"""Palette-quantize (256 colours, alpha kept, no dither) every character sheet + weapon listed in manifest.characters.json.
Run LAST (after build_chars / build_weapons). Cuts disk size ~75%; GPU memory is unchanged."""
import os,json
from PIL import Image
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
m=json.load(open(os.path.join(ROOT,'public','assets','manifest.characters.json')))
b0=b1=0
for k,e in m.items():
    p=os.path.join(ROOT,'public','assets',e['file']); im=Image.open(p)
    b0+=os.path.getsize(p)
    if im.mode!='P':
        im.convert('RGBA').quantize(256,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE).save(p,optimize=True)
    b1+=os.path.getsize(p)
print('bytes',b0,'->',b1)
