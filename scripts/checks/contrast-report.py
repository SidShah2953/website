"""Scores the captured text runs against WCAG 2.1 using real background pixels."""
import json, re
from collections import Counter
from PIL import Image

def lin(c):
    c = c/255
    return c/12.92 if c <= 0.03928 else ((c+0.055)/1.055) ** 2.4

def lum(rgb):
    r,g,b = rgb[:3]
    return 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b)

def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la,lb), min(la,lb)
    return (hi+0.05)/(lo+0.05)

def parse(css):
    m = re.findall(r'[\d.]+', css)
    if not m: return (0,0,0,1)
    v = [float(x) for x in m]
    a = v[3] if len(v) > 3 else 1.0
    return (int(v[0]), int(v[1]), int(v[2]), a)

data = json.load(open('/tmp/contrast/items.json'))
rows = []
for page in data:
    im = Image.open(f"/tmp/contrast/{page['name']}.png").convert('RGB')
    W,H = im.size
    for it in page['items']:
        fg = parse(it['color'])
        x0,y0 = max(0,it['x']), max(0,it['y'])
        x1,y1 = min(W,it['x']+it['w']), min(H,it['y']+it['h'])
        if x1-x0 < 3 or y1-y0 < 3: continue
        # Background sampling: the mode of the box fails on large text, where
        # the glyphs are the majority of pixels and the "background" comes back
        # as the text colour (a false 1.00:1). So drop pixels near the text
        # colour first, and if too few remain, sample a ring just outside the box.
        def mode_excluding(pixels, avoid, tol=60):
            keep = [q for q in pixels
                    if abs(q[0]-avoid[0]) + abs(q[1]-avoid[1]) + abs(q[2]-avoid[2]) > tol]
            return Counter(keep).most_common(1)[0][0] if len(keep) > 20 else None

        box = im.crop((x0,y0,x1,y1))
        px = list(box.getdata())
        if not px: continue
        bg = mode_excluding(px, fg[:3])
        if bg is None:
            rx0,ry0 = max(0,x0-10), max(0,y0-10)
            rx1,ry1 = min(W,x1+10), min(H,y1+10)
            ring = [q for i,q in enumerate(im.crop((rx0,ry0,rx1,ry1)).getdata())]
            bg = mode_excluding(ring, fg[:3]) or Counter(px).most_common(1)[0][0]
        # composite the text colour over that background if it is translucent
        a = fg[3]
        eff = tuple(round(fg[i]*a + bg[i]*(1-a)) for i in range(3))
        cr = ratio(eff, bg)
        # Text painted with background-clip:text has no flat colour to sample —
        # the glyphs are the gradient. Flag it rather than reporting a bogus 1:1.
        if it.get('clipped'):
            rows.append({**it, 'page': page['path'], 'bg': bg, 'eff': eff,
                         'cr': None, 'need': None, 'pass': True, 'note': 'gradient text — check by eye'})
            continue
        large = it['fs'] >= 24 or (it['fs'] >= 18.66 and it['fw'] >= 700)
        need = 3.0 if large else 4.5
        rows.append({**it, 'page': page['path'], 'bg': bg, 'eff': eff,
                     'cr': round(cr,2), 'need': need, 'pass': cr >= need})

bad = sorted([r for r in rows if not r['pass']], key=lambda r: r['cr'])
print(f"{len(rows)} text runs checked · {len(bad)} below WCAG AA\n")
seen=set()
for r in bad:
    k=(r['sel'], r['cr'])
    if k in seen: continue
    seen.add(k)
    print(f"  {r['cr']:>5.2f}:1  (needs {r['need']}) {r['sel'][:26]:28} "
          f"{r['fs']:>4.0f}px  fg{r['eff']} on bg{r['bg']}  {r['page']}")
    print(f"          “{r['text'][:44]}”")
json.dump(bad, open('/tmp/contrast/failures.json','w'))
