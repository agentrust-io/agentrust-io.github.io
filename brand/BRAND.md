# AgenTrust brand and icon guide

The canonical definition of the AgenTrust wordmark, palette, and icon system.
Anything that carries the AgenTrust name follows this file.

## Name

The wordmark is **AgenTrust**: one shared `t`, capital `A`, capital `T`.
It is a deliberate portmanteau of "agent" and "trust", not a typo.

Do not write it as "AgentTrust", "Agentrust", or "agenTrust".
The GitHub organisation, package namespaces, and domains use `agentrust-io`,
which is the handle rather than the wordmark. Prose uses AgenTrust.

## Palette

There are two layers, and they answer different questions. **Surface colours**
say what the page is made of. **Mark and accent colours** say what carries the
AgenTrust name. A mark never uses a surface colour and a surface never uses a
mark colour, so the two lists cannot drift into each other again.

The single source of truth is `design-system.css`, which every property loads
from `agentrust-io.com`, including the four MkDocs subdomains. Change a value
there and the whole family moves together. Do not redeclare these in a page.

### Surfaces

The site reads as printed matter: warm parchment, near-black ink, hairline
rules. This is what ships on the hub, quickstart, demos, telemetry, the
extension pages, and the docs sites.

| Token | Hex | Use |
|---|---|---|
| `--at-paper` | `#F3F0E8` | Page background. |
| `--at-paper-2` | `#E9E4D8` | Table headers, hover fills, secondary bands. |
| `--at-white` | `#FFFEFA` | Cards, callouts, raised surfaces. |
| `--at-ink` | `#171714` | Body copy, headings, footer background, code background. |
| `--at-muted` | `#66645D` | Secondary copy, captions, inactive nav. |
| `--at-line` | `rgba(23,23,20,.18)` | Rules, card borders, dividers. |

The dark variant is defined once, under `[data-md-color-scheme="slate"]`, and
inverts these same six tokens. Nothing else needs a dark rule.

### Marks and accents

| Token | Hex | Use |
|---|---|---|
| `--at-navy` | `#15294B` | Mark background, shield stroke, structural emphasis. |
| `--blue` | `#1B5EA0` | Gradient partner to navy, links, secondary accents. |
| `--at-red` | `#B91C1C` | Accent only. The bar in the mark, the single point of emphasis in a product glyph, section labels, active nav. |

`--at-red` and the red in the mark files are the same hex on purpose. One red
across the icons and the site, never two that are close enough to look like a
mistake.

### Semantic

`--green #1B7A4A`, `--amber #C17817`, `--orange #EA580C`, `--purple #6D28D9`.
Status and diagram meaning only: badges, product-card category accents, pass
and fail states. They are never brand colours and never appear in a mark.

**Do not use the MkDocs Material default purple.** The theme ships
`#7c3aed`, `#0ea5e9`, `#5BD2BE`, `#8251EE`, and `#C661F7`. Four product icons
were previously drawn in those colours, which is how the family drifted into
two unrelated palettes that matched neither each other nor the site. If a hex
is not on this page, it does not belong in a mark.

### Two exceptions

`design-system.css` contains hexes that are not on this page, and both kinds
are deliberate.

**Derived tones.** The dark scheme and the code surfaces are derived from the
six surface tokens: inverted paper and ink, plus the muted greens, sands, and
reds that stay legible on a near-black code block. They are shades of the
palette, not additions to it, and they live in one file. Do not hand-pick a new
one in a page.

**Third-party logos.** An adopter or partner card renders that organisation's
own mark in that organisation's own colour. Those are their brand values, not
ours, and they appear nowhere else. Never sample one into AgenTrust surfaces.

### The older token names

The hub still carries an inline stylesheet written against an earlier set of
names: `--bg`, `--surface`, `--border`, `--body`, `--muted`, `--navy`, `--red`.
`design-system.css` remaps those onto the tokens above in one block rather than
rewriting five hundred lines of page CSS, so they resolve to the values here.
Treat them as legacy aliases. New work uses the `--at-*` names.

## The mark system

One shield silhouette is the family container. The organisation mark carries
the `A`; each product replaces the `A` with a glyph for what that project does.
Only the glyph changes. The shield, the palette, and the red accent stay fixed.

| Mark | Glyph | Meaning |
|---|---|---|
| AgenTrust (org) | `A` with red bar | The parent. Used for the org itself, never for a single project. |
| cMCP | Padlock, red keyhole | Policy enforced where the governed process cannot reach it. |
| cA2A | Two nodes, arc, red arrowhead | A delegation hop. Authority narrows in the direction of travel. |
| Agent Manifest | Three bound nodes, red apex | Separate artifacts bound into one record. |
| TRACE | Eye, red pupil | Evidence that can be inspected by a third party. |
| TRACE Tests | Seal, red check | The suite either passes an implementation or it does not. |
| Awesome AI Governance | Curated list, red mark | Entries reviewed and kept, not everything that exists. |

Each product glyph gets exactly one red element. Red marks the point that
matters in the glyph, so the family reads as one system at a glance and the
products still separate at 32px.

### Files

| File | Purpose |
|---|---|
| `brand/agentrust-mark.svg` | Org mark, light background. Docs, slides, light surfaces. |
| `brand/agentrust-mark-solid.svg` | Org mark, solid navy. Favicons, avatars, vendor listings, dark surfaces. |
| `brand/agentrust-avatar-500.png` | 500px raster for GitHub organisation avatar and profile uploads. |
| `apple-touch-icon.png`, `favicon-32x32.png`, `favicon-16x16.png`, `favicon.ico` | Site icons, generated from the solid mark. |
| `<repo>/docs/assets/icon.svg` | Per-product mark. One per project repository. |

Every property that renders a logo needs one. `tests.agentrust-io.com` and
`governance.agentrust-io.com` shipped with no mark at all and fell back to the
Material default, and trace-tests' README pointed at an `icon.svg` that did not
exist, so its logo was a broken image on GitHub and on the site.

Each project repository holds its own mark at `docs/assets/icon.svg` and points
`mkdocs.yml` `theme.logo` and `theme.favicon` at it. Replacing that one file
updates the docs header, the docs favicon, and the README together.

## Rules

1. **The org mark is not a product mark.** Do not use a product glyph as the
   organisation avatar. The GitHub avatar previously used the Agent Manifest
   glyph, which made one project look like the whole organisation.
2. **Two projects never share a mark.** cMCP and cA2A once shipped
   byte-identical `icon.svg` files. Before adding a project icon, confirm the
   hash differs from every existing one.
3. **The red bar is only on the org mark.** Products use red inside the glyph,
   not as a bar.
4. **Do not recolour a mark per surface.** Use the solid variant on dark, the
   light variant on light. Do not invent a third.
5. **Do not stretch, rotate, crop, or add effects.** The shield keeps its
   aspect ratio.
6. **Minimum size is 32px.** Below that use the solid variant, which holds the
   `A` better than the light one.

## Regenerating the raster assets

The PNG and ICO files are generated from `agentrust-mark-solid.svg` using the
same coordinates as the SVG, so the vector and raster forms cannot drift.
Sizes: 180 (apple-touch), 32, 16, 500 (avatar), and a 16/32/48 multi-size
`favicon.ico`.

If you change the mark, regenerate all of them together and update every
project icon in the same pass.
