#!/usr/bin/env python3
"""
Wrap the first few prose occurrences of each theme term in <T k="slug">...</T>.

Masks everything that must never be touched — frontmatter, fenced and inline
code, headings (they drive the TOC), markdown links and images, existing HTML
or JSX tags, MDX import/export lines, and LaTeX — then matches only against
what's left. Idempotent: files already carrying <T> markers are skipped.
"""
import re, sys, glob, os

ROOT = os.path.join(os.path.dirname(__file__), "..", "src", "content")
MAX_PER_THEME = 3

# theme slug -> surface forms to look for, longest first
FORMS = {
 "composability":          [r"composabilit(?:y|ies)", r"composable"],
 "tokenization":           [r"tokeni[sz]ation", r"tokeni[sz]ed"],
 "stablecoins":            [r"stablecoins?"],
 "staking":                [r"staking"],
 "onchain-infrastructure": [r"on-?chain infrastructure", r"sequencer", r"on-?chain"],
 "crypto-market-structure":[r"market structure"],
 "defi":                   [r"\bDeFi\b", r"decentrali[sz]ed finance"],
 "accounting":             [r"\bASC ?350\b", r"\bGAAP\b", r"accounting"],
 "valuation":              [r"\bDCF\b", r"discounted cash flow", r"valuation"],
 "unit-economics":         [r"unit economics", r"take rate", r"gross margin"],
 "market-structure":       [r"market structure", r"order book"],
 "derivatives":            [r"derivatives?", r"\boptions?\b", r"futures"],
 "systematic-trading":     [r"momentum strateg(?:y|ies)", r"backtest(?:ing|ed|s)?", r"systematic"],
 "equity-research":        [r"equity research", r"consensus", r"sell-side"],
 "financial-modelling":    [r"financial model(?:ling|ing)?", r"the model"],
 "machine-learning":       [r"machine learning", r"random forest", r"gradient boost\w*"],
 "bayesian-inference":     [r"variational inference", r"bayesian", r"posterior"],
 "statistics":             [r"hypothesis test\w*", r"statistical\w*", r"distribution"],
 "data-engineering":       [r"\bKDB\+?(?:/q)?\b", r"PySpark", r"time[- ]series database"],
 "tools":                  [r"utilit(?:y|ies)", r"\bapps?\b", r"menu ?bar"],
 "workflow":               [r"workflow", r"keyboard shortcuts?", r"my setup"],
 "teaching":               [r"teach(?:ing|es)?", r"explain(?:ing|s)?", r"session", r"students?"],
 "odd-measurements":       [r"volume of", r"lap time", r"telemetry"],
 "mathematical-modelling": [r"mathematical model\w*", r"geometric"],
 "books":                  [r"\bbook\b"],
}

# which themes to look for in which file
ASSIGN = {
 "asc350-gaap-loss":["accounting","equity-research"],
 "base-chain":["unit-economics","onchain-infrastructure"],
 "coinbase-one":["unit-economics","equity-research"],
 "deribit":["derivatives","unit-economics","market-structure"],
 "developer-platform":["unit-economics","onchain-infrastructure"],
 "eth-staking":["staking","unit-economics"],
 "model-walkthrough":["financial-modelling","valuation","equity-research"],
 "usdc-stablecoin":["stablecoins","unit-economics"],
 "COIN-Research-202603":["equity-research","unit-economics","accounting"],
 "ai-model-demo":["machine-learning"],
 "cryptos-transparency-paradox":["crypto-market-structure","onchain-infrastructure"],
 "dcf-for-crypto":["valuation","financial-modelling"],
 "lego-fication-of-finance":["composability","tokenization","market-structure","defi"],
 "macos-apps":["tools","workflow"],
 "stems-2024-talk":["derivatives","teaching"],
 "svi-with-pyro":["bayesian-inference","statistics"],
 "bagged-ensemble-accuracy":["machine-learning","statistics"],
 "greek-vase-volume-analysis":["odd-measurements","mathematical-modelling"],
 "momentum-crude-oil-trading":["systematic-trading","market-structure"],
 "silver-bitcoin-trading":["systematic-trading","crypto-market-structure"],
 "f1-lap-time-prediction":["machine-learning","odd-measurements","data-engineering"],
 "finlatics-baep":["tools"],
 "hfea-data":["odd-measurements","statistics"],
 "pyspark-vs-kdb":["data-engineering","tools"],
}

def mask(s):
    """Return a same-length string with protected regions blanked to \\x00."""
    m = list(s)
    def blank(rx, flags=0):
        for mm in re.finditer(rx, s, flags):
            for i in range(mm.start(), mm.end()): m[i] = "\x00"
    blank(r"\A---\n.*?\n---", re.S)          # frontmatter
    blank(r"^\s*(?:import|export)\s+.*$", re.M)
    blank(r"```.*?```", re.S)                 # fenced code
    blank(r"`[^`\n]*`")                       # inline code
    blank(r"^\s{0,3}#{1,6}\s.*$", re.M)       # headings -> TOC
    blank(r"!\[[^\]]*\]\([^)]*\)")            # images
    blank(r"\[[^\]]*\]\([^)]*\)")             # links
    blank(r"<[^>\n]+>")                       # html / jsx
    blank(r"\$\$.*?\$\$", re.S); blank(r"\$[^$\n]*\$")
    blank(r"^\s*[|>].*$", re.M)               # tables, blockquotes
    return "".join(m)

def tag_file(path):
    stem = os.path.basename(path).rsplit(".",1)[0]
    themes = ASSIGN.get(stem)
    if not themes: return None
    s = open(path, encoding="utf-8").read()
    if "<T k=" in s: return (stem, 0, "already tagged")
    edits = []                                  # (start, end, slug)
    taken = []
    msk = mask(s)
    for slug in themes:
        n = 0
        for form in FORMS.get(slug, []):
            if n >= MAX_PER_THEME: break
            for mm in re.finditer(rf"(?<![\w-]){form}(?![\w-])", msk, re.I):
                if n >= MAX_PER_THEME: break
                a, b = mm.span()
                if any(a < y and x < b for x, y in taken): continue
                edits.append((a, b, slug)); taken.append((a, b)); n += 1
    if not edits: return (stem, 0, "no match")
    for a, b, slug in sorted(edits, reverse=True):
        s = s[:a] + f'<T k="{slug}">' + s[a:b] + "</T>" + s[b:]
    open(path, "w", encoding="utf-8").write(s)
    return (stem, len(edits), "ok")

tot = 0
for f in sorted(glob.glob(f"{ROOT}/**/*.md*", recursive=True)):
    r = tag_file(f)
    if r:
        print(f"  {r[0][:40]:42} {r[1]:>3} tags  {r[2]}")
        tot += r[1]
print(f"\ntotal inline theme markers: {tot}")
