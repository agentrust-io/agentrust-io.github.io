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

These are the only approved brand colours. They are the tokens already defined
in `index.html` and used across the site, the demos, and the extension pages.

| Token | Hex | Use |
|---|---|---|
| `--navy` | `#15294B` | Primary. Mark background, headings, shield stroke. |
| `--blue` | `#1B5EA0` | Gradient partner to navy, secondary accents. |
| `--red` | `#B91C1C` | Accent only. The bar in the mark, and the single point of emphasis in a product glyph. |
| `--body` | `#2E4057` | Body copy. |
| `--muted` | `#6B7F94` | Secondary copy, captions. |
| `--border` | `#D0D9E3` | Rules, card borders. |
| `--bg` | `#F2F4F7` | Page background, light-variant mark background. |
| `--surface` | `#FFFFFF` | Cards, light-variant mark highlight. |

Semantic colours (`--green #1B7A4A`, `--amber #C17817`, `--orange #EA580C`,
`--purple #6D28D9`) are for status and diagram meaning only. They are never
brand colours and never appear in a mark.

**Do not use the MkDocs Material default purple.** The theme ships
`#7c3aed`, `#0ea5e9`, `#5BD2BE`, `#8251EE`, and `#C661F7`. Four product icons
were previously drawn in those colours, which is how the family drifted into
two unrelated palettes that matched neither each other nor the site. If a hex
is not in the table above, it does not belong in a mark.

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
