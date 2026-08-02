---
name: components
description: Compose reusable Motionly semantic UI components, generated parts, variants, motion presets, content props, and cause-and-effect relationships. Use before hand-drawing cards, dashboards, windows, controls, or device mockups.
---

# Components

Read [authoring-contract.md](../../references/authoring-contract.md) for the
component contract. Discover live schemas with `npx @coppsary/motionly catalog
--type component` and inspect `src/semantic/vector-registry.ts` only when needed.

## Vocabulary

Base types: `cloud`, `database`, `server`, `arrow`, `button`, `dashboard`,
`phone`, `browser`, `logo`, `chart`, `notification`, `cursor`, `codeeditor`,
`website`, `terminal`, `pricingcard`, `laptop`, `editor`, `card`, `form`,
`chat`, `modal`, `navigation`, `loader`.

Specialized published types: `mac-window`, `sidebar`, `navbar`, `feature-card`,
`analytics-chart`, `table`, `notification-toast`, `command-palette`,
`search-bar`, `phone-mockup`, `laptop-mockup`, `avatar`, `badge`, `tag`,
`progress-bar`, `timeline`, `stepper`, `cta-button`, `glass-card`,
`floating-card`, `hero-section`, `footer`, `logo-grid`, `testimonials`,
`faq-accordion`, `tilted-card`, `magic-bento`, `fluid-glass`, `spotlight-card`,
`metric-card`, and `media-card`.

Compatibility aliases include the published ReactBits-style names in the live
catalog. They resolve to the nearest editable Motionly recipe; do not assume an
alias has a unique implementation.

## Authoring

```motion
component kpi {
  type metric-card
  eyebrow "Activation"
  label "Weekly active users"
  countTo 8420
  variant featured
  motionPreset premium
}
```

Supported common properties include `type`, `provider`, `source`, `label`,
`detail`, `headline`, `url`, `cta`, `values`, `labels`, `countTo`, `variant`,
`motionPreset`, `accent`, `surface`, `fill`, `stroke`, `strokeWidth`, `glow`,
`glowColor`, `scene`, `identity`, `beat`, `parent`, `layer`, `delay`,
`duration`, `start`, `opacity`, `scale`, `rotation`, `clickAt`, `clicks`,
`reactsTo`, `connects`, `exitAt`, and `exitDuration`.

All components expose `minimal`, `smooth`, `spring`, and `premium` motion presets.
Variants and content fields are type-specific; query the catalog rather than
guessing property names. The component compiler rejects unknown fields.

## Parts And Relationships

Components lower into editable parts named `NAME__PART`. Inspect the compiled
scene/registry example before animating a part. Use dotted overrides only for a
known part; never invent ids. Use `clicks TARGET`, `clickAt TIME`, `reactsTo
TARGET`, and `connects TARGET` to express visible cause/effect, not decoration.

Prefer a real imported product screenshot/video in a `showcase` for UI proof.
Components are for structured illustrative UI; they must not be used to redraw
an exact screenshot that already exists.
