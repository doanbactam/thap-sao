"""UI kit (1x for 1280x720 + @2x), palette from Bo Lac v2 STYLE.md. Output public/assets/ui/*.png -> _ui_rec.json"""
from ui_lib import *
import json, math
OUT=os.path.abspath(os.path.join(V2,'..','..','public','assets','ui')); os.makedirs(OUT,exist_ok=True)
P.update(blue='#4FA3E8',blue_hi='#8CCBFF',blue_lo='#3A86C8',blue_lip='#245E96',
         hp='#E2483D',hp_hi='#FF8A70',mp='#4FA3E8',mp_hi='#9AD4FF',xp='#8BD14E',xp_hi='#B5EC7A',
         gold='#F5C542',gold_hi='#FFE38A',gold_lo='#D69A22',gold_lip='#9A6A12')
UI={}
def sv(name,mk,w,h,nine=None,desc='',anchor=None):
    for K in (1,2):
        im=down(mk(K),w*K,h*K); fn=f'{name}.png' if K==1 else f'{name}@2x.png'; im.save(os.path.join(OUT,fn))
    r=dict(type='image',file=f'ui/{name}.png',file2x=f'ui/{name}@2x.png',scale=1,anchor=anchor or [0.5,0.5],size=[w,h])
    if nine: r['nine']=nine
    if desc: r['desc']=desc
    UI[name]=r
def cb(w,h,r,col,K,ol=4,lip=6,shadow=True,pressed=False):
    return chunky(w*K,h*K,r*K,P[col],P[col+'_hi'],P[col+'_lo'],P[col+'_lip'],ol=ol*K,lipd=lip*K,shadow=shadow,pressed=pressed)
def circle(w,face,hi,lip,K,ol=3,lipd=3,shadow=True):
    im=canvas(w*K,w*K); d=ImageDraw.Draw(im); W=w*K*SS; o=ol*K*SS; l=lipd*K*SS
    if shadow:
        sh=canvas(w*K,w*K); ImageDraw.Draw(sh).ellipse((o,o*2,W-o,W),fill=P['shadow']); im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(2*K*SS)))
    d.ellipse((0,0,W-o,W-o),fill=P['outline']); d.ellipse((o,o,W-2*o,W-2*o),fill=lip); d.ellipse((o,o,W-2*o,W-2*o-l),fill=face)
    d.ellipse((o+W*0.14,o+W*0.08,W-2*o-W*0.14,o+W*0.36),fill=hi); d.ellipse((o+W*0.08,o+W*0.18,W-2*o-W*0.08,W-2*o-l-W*0.04),fill=face)
    return im
# buttons
sv('ui_btn_orange',lambda K:cb(104,92,18,'orange',K),104,92,[24,24,24,30],'primary square action button (bottom HUD); icon centred at y=38, label 15px at y=72')
sv('ui_btn_wood',lambda K:cb(104,92,18,'wood',K),104,92,[24,24,24,30],'secondary square button')
sv('ui_btn_green',lambda K:cb(160,56,16,'green',K,ol=3),160,56,[22,22,22,26],'confirm / CTA / + buttons')
sv('ui_btn_red',lambda K:cb(160,56,16,'red',K,ol=3),160,56,[22,22,22,26],'danger / close / sell')
sv('ui_btn_purple',lambda K:cb(60,60,16,'purple',K,ol=3,lip=5),60,60,[20,20,20,24],'side-column button')
sv('ui_btn_orange_pressed',lambda K:cb(104,92,18,'orange',K,pressed=True),104,92,[24,24,24,30],'pressed state (same size)')
# card / panel
def card(K,w=120,h=120):
    im=canvas(w*K,h*K); d=ImageDraw.Draw(im)
    sh=canvas(w*K,h*K); rr(ImageDraw.Draw(sh),(3*K,6*K,w*K-3*K,h*K),20*K,(40,24,12,90)); im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(4*K*SS)))
    rr(d,(0,0,w*K,h*K-5*K),22*K,P['outline']); rr(d,(4*K,4*K,w*K-4*K,h*K-9*K),18*K,P['cream_lip']); rr(d,(4*K,4*K,w*K-4*K,h*K-15*K),18*K,P['cream'])
    rr(d,(12*K,12*K,w*K-12*K,h*K-23*K),12*K,None,P['cream_lo'],2*K); return im
