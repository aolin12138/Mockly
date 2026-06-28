---
name: Mockly
description: AI-powered interview practice platform — dark-first dual-theme design system
version: "1.0.0"
colors:
  page-dark: "#020617"
  page-light: "#FFFFFF"
  surface-dark: "#0F172A"
  surface-light: "#F8FAFC"
  card-dark: "rgba(15, 23, 42, 0.4)"
  card-light: "#FFFFFF"
  text-primary-dark: "#F1F5F9"
  text-primary-light: "#0F172A"
  text-secondary-dark: "#CBD5E1"
  text-secondary-light: "#475569"
  text-muted-dark: "#94A3B8"
  text-muted-light: "#64748B"
  accent: "#10B981"
  accent-hover: "#059669"
  cta-from: "#2563EB"
  cta-to: "#059669"
  danger: "#EF4444"
  warning: "#F59E0B"
  border-dark: "rgba(255, 255, 255, 0.1)"
  border-light: "#E2E8F0"
typography:
  h1:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  h2:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.05em"
    textTransform: "uppercase"
  mono:
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
    fontSize: "0.8125rem"
rounded:
  sm: 6px
  md: 12px
  lg: 16px
  xl: 20px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  "2xl": 48px
  "3xl": 64px
components:
  button-primary:
    backgroundColor: "{cta-from}"
    textColor: "#FFFFFF"
    rounded: "{rounded.full}"
    padding: "12px 28px"
  button-primary-hover:
    backgroundColor: "{cta-to}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{text-primary-dark}"
    borderColor: "{border-dark}"
    rounded: "{rounded.full}"
    padding: "12px 28px"
  card:
    backgroundColor: "{card-dark}"
    borderColor: "{border-dark}"
    rounded: "{rounded.xl}"
    padding: "24px"
  input:
    backgroundColor: "{surface-dark}"
    textColor: "{text-primary-dark}"
    borderColor: "{border-dark}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
---

## Overview

Mockly is an AI-powered mock interview platform for behavioural and technical interview practice. The interface should feel **professional, focused, and confidence-inspiring** — like a premium tool that serious candidates rely on. Dark-first by default, with a clean light mode alternative.

**Audience:** Job-seeking professionals preparing for FAANG-tier interviews. They want focus, not decoration.

**Vibe:** Linear-clean meets interview-prep utility. Restrained, high-contrast, emerald accent for "growth/progress" association. No playful animations, no decorative flourishes. The product sells itself on utility.

## Colors

The palette is built on the **Slate** family (Tailwind CSS) for a cool, professional neutral that doesn't lean warm (beige) or cold (pure gray). A single **Emerald** accent signals growth, correctness, and forward progress — thematically aligned with interview preparation.

- **Page backgrounds:** Dark mode uses near-black slate (`#020617` for depth, `#0F172A` for surfaces). Light mode uses pure white and slate-50.
- **Text:** High-contrast hierarchy (slate-100 → slate-400 in dark; slate-900 → slate-500 in light).
- **Accent (`#10B981`):** Used for success states, active indicators, progress bars, and the primary brand signifier. Never used as decoration.
- **CTA gradient:** Blue-600 → Emerald-600 (`#2563EB` → `#059669`). This is the only gradient in the system. Used exclusively on primary call-to-action buttons.
- **Semantic colors:** Red (`#EF4444`) for errors/destruction, Amber (`#F59E0B`) for warnings.

### Dark Mode (default)
| Token | Value | Tailwind |
|---|---|---|
| Page background | `#020617` | `bg-slate-950` |
| Surface / cards | `#0F172A` | `bg-slate-900` |
| Elevated cards | `rgba(15,23,42,0.4)` | `bg-slate-900/40` |
| Primary text | `#F1F5F9` | `text-slate-100` |
| Secondary text | `#CBD5E1` | `text-slate-300` |
| Muted text | `#94A3B8` | `text-slate-400` |
| Borders | `rgba(255,255,255,0.1)` | `border-white/10` |

### Light Mode
| Token | Value | Tailwind |
|---|---|---|
| Page background | `#FFFFFF` | `bg-white` |
| Surface / cards | `#F8FAFC` | `bg-slate-50` |
| Elevated cards | `#FFFFFF` | `bg-white` |
| Primary text | `#0F172A` | `text-slate-900` |
| Secondary text | `#475569` | `text-slate-600` |
| Muted text | `#64748B` | `text-slate-500` |
| Borders | `#E2E8F0` | `border-slate-200` |

## Typography

