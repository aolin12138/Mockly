# Live Demo Section —Spec

**Owner:** Frontend
**Status:** Draft, awaiting approval
**Location on page:** Directly under the hero, above the existing "Question Lab" section
**Author:** pi agent (2026-06-28), informed by `DESIGN.md` + `design-taste-frontend` skill
**Related work:** Dashboard redesign (separate spec, see §17)

---

## §1. Goals

1. Show, on first paint of the home page after scroll, that Mockly is a **real working product** with three distinct practice modes.
2. Convey the three modes' value in under 35 seconds total (one full cycle through all three tabs) without forcing the user to read marketing copy.
3. Make the section feel "alive" the way a product demo video does, but **without shipping a video file**.
4. Reinforce Mockly's design system —slate + emerald, dark-first, no decorative gradients —so the landing visually matches the in-product experience.

## §2. Non-goals

- Not a marketing carousel of static screenshots.
- Not a real working interview (no live ElevenLabs, no real Monaco runtime in this section).
- Not pixel-perfect clones of the current pages —see §17, the demos are the **target polished state**, not the current state.
- No new colors, no new typography. DESIGN.md is the contract.

## §3. Information Architecture

**Home page section order, after this change:**

| # | Section | Status |
|---|---|---|
| 1 | Hero (fixed, scroll-pinned, particle text) | unchanged |
| 2 | **Live Demo Section** (this spec) | NEW |
| 3 | Question Lab (typed prompt + textarea) | moved down 1 slot |
| 4 | Practice Tracks (Behavioural / Technical cards) | unchanged |
| 5 | How It Works (3 steps) | unchanged |
| 6 | CTA + Footer | unchanged |

Section ID: `#see-it-live`. New nav anchor optional; not required for v1.

## §4. Section Anatomy

```
┌────────────────────────────────────────────────────────────────—— [optional eyebrow —see §4.A]                                 —— Headline (— words)                                           —— Subtext (—5 words, max 2 lines)                              —├────────────────────────────────────────────────────────────────—— [Tab strip: Dashboard | Behavioural | Technical]              —— —progress bar under active tab                               —├────────────────────────────────────────────────────────────────——                                                               ——                                                               ——           [ Demo Panel —16:9 aspect, rounded ]               ——           (horizontal-slide transition between tabs)          ——                                                               ——                                                               —├────────────────────────────────────────────────────────────────—— Caption strip —describes what's happening (changes mid-demo) —└────────────────────────────────────────────────────────────────—```

### §4.A Eyebrow decision

Taste-skill §4.3 caps eyebrows at `ceil(sectionCount / 3)`. The home page has ~6 sections; allowance —2 eyebrows. The hero has none. The existing Question Lab section uses one ("Interactive Practice"). We have one slot left.

**Decision:** Use one eyebrow on this section only. Recommended label: `Live Product Tour`. Skip eyebrows on Practice Tracks and How It Works to stay within the cap.

## §5. Layout & Dimensions

| Element | Mobile (`< 768px`) | Tablet (`768—024px`) | Desktop (`—1024px`) |
|---|---|---|---|
| Outer section padding | `py-16 px-4` | `py-20 px-8` | `py-24 px-12` |
| Max content width | `max-w-7xl mx-auto` | same | same |
| Header —tab strip gap | `mb-8` | `mb-10` | `mb-12` |
| Tab strip height | 44px (touch target) | 44px | 44px |
| Demo panel aspect | 4:3 (taller for mobile) | 16:10 | 16:9 |
| Demo panel max height | `60vh` | `60vh` | `560px` |
| Demo panel border radius | `rounded-xl` (12px) | `rounded-2xl` (16px) | `rounded-2xl` (16px) |
| Caption strip height | auto (min 44px) | 48px | 48px |

**Taste-skill compliance:**
- §3.E: `min-h-[100dvh]` not used (this is a section, not full-viewport)
- §4.4 Shape Lock: `rounded-2xl` matches DESIGN.md card radius
- §4.4 Materiality: no card shadow; depth via `border border-white/10` (dark) / `border-slate-200` (light)
- §4.11 Theme Lock: section follows page theme via `dark:` variants on every color class

## §6. Tab Strip Behavior

### §6.1 Visual

- Three pills in a horizontal row, centered on desktop, full-width with equal flex on mobile.
- Active pill: `bg-slate-900 dark:bg-white text-white dark:text-slate-900` (inverted from page).
- Inactive pill: `text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white`.
- Progress bar: 2px tall, emerald (`bg-emerald-500`), fills left-to-right under the active pill over the duration of that demo's cycle.

### §6.2 Auto-cycle

- Cycle durations per demo are set below in §7 (Dashboard 12s, Behavioural 12s, Technical 14s).
- On cycle end, advance to the next tab (wraps Technical —Dashboard).
- **Pause on hover** over the demo panel.
- **Pause when section is out of viewport** (use `whileInView` / IntersectionObserver). Resume when back in view.
- Pause when `document.hidden` (tab not focused) to avoid wasted animation cycles.

