# QTEnvDev design system

This is the visual source of truth for the QTEnvDev renderer. Redesign work must preserve routes, IPC contracts, service lifecycle ownership, and existing module business logic. Visual changes happen in place and production files are not deleted as part of the redesign.

## Scope

- 71 built-in module routes discovered from src/render/components/*/Module.ts
- System routes: /setup and /customer-module
- Shared shell: title bar, sidebar, main content surface, dialogs and notices
- Plugin routes consume the same system when they are loaded dynamically

## Genre

Modern-minimal technical workbench. The interface should feel calm, precise and operational. Layouts vary by task: service workbench, dense version list, split-pane editor, log surface, focused utility, settings workbench, or AI workspace. Do not force every module into the same card grid.

## Macrostructure families

- App pages: Workbench, List, Split pane, Log surface, or Focused utility.
- Settings pages: Settings navigation + detail pane.
- Service pages: Status rail + primary task surface + contextual actions.
- Content/log pages: Content-first surface with restrained chrome.

## Theme

The existing light/dark behaviour remains supported. New work uses semantic tokens from src/render/style/tokens.css; module styles must not introduce raw brand colours when a token exists.

- Canvas: cool blue-grey light canvas / deep blue charcoal dark canvas
- Surface: white-blue light surface / elevated charcoal dark surface
- Ink: navy ink with muted blue-grey secondary text
- Accent: restrained blue, reserved for navigation, primary actions and focus
- Success: green, reserved for running/success states
- Warning and danger: state communication only

## Typography

- Display/UI: semantic --font-display token; use a characterful sans when the font can be bundled safely.
- Body: semantic --font-body token with readable line height.
- Code/log: semantic --font-mono token.
- Headings are roman, sentence case and balanced; no italic display headings.
- Version numbers and metrics use tabular figures.

## Spacing, shape and surfaces

- Use the 4-point semantic spacing scale in tokens.css.
- Use small radii for controls, medium radii for panels, and large radii only for dialogs or intentional feature surfaces.
- Prefer surface contrast, dividers and whitespace over repeated border + shadow cards.
- Main content should breathe; dense tables remain dense only where scanning data is the task.

## Motion and interaction

- Animate transform and opacity where motion is needed; avoid transition: all.
- Use the named easing and duration tokens.
- Every interactive primitive covers default, hover, focus-visible, active, disabled, loading, error and success states where applicable.
- Focus rings are always visible to keyboard users and are never animated.
- Reduced motion collapses spatial motion to a short opacity transition.
- Prefer silent success and inline recovery over celebratory toast noise.

## Responsive contract

All shared surfaces and module pages are checked at 320, 375, 414, 768, 960, 1280 and 1440 CSS pixels. There must be no accidental horizontal scrolling. Clickable text must remain readable without awkward wrapping. Long labels and localized strings must be allowed to wrap inside a constrained, min-width-zero layout.

## Ownership boundaries

This redesign does not move domain state into visual components, create Pinia stores for presentation, or duplicate service lifecycle operations. Existing long-running renderer operations remain owned by their module controllers; page components bind state and issue commands. Fork processes remain the source of truth for process liveness. No new long-running operation is introduced by the visual refactor.

## Migration order

1. Inventory and baseline
2. Tokens and shared shell
3. Shared visual primitives
4. Pilot: Startup Group, PHP, MySQL, Host, Podman, AI/Chat, Tools, Setup
5. Service, database, language, governance, search/network, AI, and utility batches
6. Customer module and final system-screen pass
7. Responsive, accessibility, dark-mode and regression verification

Every batch must preserve route behaviour and pass the visual/state checklist before the next batch starts.

## Exports

`src/render/style/tokens.css` is the source token file. The renderer currently uses Tailwind 3 utilities, so the Tailwind v4 block below is a portability mapping rather than an active build dependency.

### Tailwind v4 `@theme`

```css
@theme {
  --color-canvas: oklch(97% 0.02 245);
  --color-surface: oklch(100% 0.012 245);
  --color-ink: oklch(25% 0.055 250);
  --color-accent: oklch(55% 0.19 255);
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'Geist', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --spacing-md: 1.5rem;
  --radius-md: 0.625rem;
}
```

### DTCG `tokens.json`

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "canvas": { "$value": "oklch(97% 0.02 245)", "$type": "color" },
    "surface": { "$value": "oklch(100% 0.012 245)", "$type": "color" },
    "ink": { "$value": "oklch(25% 0.055 250)", "$type": "color" },
    "accent": { "$value": "oklch(55% 0.19 255)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "Space Grotesk, sans-serif", "$type": "fontFamily" },
    "body": { "$value": "Geist, sans-serif", "$type": "fontFamily" },
    "mono": { "$value": "JetBrains Mono, monospace", "$type": "fontFamily" }
  },
  "space": { "md": { "$value": "1.5rem", "$type": "dimension" } }
}
```

### shadcn/ui variables

```css
:root {
  --background: 97% 0.02 245;
  --foreground: 25% 0.055 250;
  --primary: 55% 0.19 255;
  --primary-foreground: 100% 0 0;
  --border: 90% 0.025 240;
  --ring: 55% 0.19 255;
  --radius: 0.625rem;
}
```