The entire interface uses the **system font stack** — no web font downloads. This keeps the app fast and feels native on every platform. The stack prioritizes Apple's San Francisco, then Segoe UI (Windows), then fallback sans-serif.

- **`system-ui`** for all UI text — headings, body, labels, buttons
- **Monospace** (`JetBrains Mono`, `Fira Code`) reserved for code (technical interview code editor, code review panels)

**Type scale:**
- `h1`: 2.5rem / 700 / -0.02em tracking / 1.1 leading — used for page titles once per page
- `h2`: 1.5rem / 600 / 1.3 leading — section headings within pages
- `body`: 0.875rem / 400 / 1.6 leading — default body text
- `label`: 0.75rem / 500 / 0.05em tracking / uppercase — badges, status labels
- `mono`: 0.8125rem — code, technical data

**Rules:**
- Headings are sentence case, never all-caps
- Numbers use tabular-nums (`font-variant-numeric: tabular-nums`) in dashboards and score displays
- Code in technical interview uses monospace exclusively
- No serif fonts anywhere — this is a utility tool, not editorial

## Layout

- **Page width:** Max `1280px` (`max-w-7xl`), centered with `mx-auto`
- **Page padding:** `px-4` mobile, `px-6` tablet, `px-8` desktop
- **Section spacing:** `py-20` to `py-24` between major sections
- **Card padding:** `p-6` default, `p-8` for hero/feature cards
- **Grid:** CSS Grid for multi-column layouts. Never flexbox percentage math (`w-[calc(33%-1rem)]`).

## Elevation & Depth

Mockly is a flat-design application. Depth is communicated through:
- **Borders** (`border`, `border-white/10` or `border-slate-200`) — primary separator between cards and the page
- **Background contrast** — cards are slightly lighter/darker than the page background, not elevated with shadows
- **Shadows reserved for overlays only** — modals, dropdowns, tooltips. Never on cards or sections.

## Shapes

**Corner radius system (consistent across the entire app):**
- `6px` — inputs, small buttons, tags, badges
- `12px` — cards, panels, modals
- `16px` — large feature cards, hero containers
- `20px` — page-level containers, setup wizard cards
- `9999px` / full — primary CTA buttons, status pills

**Rule:** Every interactive element and container uses one of these radii. No mixing. No sharp (0px) corners mixed with rounded — the system is consistently soft.

## Components

### Primary CTA Button
- Full-rounded (`rounded-full`)
- Blue-to-Emerald gradient background
- White text, medium weight
- `scale-[0.98]` on `:active` for tactile feedback
- `shadow-lg shadow-blue-500/20` for depth

### Secondary Button
- Full-rounded (`rounded-full`)
- Transparent background with border
- Border: `border-slate-200` (light) / `border-white/10` (dark)
- Text inherits from theme

### Card
- `rounded-xl` (12px)
- Background one step above page: `bg-slate-50` (light) / `bg-slate-900/40` (dark)
- `border border-slate-200` (light) / `border-white/10` (dark)
- Padding: `p-6`

### Input Field
- `rounded-xl` (12px)
- Background: `bg-white` (light) / `bg-slate-800/50` (dark)
- Border: `border-slate-200` (light) / `border-white/10` (dark)
- Label above input (never placeholder-as-label)
- Error text below input in red

## Dark Mode Protocol

- **Default:** Dark mode (`class="dark"` on `<html>`)
- **Toggle:** Sun/moon icon in Header and Dashboard sidebar
- **Strategy:** Tailwind `dark:` variant for every color class
- **Font scaling:** Same sizes both modes — contrast ensures readability
- **Icons:** Same colors both modes — Lucide icons use `currentColor`
- **Code editor:** Monaco switches `vs-dark` ↔ `light` with theme

## Do's and Don'ts

### Do
- Use the Slate palette exclusively — never introduce new gray families
- Use Emerald as the sole accent — never add blue, purple, or orange accents
- Keep interfaces dense but scannable — this is a tool, not a marketing page
- Use semantic color for state: green = success/pass, red = error/fail, amber = warning
- Keep buttons to 1-3 words max
- Use real data in mock states where possible

### Don't
- Don't introduce gradients outside the primary CTA button
- Don't use shadows on cards or sections — flat design with borders only
- Don't use serif fonts anywhere
- Don't add decorative animations — motion serves purpose (loading, transitions, feedback)
- Don't use em-dashes (—) — use hyphens or commas
- Don't use glassmorphism, glow effects, or particle backgrounds
- Don't use placeholder-as-label in forms
- Don't add "AI-generated" tells: no purple, no Inter font, no three-equal-cards