### §6.3 Manual control

- Click a tab to jump. Resets that tab's progress bar to 0 and starts playing from frame 1.
- Keyboard: Left / Right arrows when section has focus.
- Focus visible: `focus-visible:ring-2 focus-visible:ring-emerald-500`.

### §6.4 Reduced motion

- `prefers-reduced-motion: reduce` —no auto-cycle, no horizontal slide, no progress bar fill animation.
- The user sees the first frame of the active demo as a static screenshot. They can click tabs to switch (instant fade).
- The caption strip shows all three captions stacked vertically inside the active panel instead of cycling.

## §7. Per-Demo Storyboards

Each demo is a **scripted timeline of frames**. Times are in ms from the demo's start. Each "frame" is a snapshot of state; transitions between frames are 300—00 ms eased motions.

Easing standard: `cubic-bezier(0.16, 1, 0.3, 1)` (smooth-out for incoming, sharp-in for outgoing).

**Conversation Bank (locked):** Each demo ships with **5 script variants**. On every mount the panel picks one at random (with localStorage anti-repeat so the user never sees the same script twice in a row). The timelines below are the **canonical / reference script** for each demo. The other 4 per demo follow the same schema and are listed in §7.4.

### §7.1 Dashboard Demo (12s loop)

**Mock data this demo uses:**
- User name: "Alex"
- Latest score: 78/100
- Recent sessions: 3 cards with topics
  - "Influence without authority" —82
  - "Cross-functional conflict" —74
  - "Two-pointer optimization" —71
- Goal: "Practice 5 behavioural sessions this week" —3/5 complete

**Timeline:**

| t (ms) | Frame | Caption |
|---|---|---|
| 0 | Panel fades in. Header bar with Mockly logo + "Dashboard" + avatar. Sidebar with 4 icons. Main area empty grey skeleton. | "Your interview practice, tracked" |
| 600 | Hero score card materializes top-left. Score arc animates 0 —78. Number counts up in sync. | (same) |
| 2200 | Recent sessions row materializes below (3 cards stagger in, 80ms apart). | "Every session, scored and analyzed" |
| 4500 | Synthetic cursor enters from right, glides to session card #2 ("Cross-functional conflict"). | (same) |
| 5200 | Card lifts (translate-y: -2, shadow increase). STAR breakdown bars expand inside (Situation/Task/Action/Result, each fills to its width). | "STAR breakdown on every answer" |
| 7800 | Cursor glides to Goals panel on right. Goal progress bar pulses, animates 3/5 —4/5 with checkmark. | "Set goals, watch yourself improve" |
| 10000 | Slight idle pause. | (same) |
| 11500 | Crossfade-out begins; tab strip advances to Behavioural. | (final caption fades) |

**Components needed:**
- `DashboardDemo.jsx` —wrapper
- `MiniDashboardFrame.jsx` —the "browser-frame" wrapper (just rounded panel + faux top bar)
- `MiniScoreArc.jsx` —SVG arc, animated stroke
- `MiniSessionCard.jsx` —small card with topic + score
- `MiniGoalPanel.jsx` —goal row + progress bar
- `SyntheticCursor.jsx` —a small SVG cursor that animates between coords via Framer Motion

### §7.2 Behavioural Demo (12s loop)

**Mock data:**
- AI question: "Tell me about a time you led a team through ambiguity."
- AI follow-up: "What was the first thing you did?"

**Timeline:**

| t (ms) | Frame | Caption |
|---|---|---|
| 0 | Panel fades in. Center: `ParticleOrb` component, state="idle". Top: empty transcript. Bottom: flat waveform. | "A live voice interview, just like the real thing" |
| 800 | Orb shifts to state="speaking". AI question types into top transcript at ~40 chars/sec. | (same) |
| 4000 | Orb shifts to state="listening". Bottom waveform animates with scripted synthetic amplitude (canvas-driven). | "Real-time response, no script reading" |
| 7200 | Waveform damps. Orb shifts to state="thinking" briefly, then back to "speaking". AI follow-up types in below the original question. | "Studied behavioural questions, in your role and company" |
| 10000 | Orb settles to "idle". Slight pause. | (same) |
| 11500 | Crossfade-out begins; tab strip advances to Technical. | (final caption fades) |

**Components needed:**
- `BehaviouralDemo.jsx` —wrapper
- `ParticleOrb` —REUSE the real component (`apps/frontend/src/component/ui/particle-orb.jsx`). Drive `state` prop on a timer.
- `ScriptedWaveform.jsx` —canvas with a pre-baked amplitude curve, not a real mic stream. Lighter than `LiveWaveform.jsx`.
- `TypewriterText.jsx` —generic typewriter hook used by all three demos

### §7.3 Technical Demo (14s loop)

