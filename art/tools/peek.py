# quick contact sheet: python3 peek.py out.png files...
import sys
from PIL import Image
out=sys.argv[1]; fs=sys.argv[2:]; S=400; cols=3; rows=(len(fs)+cols-1)//cols
c=Image.new('RGB',(cols*S,rows*S),(150,150,150))
for i,f in enumerate(fs):
    im=Image.open(f).convert('RGBA'); im.thumbnail((S-4,S-4)); bg=Image.new('RGBA',im.size,(230,220,200,255)); bg.alpha_composite(im)
    c.paste(bg.convert('RGB'),((i%cols)*S,(i//cols)*S))
c.save(out)
