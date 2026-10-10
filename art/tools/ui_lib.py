from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
V2=os.path.dirname(os.path.abspath(__file__))
FONT=os.path.abspath(os.path.join(V2,'..','..','public','assets','fonts','Baloo2.ttf'))
def font(sz,w='ExtraBold'):
    f=ImageFont.truetype(FONT,sz)
    try: f.set_variation_by_name(w)
    except Exception: pass
    return f
P=dict(outline='#3B2416',shadow=(40,24,12,110),
  orange='#F4A63B',orange_hi='#FFCB6B',orange_lo='#D97B28',orange_lip='#A9531E',
  wood='#C98A4B',wood_hi='#E2A866',wood_lo='#A86B35',wood_lip='#7A4A24',
  green='#7CC44E',green_hi='#A6E070',green_lo='#5FA63A',green_lip='#3F7A25',
  red='#E2483D',red_hi='#FF7A66',red_lo='#C2352D',red_lip='#8E2420',
  purple='#8E6CD8',purple_hi='#B69BF0',purple_lo='#7353C0',purple_lip='#4E3592',
  cream='#FFF4DC',cream_lo='#F1DEB5',cream_lip='#CDB083',
  pill='#4A3426',pill_hi='#5E4433',
  track='#3A2A20',fill='#8BD14E',fill_hi='#B5EC7A',
  teal='#2FA4A8',text_dark='#3B2416',white='#FFFFFF')
SS=4
def canvas(w,h): return Image.new('RGBA',(w*SS,h*SS),(0,0,0,0))
def down(im,w,h): return im.resize((w,h),Image.LANCZOS)
def rr(d,box,r,fill,outline=None,width=0):
    x0,y0,x1,y1=[v*SS for v in box]
    d.rounded_rectangle((x0,y0,x1,y1),radius=r*SS,fill=fill,outline=outline,width=width*SS)
def chunky(w,h,r,face,hi,lo,lip,ol=4,lipd=6,pressed=False,shadow=True,inset_hi=True):
    """rounded chunky button: drop shadow, dark outline, bottom lip, face, top highlight band"""
    im=canvas(w,h); d=ImageDraw.Draw(im)
    if pressed: lipd=2
    top=0 if not pressed else 4
    if shadow:
        sh=canvas(w,h); sd=ImageDraw.Draw(sh); rr(sd,(2,top+4,w-2,h),r,P['shadow'])
        sh=sh.filter(ImageFilter.GaussianBlur(3*SS)); im.alpha_composite(sh)
    bh=h-4  # leave room for shadow
    rr(d,(0,top,w,bh),r,P['outline'])
    rr(d,(ol,top+ol,w-ol,bh-ol),r-ol,lip)
    rr(d,(ol,top+ol,w-ol,bh-ol-lipd),r-ol,face)
    if inset_hi:
        rr(d,(ol+3,top+ol+3,w-ol-3,top+ol+3+(bh-ol*2-lipd)*0.38),max(2,r-ol-3),hi)
        rr(d,(ol+3,top+ol+3+(bh-ol*2-lipd)*0.2,w-ol-3,bh-ol-lipd-3),max(2,r-ol-3),face)
    return im
def text(im,xy,s,sz,fill='#FFFFFF',stroke='#3B2416',sw=3,anchor='mm',w='ExtraBold'):
    d=ImageDraw.Draw(im); f=font(sz*SS if im.width>2000 else sz,w)
    d.text(xy,s,font=f,fill=fill,stroke_width=sw,stroke_fill=stroke,anchor=anchor)