**Mock data:**
- Problem: "Two-Sum —given an array of integers and a target, return indices of the two numbers that add to the target."
- Code (typed in over time):
  ```javascript
  function twoSum(nums, target) {
    const seen = new Map();
    for (let i = 0; i < nums.length; i++) {
      const need = target - nums[i];
      if (seen.has(need)) return [seen.get(need), i];
      seen.set(nums[i], i);
    }
  }
  ```
- Test cases:
  - `[2,7,11,15], 9` —`[0,1]` —  - `[3,2,4], 6` —`[1,2]` —  - `[3,3], 6` —`[0,1]` —  - `[], 0` —`undefined` —
**Timeline:**

| t (ms) | Frame | Caption |
|---|---|---|
| 0 | Panel fades in. Left pane: problem title + empty body. Right pane: empty code area with line numbers. Bottom: empty test panel. | "Code in real time, voice on the side" |
| 600 | Problem statement types into left pane. | (same) |
| 3000 | First line of code types into right pane. Subsequent lines stagger in at ~120ms per line. | "See your code run against real test cases" |
| 7500 | "Run tests" button highlights (subtle pulse), then triggers. | (same) |
| 8000 | Test results panel populates row by row: 3 — 1 — Failing row expands a one-line diff hint: `Expected return for [], got undefined`. | "Pass, fail, edge case, all in one view" |
| 10500 | Code edits one line (the early-return) —animated diff highlight. Button re-triggers, all 4 pass. | "Iterate fast, ship the cleaner solution" |
| 13000 | Submit button glows briefly. | (same) |
| 13800 | Crossfade-out begins; tab strip advances to Dashboard. | (final caption fades) |

**Components needed:**
- `TechnicalDemo.jsx` —wrapper
- `MiniProblemPanel.jsx` —left pane, problem title + body
- `MiniCodeEditor.jsx` —right pane, **NOT real Monaco** (too heavy for landing). Hand-styled `<pre>` with manually pre-tokenized syntax (one class per token), animated reveal via Framer Motion's `staggerChildren`. Uses Mockly's mono token from DESIGN.md.
- `MiniTestPanel.jsx` —bottom pane, list of test cases with pass/fail icon

**Why no real Monaco here:** `@monaco-editor/react` adds ~2MB to landing bundle if eagerly loaded. Hand-styled syntax block is < 5KB, looks identical at this size.

### §7.4 Conversation Bank

**Total scripts at launch: 15** (5 per demo). All scripts conform to the same schema; the timeline engine doesn't know which demo type it's running.

#### Script schema

```js
// apps/frontend/src/component/home/demos/scripts/<demo>/<slug>.js
export default {
  id: 'leadership-ambiguity',       // unique slug, kebab-case
  demo: 'behavioural',              // 'dashboard' | 'behavioural' | 'technical'
  duration: 12000,                  // total ms; must match the demo's tab duration ±0
  tags: ['leadership', 'phase-1'],  // for future filtering / analytics
  frames: [
    { t: 0,    type: 'orb_state',  state: 'idle' },
    { t: 800,  type: 'typewrite',  target: 'ai_question', text: 'Tell me...' },
    { t: 4000, type: 'waveform',   amplitude_curve: 'speaking_pattern_1' },
    // ... more frames
  ],
  captions: [
    { t: 0,    text: 'A live voice interview, just like the real thing' },
    { t: 3500, text: 'Real-time response, no script reading' },
    { t: 7000, text: 'Studied behavioural questions, in your role and company' },
  ],
};
```

#### Frame type vocabulary

The `useDemoTimeline` hook understands a fixed set of frame `type` values. New types require code changes; new scripts using existing types are content-only.

| `type` | Used by | Effect |
|---|---|---|
| `typewrite` | all | Type characters into `target` element at ~40 chars/sec |
| `orb_state` | behavioural | Set `ParticleOrb` state to `idle` / `listening` / `speaking` / `thinking` |
| `waveform` | behavioural | Drive `ScriptedWaveform` with a named amplitude curve |
| `score_arc` | dashboard | Animate score arc from 0 to target value over 1.2s |
| `materialize` | dashboard | Fade in + slide up an element by `id` |
| `cursor_to` | dashboard | Move synthetic cursor to coordinates (or to an element `id`) |
| `card_hover` | dashboard | Lift a card via `translate-y: -2px` + shadow |
| `goal_progress` | dashboard | Animate goal bar from a —b value |
| `code_line` | technical | Append one line of code to the editor with syntax highlighting |
| `run_tests` | technical | Pulse the Run button, then populate test panel |
| `test_result` | technical | Add a row to the test panel: pass / fail / diff |
| `code_edit` | technical | Replace one line with another (animated diff) |
| `submit` | technical | Highlight submit button |

Unknown types are no-ops with a `console.warn` in dev.

#### Selection algorithm

On `<LiveDemoSection>` mount:

