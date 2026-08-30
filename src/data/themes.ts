/**
 * The controlled vocabulary for the word map.
 *
 * Pieces declare `themes: [...]` in their frontmatter using these slugs only.
 * Each theme belongs to one of four areas. A theme's colour and position on the
 * word map are NOT taken from its own area alone — they're blended from the
 * areas of every piece that carries it. So "composability" leans Digital Assets
 * but drifts toward Finance because the pieces using it are partly financial.
 *
 * Adding a theme: add it here, then tag the pieces. Anything in frontmatter
 * that isn't listed here fails the build, which is the point — no drift.
 */

export type AreaId = "fin" | "da" | "tech" | "craft";

export const AREAS: Record<AreaId, { label: string; rgb: [number, number, number] }> = {
  fin:   { label: "Finance",             rgb: [32, 142, 197] },
  da:    { label: "Digital Assets",      rgb: [69, 181, 237] },
  tech:  { label: "Technology",          rgb: [47, 111, 232] },
  craft: { label: "Side Quests",         rgb: [122, 100, 220] },
};

export const THEMES: Record<string, { area: AreaId; label: string }> = {
  // Finance
  "accounting":            { area: "fin",   label: "accounting" },
  "valuation":             { area: "fin",   label: "valuation" },
  "unit-economics":        { area: "fin",   label: "unit economics" },
  "market-structure":      { area: "fin",   label: "market structure" },
  "derivatives":           { area: "fin",   label: "derivatives" },
  "systematic-trading":    { area: "fin",   label: "systematic trading" },
  "equity-research":       { area: "fin",   label: "equity research" },
  "financial-modelling":   { area: "fin",   label: "financial modelling" },

  // Digital Assets
  "tokenization":          { area: "da",    label: "tokenization" },
  "stablecoins":           { area: "da",    label: "stablecoins" },
  "staking":               { area: "da",    label: "staking" },
  "onchain-infrastructure":{ area: "da",    label: "onchain infrastructure" },
  "crypto-market-structure":{ area: "da",   label: "crypto market structure" },
  "composability":         { area: "da",    label: "composability" },
  "defi":                  { area: "da",    label: "DeFi" },

  // Technology
  "machine-learning":      { area: "tech",  label: "machine learning" },
  "bayesian-inference":    { area: "tech",  label: "Bayesian inference" },
  "statistics":            { area: "tech",  label: "statistics" },
  "data-engineering":      { area: "tech",  label: "data engineering" },

  // Side Quests — everything that is not the day job. Deliberately broad: this
  // is where non-work writing lands, not an appendix to the work.
  "tools":                 { area: "craft", label: "tools" },
  "workflow":              { area: "craft", label: "workflow" },
  "books":                 { area: "craft", label: "books" },
  "teaching":              { area: "craft", label: "teaching" },
  "odd-measurements":      { area: "craft", label: "odd measurements" },
  "mathematical-modelling":{ area: "craft", label: "mathematical modelling" },
  "motorsport":            { area: "craft", label: "motorsport" },
  "design":                { area: "craft", label: "design" },
};

/**
 * Sentence case for UI chrome. Labels are stored lowercase because that is how
 * they read inside a sentence, but a dropdown, a chip or a list item is not a
 * sentence — it is a heading, and it should be capitalised like one. Labels that
 * already carry their own capitals (DeFi, AI) are left exactly as written.
 */
export const displayLabel = (label: string): string =>
  /[A-Z]/.test(label) ? label : label.charAt(0).toUpperCase() + label.slice(1);

export const THEME_SLUGS = Object.keys(THEMES);
export const isTheme = (s: string): s is keyof typeof THEMES => s in THEMES;