sv('ui_card_cream',card,120,120,[32,32,32,40],'cream card / tooltip / choice card; content inset 20; text #3B2416')
def pill(K):
    im=canvas(150*K,40*K); d=ImageDraw.Draw(im)
    sh=canvas(150*K,40*K); rr(ImageDraw.Draw(sh),(2*K,4*K,148*K,40*K),18*K,P['shadow']); im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(2*K*SS)))
    rr(d,(0,0,150*K,37*K),18*K,P['outline']); rr(d,(3*K,3*K,147*K,34*K),15*K,(74,52,38,255))
    hl=canvas(150*K,40*K); rr(ImageDraw.Draw(hl),(10*K,6*K,140*K,14*K),4*K,(255,255,255,30)); im.alpha_composite(hl); return im
sv('ui_pill_dark',pill,150,40,[22,22,18,20],'dark counter pill; icon 40px overlapping left cap, value Baloo 21px at x+40, ui_btn_plus at right end')
def panel_dark(K,w=160,h=120):
    im=canvas(w*K,h*K); d=ImageDraw.Draw(im); rr(d,(0,0,w*K,h*K),24*K,(59,36,22,190)); rr(d,(4*K,4*K,w*K-4*K,h*K-4*K),20*K,None,(255,240,210,50),2*K); return im
sv('ui_panel_dark',panel_dark,160,120,[28,28,28,28],'translucent dark tray (minimap, belts, bottom bar)')
# bars
def track(K):
    im=canvas(120*K,22*K); d=ImageDraw.Draw(im); rr(d,(0,0,120*K,22*K),11*K,P['outline']); rr(d,(3*K,3*K,117*K,19*K),8*K,P['track']); rr(d,(5*K,5*K,115*K,9*K),2*K,(255,255,255,20)); return im
sv('ui_bar_track',track,120,22,[12,12,11,11],'bar background; fills go inside at inset 3px')
for nm,c in [('hp','hp'),('mp','mp'),('xp','xp')]:
    def mk(K,c=c):
        im=canvas(120*K,16*K); d=ImageDraw.Draw(im); rr(d,(0,0,120*K,16*K),8*K,P[c]); rr(d,(4*K,3*K,116*K,7*K),2*K,P[c+'_hi']); return im
    sv(f'ui_bar_{nm}',mk,120,16,[9,9,8,8],f'{nm} fill (crop/scale width to value)')
# cells
def cell(K,border=None,face=None,glow=None):
    w=64; im=canvas(w*K,w*K); d=ImageDraw.Draw(im)
    if glow:
        g=canvas(w*K,w*K); rr(ImageDraw.Draw(g),(0,0,w*K,w*K),14*K,glow); im.alpha_composite(g.filter(ImageFilter.GaussianBlur(2*K*SS)))
    rr(d,(2*K,2*K,62*K,62*K),12*K,border or P['outline']); rr(d,(5*K,5*K,59*K,59*K),9*K,P['cream_lip'] if not face else face[0])
    rr(d,(5*K,9*K,59*K,59*K),9*K,P['cream_lo'] if not face else face[1]); return im
sv('ui_cell',lambda K:cell(K),64,64,[16,16,16,16],'inventory grid cell (recessed cream)')
sv('ui_cell_hi',lambda K:cell(K,border='#3F7A25',face=('#9FD36B','#D6F2A8'),glow=(166,224,112,200)),64,64,[16,16,16,16],'valid drop / highlighted cell')
sv('ui_cell_bad',lambda K:cell(K,border='#8E2420',face=('#E2483D','#F7B3A8'),glow=(226,72,61,200)),64,64,[16,16,16,16],'invalid drop cell')
# badge
sv('ui_badge_red',lambda K:circle(30,P['red'],P['red_hi'],P['red_lip'],K),30,30,None,'red count/alert badge; number Baloo 16px white/2px stroke')
sv('ui_btn_plus',lambda K:_plus(K),30,30,None,'green + at pill right end') if False else None
def _plus(K):
    b=cb(30,30,9,'green',K,ol=3,lip=3,shadow=False); d=ImageDraw.Draw(b); s=14*K*SS; cx=15*K*SS; cy=13*K*SS; t=s*0.18
    for box in [(cx-s/2,cy-t,cx+s/2,cy+t),(cx-t,cy-s/2,cx+t,cy+s/2)]: d.rounded_rectangle(box,radius=t,fill='#FFFFFF',outline=P['outline'],width=2*K*SS)
    d.rounded_rectangle((cx-s/2+2*K*SS,cy-t+2*K*SS,cx+s/2-2*K*SS,cy+t-2*K*SS),radius=t,fill='#FFFFFF'); return b
sv('ui_btn_plus',_plus,30,30,None,'green + at pill right end')
def _close(K):
    c=circle(36,P['red'],P['red_hi'],P['red_lip'],K); d=ImageDraw.Draw(c); W=36*K*SS
    for col,wd in [(P['outline'],8),('#FFF',4)]:
        d.line((W*0.32,W*0.3,W*0.6,W*0.58),fill=col,width=int(wd*K*SS)); d.line((W*0.6,W*0.3,W*0.32,W*0.58),fill=col,width=int(wd*K*SS))
    return c