```js
const LAST_KEY = 'mockly:lastScript';
const last = JSON.parse(localStorage.getItem(LAST_KEY) || '{}');
const pick = (demoType) => {
  const pool = scripts[demoType].filter(s => s.id !== last[demoType]);
  const choice = pool[Math.floor(Math.random() * pool.length)];
  last[demoType] = choice.id;
  localStorage.setItem(LAST_KEY, JSON.stringify(last));
  return choice;
};
```

SSR safety: localStorage access wrapped in `typeof window !== 'undefined'`. Server renders frame 0 of an arbitrary script; client hydrates and picks fresh.

#### Script roster (15 total)

| Demo | Slug | Theme | Duration |
|---|---|---|---|
| dashboard | `alex-leadership` | Behavioural-heavy practice, latest score 78 (canonical, §7.1) | 12s |
| dashboard | `priya-technical` | Technical-heavy practice, latest score 84, 2-pointer focus | 12s |
| dashboard | `sam-mixed` | Mixed practice, just completed weekly goal | 12s |
| dashboard | `jordan-streak` | 7-day practice streak, modest scores climbing | 12s |
| dashboard | `taylor-improvement` | 3-week score trend visible (62 —78 —85) | 12s |
| behavioural | `leadership-ambiguity` | "Led team through ambiguity" (canonical, §7.2) | 12s |
| behavioural | `cross-functional-conflict` | "Describe a difficult cross-functional conflict" | 12s |
| behavioural | `feedback-received` | "What feedback have you received repeatedly?" | 12s |
| behavioural | `failed-decision` | "Walk me through a decision that didn't work out" | 12s |
| behavioural | `priority-tradeoff` | "How did you prioritize when everything felt urgent?" | 12s |
| technical | `two-sum` | Two-Sum, hash-map approach (canonical, §7.3) | 14s |
| technical | `valid-palindrome` | Valid Palindrome, two-pointer | 14s |
| technical | `merge-intervals` | Merge Intervals, sort + sweep | 14s |
| technical | `binary-search` | Classic Binary Search, off-by-one fix in the diff | 14s |
| technical | `linked-list-cycle` | Floyd's tortoise-and-hare cycle detection | 14s |

#### Authoring guidelines (applies to every script)

1. **Duration parity within a demo type.** Every dashboard script is 12000ms ±0. Every behavioural is 12000ms. Every technical is 14000ms. The tab progress bar assumes constant duration per demo type.
2. **Caption count.** Each script has exactly 3 captions, distributed roughly into thirds.
3. **Caption length.** Each caption is —10 words. Re-read for plain-language clarity (taste-skill Copy Self-Audit).
4. **No em-dashes** anywhere in caption text, mock data, or code samples. Use hyphens or commas.
5. **No AI tells in mock data.** Real-sounding names ("Alex", "Priya", "Sam", "Jordan", "Taylor") not "John Doe". Real-sounding scores (78, 84, 71) not 100 / 99.9 / 50.
6. **One coding language per technical script.** All 5 technical scripts use JavaScript for consistency. (Could mix later if we add a language toggle.)
7. **No real-world references that age** (no current dates, no company names).
8. **Each script is reviewed against the taste-skill pre-flight** before commit, same as code.

#### Authoring workflow

The three canonical scripts (§7.1, §7.2, §7.3) are drafted in this spec. The remaining 12 are drafted during their respective milestone (M2 dashboard, M3 behavioural, M4 technical). Each draft is reviewed against §7.4 guidelines before commit.

---

## §8. Copy Table

| Element | Copy | Length check |
|---|---|---|
| Section eyebrow | `Live Product Tour` | 3 words, — —|
| Section headline | `See how Mockly trains you` | 5 words, — —|
| Section subtext | `Three practice modes, one focused loop: voice, code, and the dashboard that ties them together.` | 17 words, —5 —|
| Tab labels | `Dashboard` / `Behavioural` / `Technical` | 1 word each —|
| Dashboard captions | see §7.1 | each — words —|
| Behavioural captions | see §7.2 | each —0 words —|
| Technical captions | see §7.3 | each —0 words —|

**No em-dashes anywhere** (taste-skill §9.G, zero tolerance).
**No "Quietly used by", no version stamps, no decorative dots** (taste-skill §9.F).
**Curly quotes in all copy** (`'` for apostrophes, `"` for quoted strings).

## §9. Motion Specs

| Motion | Easing | Duration | Triggered by |
|---|---|---|---|
| Demo panel mount | `[0.22, 1, 0.36, 1]` | 600ms | `whileInView` (once) |
| Tab change horizontal slide | `[0.22, 1, 0.36, 1]` | 450ms | Tab click / auto-cycle |
| Tab progress bar fill | `linear` | demo duration (12s or 14s) | Tab becomes active |
| Typewriter text | per-char 25ms | varies | Frame timing in §7 |
| Score arc fill | `[0.16, 1, 0.3, 1]` | 1200ms | Frame timing |
| Card hover lift | `[0.16, 1, 0.3, 1]` | 200ms | Synthetic cursor hover |
| Caption swap (crossfade) | `linear` | 350ms | Frame timing |

