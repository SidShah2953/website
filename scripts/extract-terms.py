import re, os, glob, json, math, collections, sys
ROOT = "/Users/sidshah/Library/Mobile Documents/iCloud~md~obsidian/Documents/Personal/Projects/Website/src/content"

# WEIGHTED theme membership. Binary fin/da made 27% of terms an identical
# 50/50 blend; weights reflect what each piece is actually *about*.
W = {
 'asc350-gaap-loss':      {'fin':.75,'da':.25},   # an accounting rule
 'model-walkthrough':     {'fin':.80,'da':.20},   # a financial model
 'COIN-Research-202603':  {'fin':.70,'da':.30},   # income statement
 'coinbase-one':          {'fin':.75,'da':.25},   # subscription economics
 'deribit':               {'fin':.60,'da':.40},   # derivatives M&A
 'dcf-for-crypto':        {'fin':.60,'da':.40},
 'silver-bitcoin-trading':{'fin':.60,'da':.40},
 'developer-platform':    {'fin':.40,'da':.60},   # infrastructure
 'lego-fication-of-finance':{'fin':.40,'da':.60}, # composability
 'base-chain':            {'fin':.35,'da':.65},   # sequencer / OP stack
 'eth-staking':           {'fin':.35,'da':.65},
 'usdc-stablecoin':       {'fin':.30,'da':.70},
 'cryptos-transparency-paradox':{'da':1.0},
 'momentum-crude-oil-trading':{'fin':1.0},
 'stems-2024-talk':       {'fin':.85,'craft':.15},
 'svi-with-pyro':         {'tech':1.0},
 'bagged-ensemble-accuracy':{'tech':1.0},
 'ai-model-demo':         {'tech':1.0},
 'f1-lap-time-prediction':{'tech':.60,'craft':.40},
 'pyspark-vs-kdb':        {'tech':.50,'craft':.50},
 'greek-vase-volume-analysis':{'craft':1.0},
 'hfea-data':             {'craft':1.0},
 'macos-apps':            {'craft':1.0},
 'finlatics-baep':        {'craft':1.0},
}
THEMES=['fin','da','tech','craft']

STOP=set("""a about above after again against all am an and any are aren as at be because been before
being below between both but by can cannot could couldn did didn do does doesn doing don down during
each few for from further had hadn has hasn have haven having he her here hers herself him himself his
how i if in into is isn it its itself just let me more most mustn my myself no nor not of off on once
only or other ought our ours ourselves out over own same shan she should shouldn so some such than that
the their theirs them themselves then there these they this those through to too under until up very
was wasn we were weren what when where which while who whom why will with won would wouldn you your
yours yourself yourselves also may might one two three four five first second third new like much many
make makes made get gets got go goes going see sees seen say says said use used using uses way ways
thing things something anything everything nothing time times year years day days even still back well
good better best big small large long short high low right left next last part parts kind sort lot lots
bit end ends start starts case cases point points fact facts however therefore thus hence rather quite
really actually simply basically essentially example examples means meaning based upon within without
across among since given per via figure table section chapter note notes here there now then today
every another each both either neither same other others another around already always never often
show shows shown need needs needed want wants take takes taken come comes came look looks looking
find finds found give gives given put puts keep keeps know knows known think thinks thought
import export const let var function return default from require component components tab tabs
data value values model models analysis result results approach method methods number numbers
total level levels change changes different similar important significant potential current single
whether toward towards likely unlikely simply overall general specific particular
""".split())

def clean(md):
    md=re.sub(r'^---\n.*?\n---',' ',md,flags=re.S)
    md=re.sub(r'^\s*(import|export)\s+.*$',' ',md,flags=re.M)   # MDX statements
    md=re.sub(r'```.*?```',' ',md,flags=re.S)
    md=re.sub(r'`[^`]*`',' ',md)
    md=re.sub(r'\$\$.*?\$\$',' ',md,flags=re.S)
    md=re.sub(r'\$[^$\n]*\$',' ',md)
    md=re.sub(r'<[^>]+>',' ',md)
    md=re.sub(r'!\[[^\]]*\]\([^)]*\)',' ',md)
    md=re.sub(r'\[([^\]]*)\]\([^)]*\)',r'\1',md)
    md=re.sub(r'https?://\S+',' ',md)
    md=re.sub(r'[#>*_~|\\-]{1,}',' ',md)
    return md

WORD=re.compile(r"[a-z][a-z0-9'\-]{1,}")
docs=[]
for coll in ('blog','research','projects'):
    for f in glob.glob(f'{ROOT}/{coll}/**/*.md*',recursive=True):
        stem=os.path.basename(f).rsplit('.',1)[0]
        if stem not in W: print("!! unmapped",stem,file=sys.stderr); continue
        docs.append({'stem':stem,'w':W[stem],
            'toks':WORD.findall(clean(open(f,encoding='utf-8',errors='replace').read()).lower())})
N=len(docs)

def grams(toks):
    out=collections.Counter()
    for n in (1,2,3):
        for i in range(len(toks)-n+1):
            g=toks[i:i+n]
            if any(w in STOP for w in g) or any(len(w)<3 for w in g): continue
            out[' '.join(g)]+=1
    return out
per=[grams(d['toks']) for d in docs]
df=collections.Counter(); total=collections.Counter()
for c in per:
    total.update(c)
    for g in c: df[g]+=1

# corpus baseline mass per theme
base=collections.Counter()
for d in docs:
    for t,v in d['w'].items(): base[t]+=v
bs=sum(base.values())
baseline={t:base[t]/bs for t in THEMES}

rows={}
for g,tf in total.items():
    d=df[g]
    if tf<3 or (d<2 and tf<6): continue
    v=collections.Counter()
    for doc,c in zip(docs,per):
        if g in c:
            for t,wt in doc['w'].items(): v[t]+=c[g]*wt
    s=sum(v.values()) or 1
    dist={t:v[t]/s for t in THEMES}
    lift=max(dist[t]/baseline[t] for t in THEMES if baseline[t]>0)
    if lift<1.35: continue                      # must be characteristic of *something*
    n=g.count(' ')+1
    rows[g]={'score':tf*math.log(1+N/d)*(1+.55*(n-1)),'dist':dist,'tf':tf,'df':d,'lift':lift}

ranked=sorted(rows,key=lambda g:-rows[g]['score'])
keep=[]
for g in ranked:
    if any((g in k or k in g) and g!=k for k in keep): continue
    keep.append(g)
    if len(keep)>=120: break

out=[{'term':g,'score':round(rows[g]['score'],2),'tf':rows[g]['tf'],'df':rows[g]['df'],
      'lift':round(rows[g]['lift'],2),'dist':{k:round(v,3) for k,v in rows[g]['dist'].items()}} for g in keep]
json.dump(out,open('/tmp/terms.json','w'),indent=1)
flat=sum(1 for x in out if abs(x['dist']['fin']-x['dist']['da'])<0.03 and x['dist']['fin']>0.35)
print(f"docs={N}  kept={len(out)}  indistinguishable fin/da: {flat} ({100*flat//len(out)}%)\n")
for r in out[:55]:
    d=r['dist']; top=max(d,key=d.get)
    mix=' '.join(f"{k}:{int(d[k]*100)}" for k in THEMES if d[k]>0.04)
    print(f"{r['score']:7.1f} tf{r['tf']:>4} lift{r['lift']:>5.1f}  {r['term'][:34]:34} [{top:5}] {mix}")