sv('ui_btn_close',_close,36,36,None,'close button for cards')
sv('ui_card_header',lambda K:cb(160,44,14,'orange',K,ol=3,lip=5,shadow=False),160,44,[20,20,18,22],'title ribbon on card top edge')
# joystick
def joy_base(K):
    w=160; im=canvas(w*K,w*K); d=ImageDraw.Draw(im); W=w*K*SS
    d.ellipse((0,0,W,W),fill=(59,36,22,110)); d.ellipse((5*K*SS,5*K*SS,W-5*K*SS,W-5*K*SS),outline=(255,244,220,150),width=4*K*SS)
    for a in range(4):
        ang=a*math.pi/2; cx=W/2+math.cos(ang)*W*0.36; cy=W/2+math.sin(ang)*W*0.36; s=7*K*SS
        pts=[(cx+math.cos(ang)*s,cy+math.sin(ang)*s),(cx+math.cos(ang+2.3)*s,cy+math.sin(ang+2.3)*s),(cx+math.cos(ang-2.3)*s,cy+math.sin(ang-2.3)*s)]
        d.polygon(pts,fill=(255,244,220,170))
    return im
sv('ui_joystick_base',joy_base,160,160,None,'virtual joystick base (translucent)')
sv('ui_joystick_knob',lambda K:circle(72,P['orange'],P['orange_hi'],P['orange_lip'],K,ol=4,lipd=5),72,72,None,'joystick knob')
# rarity frames (transparent centre, overlay on card/icon)
RAR={'common':('#B8B0A0','#E2DCCD','#8C8474'),'rare':('#4FA3E8','#9AD4FF','#245E96'),'epic':('#A064E6','#CDA8F7','#5E3496'),'legendary':('#F5B731','#FFE38A','#B07612')}
for nm,(c,hi,lo) in RAR.items():
    def mk(K,c=c,hi=hi,lo=lo):
        w=112; im=canvas(w*K,w*K); d=ImageDraw.Draw(im)
        if nm=='legendary' or nm=='epic':
            g=canvas(w*K,w*K); rr(ImageDraw.Draw(g),(2*K,2*K,110*K,110*K),22*K,None,c,6*K); im.alpha_composite(g.filter(ImageFilter.GaussianBlur(3*K*SS)))
        rr(d,(4*K,4*K,108*K,108*K),20*K,None,P['outline'],14*K)
        rr(d,(7*K,7*K,105*K,105*K),17*K,None,lo,8*K)
        rr(d,(7*K,7*K,105*K,103*K),17*K,None,c,6*K)
        rr(d,(10*K,9*K,102*K,30*K),12*K,None,hi,2*K) if False else None
        d.arc((9*K*SS,9*K*SS,60*K*SS,60*K*SS),185,265,fill=hi,width=3*K*SS)
        rr(d,(15*K,15*K,97*K,97*K),11*K,None,P['outline'],3*K)
        if nm=='legendary':
            for (x,y) in [(56,6),(6,56),(106,56),(56,106)]:
                s=7; pts=[]
                for j in range(8):
                    a=-math.pi/2+j*math.pi/4; r=s if j%2==0 else s*0.45; pts.append(((x+r*math.cos(a))*K*SS,(y+r*math.sin(a))*K*SS))
                d.polygon(pts,fill=hi,outline=P['outline'],width=int(1.5*K*SS))
        return im
    sv(f'ui_rarity_frame_{nm}',mk,112,112,[30,30,30,30],f'{nm} rarity frame, transparent centre')
def star(K,on=True):
    w=32; im=canvas(w*K,w*K); d=ImageDraw.Draw(im); c=w/2
    def pts(r1,r2,oy=0): 
        return [((c+(r1 if j%2==0 else r2)*math.cos(-math.pi/2+j*math.pi/5))*K*SS,(c+1+oy+(r1 if j%2==0 else r2)*math.sin(-math.pi/2+j*math.pi/5))*K*SS) for j in range(10)]
    d.polygon(pts(15,7.2),fill=P['outline'])
    d.polygon(pts(12,5.6),fill=P['gold'] if on else '#7A6A5A')
    d.polygon(pts(7,3.2,-2),fill=P['gold_hi'] if on else '#9A8A78')
    return im
sv('ui_star_on',lambda K:star(K,True),32,32,None,'rarity / level star filled')
sv('ui_star_off',lambda K:star(K,False),32,32,None,'empty star')
json.dump(UI,open(os.path.join(V2,'_ui_rec.json'),'w'),indent=1)
print(len(UI),'ui keys')
