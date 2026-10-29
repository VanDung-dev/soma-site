---
name: nested-corner-radii
description: Apply or review Human Atlas web UI corner radii for nested outer panels and inner surfaces. Use only in the human-atlas-rs repository when adjusting rounded panel/card geometry.
---

# Human Atlas nested corner radii

Use this skill only for the Human Atlas repository's web UI. The shared panel system uses three radius tiers; the module frame has a separate exception below:

- **Radius 1 (workspace/panel):** the 24px workspace and main panel surfaces.
- **Radius 2 (inner):** a bordered surface inset inside Radius 1.
- **Radius 3 (detail):** a bordered surface inset inside Radius 2.

## Geometry rule

For nested surfaces intended to follow the same smooth curve, measure the inset from the **parent surface's outer box edge** to the outside edge of the child border, then relate adjacent radii to that inset:

`parent radius = child radius + inset`

Equivalently, `child radius = max(0, parent radius - inset)`. Apply the rule recursively for each adjacent tier; do not compare non-adjacent tiers directly. The inset is the design spacing inside the parent surface; include any visible outline that sits on the parent edge, but do not count an inset stroke twice. If the spacing changes, update every paired radius together. Do not choose radii independently: when the radius difference is much smaller than the inset, the corner arcs drift apart and the band between them looks uneven.

## Human Atlas values

The project's 48px reference diameter sets the main geometry:

- Reference diameter: `--reference-diameter: 48px` (also the fixed `.app-menu-bar` height)
- Radius 1: `--panel-radius: 24px` (half the reference diameter)
- Radius 2: `--inner-radius: 14px`
- Radius 3: `--detail-radius: 4px`
- Nested inset between adjacent surfaces: `--panel-padding: 10px`

The nested panel surfaces retain 10px padding and the 24px → 14px → 4px radius sequence. The module frame is the only exception: `.module-content` has a fixed 24px radius, and `.module-page` supplies its 6px left, right, and bottom outer spacing at every viewport size. Keep this frame spacing independent of `--panel-padding: 10px`. `.model-space` fills `.module-content` at `inset: 0` and inherits its radius; Anatomy fills that workspace without another frame inset. Draw the panel's 1px outline with an inset shadow, not a CSS border, so the outline does not add to the layout inset. In the catalog panel, align `.catalog-heading`, `.structure-search-field`, `.tree-actions`, and `.catalog-tree` to the shared inset; the search field and tree use Radius 2, while separate action buttons keep their control radius. `.tree-row.folder-row` uses Radius 3 inset 10px inside `.catalog-tree`; because the tree has a 1px border, set its CSS padding to 9px. Within Radius 2 information content, use Radius 3 for bordered details such as `.wikipedia-article`, `.model-credit-description`, and `.reference-mapping-description`. Keep the shared values in `apps/web/src/style.css`; do not duplicate the paired radii as unrelated literals.

`.explode-control` is a standalone panel surface and uses Radius 1.

## Compact toolbar controls

The top toolbar uses the shared reference diameter and Radius 1 for its frame:

- `.app-menu-bar`: fixed `48px` height and `24px` radius, with a `1px` border. Its controls are inset 10px from the outer edge; CSS uses `3px 9px` padding to account for the border.
- `.controls-info`: `28px` square icon button with Radius 2 (`14px`), a visible border, and a `14px` icon. Its 14px radius makes the button circular; retain icon-only content at all viewport sizes.

For these named components, Radius 2 overrides the general control-radius guidance above: buttons in `.tree-actions` and `.reader-actions`, plus `.model-status`, use Radius 2 with 10px padding. Other standalone icon buttons and selected part rows keep their control or row radius; `.model-status` uses Radius 2 instead of the pill radius.

The tier rule applies when a bordered child surface sits in a parent corner with a measured inset, such as `.catalog-panel` and `.catalog-tree`, then recursively to a detail surface inside Radius 2. Do not apply it to unrelated controls just because they are inside a panel; the transparent toolbar icon buttons are interaction targets, not nested surfaces.

## When adjusting the layout

1. Identify the parent and child surfaces and measure the inset from the parent's inside edge to the child's border; exclude the parent's border width.
2. Set the child radius and derive the parent radius from the inset, or preserve the parent and derive the child radius.
3. Check that left, right, and bottom insets match when the layout calls for an evenly framed inner surface.
4. Inspect the rendered corners at normal scale. CSS border widths and clipping can affect the visible curve; make a small correction only when the rendered edges show it.
5. Preserve existing component behavior and responsive breakpoints. Report viewport sizes that were not visually checked.
