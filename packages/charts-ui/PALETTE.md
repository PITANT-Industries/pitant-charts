# Warpdrive chart palette

The new palette keeps the original Warpdrive card surfaces and indigo first series. The first four categories use indigo, amber, teal and rose with a larger spread in hue and lightness. The second line uses a dash pattern so readers can also distinguish it by shape. Positive and negative retain their own semantic tokens.

| Series | Day | Night |
| --- | --- | --- |
| Indigo | `#4338ca` | `#a5b4fc` |
| Amber | `#d15d16` | `#eab265` |
| Teal | `#178d89` | `#b7f8e3` |
| Rose | `#751f2b` | `#e4506b` |
| Slate | `#3c405e` | `#9f9eb1` |
| Blue | `#416fac` | `#368fef` |
| Olive | `#4e5d25` | `#cbde59` |
| Plum | `#8f4378` | `#b26bb8` |

Run `bun run palette:check` to compare the original and proposed sets. Minimum series-to-card contrast across eight swatches improves from 3.00:1 to 3.97:1 on Day and from 3.68:1 to 4.80:1 on Night. The closest pair among the first four moves farther apart in all three full-severity color vision simulations in both modes. In the Night palette with standard vision, the closest pair of the first four comes slightly closer, from 0.197 to 0.194 in Oklab distance.

The script checks solid swatches against the actual Warpdrive card surfaces. It reports the closest pair using Euclidean Oklab distance with the full-severity Machado matrices for protanopia, deuteranopia and tritanopia. Distance is a relative comparison with no pass threshold. It does not measure tiny marks, custom colors, adjacent segment boundaries, or the full UI. For dense charts, use direct labels or other encodings in addition to color.

Sources: [Carbon categorical palette guidance](https://www.carbondesignsystem.com/building-blocks/data-visualization/color-palettes), [Paul Tol's qualitative palettes](https://sronpersonalpages.nl/~pault/), [Machado, Oliveira and Fernandes](https://pubmed.ncbi.nlm.nih.gov/19834201/), [Oklab](https://bottosson.github.io/posts/oklab/), [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), and [W3C use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).
