/**
 * What each piece is *about*, as area weights. Used to blend theme colours and
 * positions on the word map.
 *
 * These are weights rather than binary tags on purpose: with the COIN series
 * flatly marked both Finance and Digital Assets, 27% of themes came out an
 * identical 50/50 blend and every word on the map was the same colour.
 * Weighting by what each piece actually argues drops that to ~2%.
 */
import type { AreaId } from "@/data/themes";

export const PIECE_AREAS: Record<string, Partial<Record<AreaId, number>>> = {
  "asc350-gaap-loss":            { fin: .75, da: .25 },
  "model-walkthrough":           { fin: .80, da: .20 },
  "coin-research-202603":        { fin: .70, da: .30 },
  "coinbase-one":                { fin: .75, da: .25 },
  "deribit":                     { fin: .60, da: .40 },
  "dcf-for-crypto":              { fin: .60, da: .40 },
  "silver-bitcoin-trading":      { fin: .60, da: .40 },
  "developer-platform":          { fin: .40, da: .60 },
  "lego-fication-of-finance":    { fin: .40, da: .60 },
  "base-chain":                  { fin: .35, da: .65 },
  "eth-staking":                 { fin: .35, da: .65 },
  "usdc-stablecoin":             { fin: .30, da: .70 },
  "cryptos-transparency-paradox":{ da: 1 },
  "momentum-crude-oil-trading":  { fin: 1 },
  "stems-2024-talk":             { fin: .85, side: .15 },
  "svi-with-pyro":               { tech: 1 },
  "bagged-ensemble-accuracy":    { tech: 1 },
  "ai-model-demo":               { tech: 1 },
  "f1-lap-time-prediction":      { tech: .60, side: .40 },
  "pyspark-vs-kdb":              { tech: .50, side: .50 },
  "greek-vase-volume-analysis":  { side: 1 },
  "hfea-data":                   { side: 1 },
  "macos-apps":                  { side: 1 },
  "finlatics-baep":              { side: 1 },
};

/** Falls back to an even split so an untracked piece never breaks the build. */
export const areasFor = (slug: string): Partial<Record<AreaId, number>> =>
  PIECE_AREAS[slug.toLowerCase()] ?? { fin: .25, da: .25, tech: .25, side: .25 };