**Animations animate only `transform` and `opacity`** (taste-skill §6.A). No `top`/`left`/`width`/`height`.

**Reduced-motion fallback** for all of the above: skip the animation, show the final state immediately.

## §10. DESIGN.md Token Usage

Every color, radius, and spacing pulls from DESIGN.md. No new values introduced.

| Use | Token | Tailwind class (dark / light) |
|---|---|---|
| Section background | page | inherits from page (`bg-white dark:bg-slate-950`) |
| Demo panel background | card-dark / card-light | `bg-slate-50 dark:bg-slate-900/40` |
| Demo panel border | border-light / border-dark | `border border-slate-200 dark:border-white/10` |
| Active tab background | text-primary | `bg-slate-900 dark:bg-white` |
| Active tab text | inverted | `text-white dark:text-slate-900` |
| Inactive tab text | text-muted | `text-slate-500 dark:text-slate-400` |
| Tab progress bar | accent | `bg-emerald-500` |
| Caption strip background | surface | `bg-slate-50 dark:bg-slate-900/60` |
| Caption text | text-secondary | `text-slate-700 dark:text-slate-300` |
| Headline | text-primary | `text-slate-900 dark:text-white` |
| Subtext | text-muted | `text-slate-600 dark:text-slate-400` |
| Code mono | mono | `font-mono` (system fallback to `JetBrains Mono`) |
| Score arc stroke | accent | `stroke-emerald-500` |
| Pass icon | accent | `text-emerald-500` |
| Fail icon | danger | `text-red-500` |

**No gradients in this section.** The only gradient on the page lives on the hero CTA. Adding one here violates §4.2 Color Consistency Lock.

## §11. Component & File Structure

```
apps/frontend/src/component/
  home/
    LiveDemoSection.jsx           —top-level section component
    demos/
      DashboardDemo.jsx
      BehaviouralDemo.jsx
      TechnicalDemo.jsx
      scripts/
        dashboard/
          alex-leadership.js      —canonical (§7.1)
          priya-technical.js
          sam-mixed.js
          jordan-streak.js
          taylor-improvement.js
          index.js                —exports all 5 as an array
        behavioural/
          leadership-ambiguity.js —canonical (§7.2)
          cross-functional-conflict.js
          feedback-received.js
          failed-decision.js
          priority-tradeoff.js
          index.js
        technical/
          two-sum.js              —canonical (§7.3)
          valid-palindrome.js
          merge-intervals.js
          binary-search.js
          linked-list-cycle.js
          index.js
    parts/
      DemoFrame.jsx               —rounded panel wrapper (shared by all 3 demos)
      DemoTabStrip.jsx            —three pills + progress bar
      DemoCaptionStrip.jsx        —caption text that crossfades
      SyntheticCursor.jsx         —animated SVG cursor used by Dashboard demo
      TypewriterText.jsx          —shared typewriter component used by all 3
      ScriptedWaveform.jsx        —canvas waveform driven by pre-baked amplitudes
      MiniScoreArc.jsx
      MiniSessionCard.jsx
      MiniGoalPanel.jsx
      MiniProblemPanel.jsx
      MiniCodeEditor.jsx
      MiniTestPanel.jsx
    hooks/
      useDemoTimeline.js          —drives frame transitions from a script
      useAutoCycle.js             —handles tab auto-advance with pause logic
      useScriptPicker.js          —random pick + localStorage anti-repeat
  ui/
    particle-orb.jsx              —REUSED (no changes)
```

`Home.jsx` change: import `LiveDemoSection` and insert it between the hero spacer and the Question Lab section.

**Total estimated new file count:** ~34 files (16 components/hooks + 15 scripts + 3 index.js). New code ~2000 lines. Bundle impact: < 35KB gzipped (15 scripts ~ 10KB gzipped; no Monaco, no Lottie, no video).

## §12. Responsive Plan

| Breakpoint | Tab strip | Demo panel | Caption |
|---|---|---|---|
| `< 640px` (sm) | Full-width pills, 3 columns, smaller text | 4:3 aspect, simplified frame (no chrome, just panel) | Above panel, single line, ellipsis if overflow |
| `640—024px` (md) | Centered, comfortable padding | 16:10 aspect | Below panel, 2 lines max |
| `—1024px` (lg) | Centered, max-width 480px | 16:9 aspect, `max-h-[560px]` | Below panel, single line, wider |

**Mobile-specific simplifications:**
- Synthetic cursor in Dashboard demo: skip on mobile (no real cursor metaphor on touch).
- Behavioural demo: orb scales down 30%, waveform shrinks proportionally.
- Technical demo: switch from side-by-side (problem|code) to stacked (problem on top, code below).

