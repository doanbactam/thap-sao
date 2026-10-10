# Assemble out/anim/<weapon>.json (base64 PNG crops from tools/anim-shots.mjs) into a 2x contact sheet PNG.
import json, base64, io, glob, sys
from PIL import Image
for f in sorted(glob.glob('out/anim/*.json')):
    fr = [Image.open(io.BytesIO(base64.b64decode(x))) for x in json.load(open(f))]
    cols = 6; W = Image.new('RGB', (120 * cols, 90 * ((len(fr) + cols - 1) // cols)))
    for i, im in enumerate(fr): W.paste(im, ((i % cols) * 120, (i // cols) * 90))
    W.resize((W.width * 2, W.height * 2)).save(f.replace('.json', '.png')); print(f)
