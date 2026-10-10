import sys
from PIL import Image
files=sys.argv[2:]; out=sys.argv[1]; cell=360
cols=min(3,len(files)); rows=(len(files)+cols-1)//cols
c=Image.new('RGB',(cols*cell,rows*cell),(255,255,255))
for i,f in enumerate(files):
    im=Image.open(f).convert('RGB'); im.thumbnail((cell,cell)); c.paste(im,((i%cols)*cell,(i//cols)*cell))
c.save(out)