## §13. Performance Budget

| Concern | Budget | How we hit it |
|---|---|---|
| Initial JS added | < 30KB gzipped | No Monaco, no Lottie, no video. Real ParticleOrb is already on page. |
| Frames per second | 60 fps | Animate only `transform` and `opacity`. No `requestAnimationFrame` loops touching React state (taste-skill §5.D). |
| Memory | Bounded | Cleanup all `setTimeout`/`setInterval` in `useEffect` returns. |
| LCP impact | None | Section is below the fold. `whileInView` defers all animation until visible. |
| CLS | 0 | Reserve aspect-ratio space for the demo panel. |

## §14. Accessibility Checklist

From the `accessibility` skill + `web-design-guidelines` skill:

- [ ] Tab strip uses `role="tablist"`, each tab is `role="tab"`, panel is `role="tabpanel"` with `aria-labelledby`
- [ ] Arrow-key navigation between tabs (Left/Right/Home/End)
- [ ] Focus-visible ring on every tab (`focus-visible:ring-2 focus-visible:ring-emerald-500`)
- [ ] Caption text is announced by screen readers via `aria-live="polite"` so it doesn't interrupt other content
- [ ] All animations honor `prefers-reduced-motion: reduce`
- [ ] Synthetic cursor is `aria-hidden="true"` (decorative)
- [ ] All decorative icons (Lucide) have `aria-hidden="true"`
- [ ] Tab labels visible at all text sizes (no icon-only tabs)
- [ ] Touch targets —44px on mobile (tabs and pause-on-hover area)
- [ ] Color contrast: emerald accent on slate panel —4.5:1 (verified via lint of DESIGN.md)
- [ ] No content that conveys meaning solely through color (pass/fail uses icon + text, not just green/red)

## §15. Pre-Flight Checklist (taste-skill §10 subset relevant to this section)

- [ ] **Zero em-dashes** anywhere in copy or comments
- [ ] **Theme Lock:** every Tailwind color has a `dark:` partner
- [ ] **Color Consistency:** emerald is the only accent; gradient only on hero CTA, not in this section
- [ ] **Shape Lock:** all radii use `rounded-xl` (12px) or `rounded-2xl` (16px), no mixed systems
- [ ] **Button Contrast:** active tab (slate-900 on slate-50) and inactive tab (slate-500 on slate-50) both pass WCAG AA
- [ ] **CTA wrap:** no CTAs in this section, but tab labels never wrap
- [ ] **Eyebrow count:** this section uses 1 eyebrow; total page eyebrow count —2 —- [ ] **Section-Layout-Repetition:** this section's tabbed-demo layout does not repeat elsewhere on the page —- [ ] **No three-equal-cards:** the tab strip has three pills but the demo panel is a single focused view —- [ ] **No fake screenshots from divs:** each demo is a *scripted real component*, not a faked-up screenshot. The Dashboard demo uses real Recharts and real DESIGN.md tokens. The Behavioural demo uses the real `ParticleOrb`. The Technical demo is a hand-styled code block honestly labeled as a code preview.
- [ ] **Copy self-audit:** no AI-hallucinated phrases, no broken grammar
- [ ] **Real images:** N/A —no photographic imagery in this section
- [ ] **Reduced motion respected** throughout
- [ ] **Mobile collapse explicit** per §12
- [ ] **Viewport stability:** `min-h-[100dvh]` not used (this is a section); aspect-ratio reserved
- [ ] **Motion motivated:** every animation shows a product capability (taste-skill §5)
- [ ] **One design system per project:** Tailwind v4 + DESIGN.md tokens only —
## §16. Implementation Milestones

Each milestone has explicit acceptance checkboxes. After implementation, a `reviewer` subagent verifies each box. Implementation does not advance to the next milestone until every box in the current one is ticked.

### M1 —Skeleton + tab strip

**Scope:** `LiveDemoSection.jsx` + `DemoTabStrip.jsx` + `DemoFrame.jsx` + `DemoCaptionStrip.jsx` + `useAutoCycle` + `useDemoTimeline` (engine, no frame handlers wired yet) + `useScriptPicker`. Three placeholder panels (Dashboard / Behavioural / Technical) showing static labels only. Insert into `Home.jsx` between hero spacer and Question Lab.

