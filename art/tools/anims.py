"""Animation tables for the cut-out rig. Each anim = list of frame param dicts (see rig.Rig.render)."""
import math
WHITE=(255,255,255); RED=(235,70,60); VIOLET=(170,110,255); TEAL=(90,220,220)

def idle(kind):
    if kind in ('flyer',):
        return [dict(ty=-t*0.05,sy=1+t*0.03,sx=1-f) for t,f in ((0,0),(0.5,0.1),(1,0.02),(0.5,0.1))]
    if kind in ('blob','sleeper'):
        return [dict(sy=1-t*0.07,sx=1+t*0.05) for t in (0,0.5,1,0.5)]
    if kind=='static':
        return [dict(sy=1-t*0.035,sx=1+t*0.02) for t in (0,0.5,1,0.5)]
    return [dict(sy=1-t*0.045,sx=1+t*0.025,lean=t*0.015) for t in (0,0.5,1,0.5)]

def run(kind, nlegs):
    fr=[]
    for i in range(6):
        ph=i/6*2*math.pi; s=math.sin(ph); c=math.cos(ph)
        if kind=='flyer':
            fr.append(dict(ty=-0.04-0.04*abs(s),rot=-6,lean=0.03,sx=1.02-(0.1 if i%2 else 0),sy=1+(0.03 if i%2 else 0)))
        elif kind=='blob':
            k=[(0.84,1.12,0),(1.06,0.95,-0.06),(1.12,0.9,-0.1),(1.04,0.97,-0.08),(0.94,1.05,-0.03),(0.82,1.14,0)][i]
            fr.append(dict(sy=k[0],sx=k[1],ty=k[2],lean=0.04))
        elif kind=='static':
            fr.append(dict(tx=0.012*s,sy=1-0.03*abs(s),sx=1+0.02*abs(s)))
        else:
            A=30 if kind=='biped' else 22; D=0.035
            if nlegs>=2:
                sg=[1,-1] if nlegs==2 else [(1 if j%2==0 else -1) for j in range(nlegs)]
                fr.append(dict(legs=[A*s*g for g in sg],legdx=[D*s*g for g in sg],ty=-0.04*abs(c),lean=0.05,sy=1-0.02*abs(s)))
            else:  # no legs found: waddle hop
                fr.append(dict(ty=-0.06*abs(s),rot=-4*s,lean=0.05,sy=1-0.04*abs(c),sx=1+0.03*abs(c)))
    return fr

def legs_pose(nlegs,front,back):
    if nlegs<2: return None
    if nlegs==2: return [back,front]
    return [front if j%2 else back for j in range(nlegs)]

def attack(kind,nlegs):
    L=lambda f,b: legs_pose(nlegs,f,b) if kind in ('biped','quad') else None
    if kind=='flyer':
        return [dict(lean=-0.08,tx=-0.04,sx=0.95,sy=1.04,ty=-0.03),dict(lean=0.12,tx=0.1,sx=1.14,sy=0.92,rot=-8),
                dict(lean=0.07,tx=0.06,sx=1.05,rot=-4),dict(lean=0.02,tx=0.015)]
    if kind=='static':
        return [dict(sx=0.92,sy=1.06,tx=-0.02),dict(sx=1.1,sy=0.92,tx=0.03),dict(sx=1.03,sy=0.97,tx=-0.04),dict(tx=-0.01)]
    return [dict(lean=-0.09,tx=-0.04,sx=0.95,sy=1.04,legs=L(-10,10)),
            dict(lean=0.14,tx=0.09,sx=1.12,sy=0.92,legs=L(26,-22)),
            dict(lean=0.08,tx=0.06,sx=1.05,sy=0.97,legs=L(18,-14)),
            dict(lean=0.02,tx=0.015,legs=L(5,-4))]

def hurt(kind):
    return [dict(lean=-0.1,tx=-0.05,sx=0.94,sy=1.04,tint=(WHITE,0.55)),dict(lean=-0.05,tx=-0.025,tint=(RED,0.35))]

def die(kind):
    fl= kind=='flyer'
    return [dict(lean=-0.1,tx=-0.04,tint=(WHITE,0.6)),
            dict(lean=-0.06,rot=10,ty=-0.06 if not fl else -0.02,tint=(RED,0.25)),
            dict(rot=24,sy=0.9,sx=1.05,ty=0),
            dict(rot=14,sy=0.55,sx=1.2,alpha=0.85),
            dict(rot=6,sy=0.3,sx=1.32,alpha=0.45)]

def dash(kind):
    return [dict(lean=0.16,sx=1.14,sy=0.9,ghosts=[(-0.16,0.38),(-0.32,0.18)],legs_k=(-20,30)),
            dict(lean=0.2,sx=1.22,sy=0.86,ghosts=[(-0.18,0.4),(-0.36,0.2)],legs_k=(-25,35)),
            dict(lean=0.07,sx=1.05,sy=0.97,ghosts=[(-0.14,0.2)],legs_k=(-8,12))]

def cast(kind):
    return [dict(sy=0.92,sx=1.05),
            dict(sy=1.07,sx=0.96,ty=-0.04,sparks=(0.35,0.6),tint=(TEAL,0.1)),
            dict(sy=1.1,sx=0.94,ty=-0.06,sparks=(0.55,1.0),tint=(TEAL,0.16)),
            dict(sy=1.0,ty=-0.02,sparks=(0.7,0.5),tint=(TEAL,0.08))]

def attack2(kind):
    return [dict(sy=0.84,sx=1.1,lean=-0.03),dict(sy=1.1,sx=0.92,ty=-0.13,lean=0.04),
            dict(sy=0.74,sx=1.26,ty=0,tint=(WHITE,0.2)),dict(sy=1.04,sx=0.97)]

def phase(kind):
    return [dict(tint=(WHITE,0.45),aura=0.4),dict(sx=1.05,sy=1.05,tx=0.02,tint=(VIOLET,0.3),aura=1.0),
            dict(sx=1.09,sy=1.09,tx=-0.02,tint=(VIOLET,0.4),aura=1.0),dict(sx=1.03,sy=1.03,tint=(VIOLET,0.12),aura=0.5)]

FPS=dict(idle=6,run=12,attack=14,dash=16,cast=10,hurt=10,die=10,attack2=10,phase=8)
LOOP=dict(idle=True,run=True)
