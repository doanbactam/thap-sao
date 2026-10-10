"""Write public/assets/manifest.characters.json from the build records (chars + weapons). Ensure manifests.json lists it."""
import os,json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
from chars_spec import SPEC, WEAPONS
ch=json.load(open(os.path.join(HERE,'_chars_rec.json'))); wp=json.load(open(os.path.join(HERE,'_weapons_rec.json')))
man={}
for k in SPEC: man[k]=ch[k]
for k in WEAPONS: man[k]=wp[k]
missing=[k for k in list(SPEC)+list(WEAPONS) if k not in man]
assert not missing, missing
for k,e in man.items(): assert os.path.exists(os.path.join(ROOT,'public','assets',e['file'])),k
json.dump(man,open(os.path.join(ROOT,'public','assets','manifest.characters.json'),'w'),indent=1)
mp=os.path.join(ROOT,'public','assets','manifests.json')
lst=json.load(open(mp)) if os.path.exists(mp) else []
if 'manifest.characters.json' not in lst: lst.append('manifest.characters.json'); json.dump(lst,open(mp,'w'))
print('entries',len(man))