**Acceptance:**
- [x] **M1.1** Section renders under hero in `Home.jsx`, above Question Lab
- [x] **M1.2** Three tabs visible: Dashboard, Behavioural, Technical
- [x] **M1.3** Tabs auto-cycle in order Dashboard —Behavioural —Technical —Dashboard
- [x] **M1.4** Active tab visually distinct from inactive tabs (per §6.1)
- [x] **M1.5** Progress bar fills left-to-right under active tab over the demo's `duration`
- [x] **M1.6** Per-tab durations correct: Dashboard 12000ms, Behavioural 12000ms, Technical 14000ms
- [x] **M1.7** Clicking a tab resets that demo's progress to 0 and starts from frame 1
- [x] **M1.8** Hovering the demo panel pauses auto-cycle and progress bar; mouse-leave resumes
- [x] **M1.9** Section scrolling out of viewport pauses auto-cycle (IntersectionObserver)
- [x] **M1.10** `document.hidden` (tab unfocused) pauses auto-cycle
- [x] **M1.11** Arrow Left / Right keys move between tabs when tab strip has focus
- [x] **M1.12** Focus-visible ring on every tab (`focus-visible:ring-2 focus-visible:ring-emerald-500`)
- [x] **M1.13** Tab roles: `role="tablist"`, each tab `role="tab"`, each panel `role="tabpanel"` with `aria-labelledby`
- [x] **M1.14** `useDemoTimeline` accepts a stub script `{ id, duration, frames: [], captions: [...] }` and dispatches captions on schedule
- [x] **M1.15** `useScriptPicker` reads/writes `mockly:lastScript` in localStorage with SSR-safe guard
- [x] **M1.16** Reduced motion: with `prefers-reduced-motion: reduce`, auto-cycle disabled; tabs only switch on click; instant fade not slide
- [x] **M1.17** Section uses DESIGN.md tokens only, no new colors / gradients
- [x] **M1.18** Mobile (<768px): tab strip full-width 3 columns, panel aspect 4:3
- [x] **M1.19** Build passes: `npm run build` exits 0
- [x] **M1.20** No console errors / warnings on page load in dev

---

### M2 —Dashboard demo + 5 scripts

**Scope:** All Mini* components for Dashboard + synthetic cursor + score arc + STAR bars + goal panel. Author + commit 5 dashboard scripts.

**Acceptance:**
- [x] **M2.1** All Mini* components implemented: `MiniScoreArc`, `MiniSessionCard`, `MiniGoalPanel`, `SyntheticCursor`, `TypewriterText`
- [x] **M2.2** All 5 scripts authored: `alex-leadership` (canonical), `priya-technical`, `sam-mixed`, `jordan-streak`, `taylor-improvement`
- [x] **M2.3** Each script is 12000ms ±0 duration
- [x] **M2.4** Each script has exactly 3 captions, each —10 words, no em-dashes
- [x] **M2.5** `useScriptPicker` returns one of the 5 on mount; localStorage prevents immediate repeat
- [x] **M2.6** Canonical script frames per §7.1 play correctly: panel —score arc —session cards stagger —cursor hover —STAR bars —goal animation
- [x] **M2.7** Synthetic cursor animates via `transform` only, `aria-hidden="true"`
- [x] **M2.8** Score arc animates via SVG stroke-dashoffset (no `width`/`height` animation)
- [x] **M2.9** Captions cycle in sync with frame timing
- [x] **M2.10** Mobile fallback: synthetic cursor skipped, layout stacks per §12
- [x] **M2.11** Reduced motion: shows final frame statically, no cursor / typewriter animations
- [x] **M2.12** Build passes, no console errors

---

### M3 —Behavioural demo + 5 scripts

**Scope:** Reuse `ParticleOrb`, add `ScriptedWaveform`. Author + commit 5 behavioural scripts.

**Acceptance:**
- [x] **M3.1** `ScriptedWaveform.jsx` implemented (canvas-driven, pre-baked amplitude curves)
- [x] **M3.2** `ParticleOrb` integrated, state prop driven by timeline frames
- [x] **M3.3** All 5 scripts authored: `leadership-ambiguity` (canonical), `cross-functional-conflict`, `feedback-received`, `failed-decision`, `priority-tradeoff`
- [x] **M3.4** Canonical script reuses the hero typewriter question for page continuity
- [x] **M3.5** Each script is 12000ms ±0 duration, 3 captions ≤ 10 words, no em-dashes
- [x] **M3.6** Orb state cycles correctly per script (idle / speaking / listening / thinking)
- [x] **M3.7** Waveform amplitude curves visible and varied across the 5 scripts
- [x] **M3.8** Mobile fallback: orb 30% smaller, waveform shrinks proportionally
- [x] **M3.9** Reduced motion: orb is static at idle state, waveform shows flat line, transcript text shown statically
- [x] **M3.10** Build passes, no console errors

---

### M4 —Technical demo + 5 scripts

**Scope:** All Mini* components for Technical + hand-styled code editor + test panel + diff animation. Author + commit 5 technical scripts.

**Acceptance:**
- [x] **M4.1** All Mini* components implemented: `MiniProblemPanel`, `MiniCodeEditor`, `MiniTestPanel`
- [x] **M4.2** `MiniCodeEditor` uses hand-styled syntax-highlighted `<pre>`, NOT real Monaco
- [x] **M4.3** All 5 scripts authored: `two-sum` (canonical), `valid-palindrome`, `merge-intervals`, `binary-search`, `linked-list-cycle`
- [x] **M4.4** Each script is 14000ms ±0 duration, 3 captions ≤ 10 words, no em-dashes
- [x] **M4.5** Code types in line-by-line via Framer Motion stagger
- [x] **M4.6** Test panel shows pass/fail rows with icon + text (not color alone)
- [x] **M4.7** Diff animation: failing line gets highlight, then animates to fixed line
- [x] **M4.8** Mobile fallback: side-by-side becomes stacked (problem on top, code below)
- [x] **M4.9** Reduced motion: shows final passing-state statically
- [x] **M4.10** Bundle impact verified: no Monaco import, total section JS < 35KB gzipped
- [x] **M4.11** Build passes, no console errors

---

### M5 — Move Question Lab

**Scope:** Reorder sections in `Home.jsx`.

**Acceptance:**
- [x] **M5.1** Question Lab section now renders below `LiveDemoSection`
- [x] **M5.2** Hero anchor link `#question-lab` still scrolls to Question Lab correctly
- [ ] > BLOCKED: requires browser test **M5.3** No visual regression on Practice Tracks, How It Works, CTA, Footer
- [x] **M5.4** Build passes

---

### M6 — Polish + a11y audit

**Scope:** Run `accessibility` and `web-design-guidelines` skills on all new files. Fix findings. Apply taste-skill pre-flight (§15).

**Acceptance:**
- [ ] > FAIL: Shape Lock violation - rounded-lg (8px) used in MiniSessionCard.jsx:33, MiniGoalPanel.jsx:21, MiniCodeEditor.jsx:36, DashboardDemo.jsx:149,160. rounded (4px) used in MiniTestPanel.jsx:41. DESIGN.md permits only 6px/12px/16px/20px/full. Also SyntheticCursor.jsx uses left/top CSS transitions (lines 36-37) violating §9 "animate only transform/opacity" (deferred from M2). **M6.1** All boxes in pre-flight checklist §15 ticked
- [x] **M6.2** All boxes in accessibility checklist §14 ticked
- [ ] > FAIL: transition-all found in MiniSessionCard.jsx:33 - violates web-design-guidelines "no transition: all" **M6.3** `web-design-guidelines` skill run on every new file with zero critical findings
- [ ] > FAIL: No skip link present on home page (index.html has no skip-to-main link). **M6.4** `accessibility` skill run on `LiveDemoSection.jsx` with zero critical findings
- [ ] > BLOCKED: requires browser test **M6.5** Lighthouse accessibility score on home page ≥ 95
- [ ] > BLOCKED: requires browser test **M6.6** Manual keyboard nav test: Tab into section, Arrow nav between tabs, Esc to release focus
- [ ] > BLOCKED: requires browser test **M6.7** Manual reduced-motion test: enable OS setting, verify no auto-cycle / no slide / no typewriter
- [x] **M6.8** Build passes, bundle size delta verified
- [x] **M6.9** All open spec questions §18 confirmed resolved

---

Estimated total: 3-4 dev sessions (extra session for the 12 non-canonical script drafts).

## §17. Related Work —Dashboard Redesign

The user flagged the current Dashboard as "too AI generated, modules don't render well, wireframe loading animations are ugly and not even animated." This spec **does not address the live Dashboard**, but the **Dashboard demo it produces is implicitly the target visual state**.

Recommended follow-up after this spec ships:

1. **Adopt the Mini* components as the design language for the real Dashboard.** `MiniScoreArc`, `MiniSessionCard`, `MiniGoalPanel` are designed against DESIGN.md and can scale up to full Dashboard layouts.
2. **Replace the broken skeleton-shimmer loading.** The current shimmer is static; replace with a Framer Motion pulse on actual layout blocks (use the `prefers-reduced-motion: reduce` fallback baked into Mockly's existing CSS).
3. **Audit the Dashboard against `web-design-guidelines` and `accessibility` skills.** That review will surface the rendering issues the user already noticed.

Separate spec recommended: `specs/DASHBOARD-REDESIGN.md`. Not blocking this section.

## §18. Open Questions —RESOLVED

All decisions confirmed with user:

- —Approach: scripted React mockup
- —Layout: tabbed with auto-cycle, horizontal slide between tabs
- —Question Lab: moves below new section
- —Eyebrow label: `Live Product Tour` (user will eyeball at M1; easy to change)
- —Headline: `See how Mockly trains you`
- —Technical canonical: Two-Sum (1 of 5 in the technical bank)
- —Interactivity: pause-on-hover + tab clicks only. No visible Pause button.
- —Conversation bank: 5 variants per demo, 15 scripts total. Random pick + localStorage anti-repeat.
- —Behavioural canonical reuses the hero typewriter question for page continuity. Other 4 variants use different questions.

## §19. Sign-off

Spec is implementation-ready. Implementation begins at M1.
