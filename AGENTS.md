This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

For code changes, run lint and typecheck before declaring the task done. Documentation-only changes need a diff review, not an application build or test suite. The user's WSL is memory-constrained: run heavy checks sequentially with `NODE_OPTIONS=--max-old-space-size=512`; use `--runInBand` and no watch mode for focused Jest runs. Do not run Expo, Chromium, and tests together. The Node option limits heap, not total process memory.

Para trabalhar em frentes paralelas (worktrees, workspaces do DSH, um Metro por vez, dono dos arquivos compartilhados), veja `docs/parallel-work.md`.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- Never reintroduce a UI element the user has removed unless they explicitly ask for it to return. Treat removals as persistent product decisions, including when making related layout or feature changes.
- Never reduce existing typography sizing or line height without an explicit request. Display and condensed fonts need vertical headroom: preserve enough line height to prevent clipping of uppercase letters and numbers, and verify counters as well as headings after typography changes.
- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Design rules

- Read `CLAUDE.md` for the design direction refined with the user in the Public Library, Explore, Praças, and the Início feed, including hierarchy, typography, spacing, discovery previews, sticky search controls, social cards, square cards, day rules, media framing, and deferred Library scalability work. Apply those criteria to new or requested work; do not automatically migrate other screens or change shared defaults.
- Standard primary and secondary actions in editorial screens use `EditorialAction` from `src/components/editorial-action.tsx`. Do not copy its styles into feature files.
- Editorial actions have a 50 px minimum height, 22 px leading icon, and 8 px icon/text gap. Existing defaults are square with a 1.5 px `Colors.ink` border and mono uppercase label. The refined Library direction explicitly uses `Radius.sm`, `labelVariant="button"`, red primary actions with a 1.5 px ink border, and paper secondary actions with a 1 px ink border. Keep the primary border ink, never red. Reserve borderless `ghost` for tertiary actions; an important secondary action such as `Criar coleção` needs a visible surface and border.
- In icon-and-label editorial actions, keep the label centered in the full button. When an icon must stay on the left edge, use `EditorialAction` with `pinnedLeadingIcon` rather than shifting the whole label-and-icon group.
- The `Gerenciar comuna` action is always a red editorial primary action, with its settings icon aligned to the left edge of the action.
- Never use `Radius.pill` on a button with text, including compact controls, toggles, and chips. Use `Radius.sm` for the refined control direction; existing square editorial flows may remain until reviewed. Icon-only buttons and avatars may be circular.
- When two editorial actions share a row, keep them the same height and size them with `flex` on the component's `style` prop rather than changing internal padding, typography, or icon size.
- Editorial inner-page headers follow the library chrome: a 58 px minimum-height row with 4 px horizontal padding, back button, a 1.5 px × 28 px `Colors.ink` vertical divider, then the mono uppercase `label` title. Optional actions such as the overflow menu stay at the far right; use a 44 px spacer when the action is absent so the title area remains stable.
- Form bottom sheets use the shared `BottomSheet` title chrome, `TextField` with `appearance="editorial"`, and `EditorialAction` for full-width primary and secondary actions. Keep controls rectangular and stack actions vertically unless the flow clearly requires a paired choice.
- Every editable text field must have a persistent label and a concise, realistic placeholder that demonstrates the expected content (prefer `Ex.: …` for open-ended fields). A placeholder supplements the label and must never replace it; do not repeat the label verbatim as placeholder text.
- Use `SectionHeading appearance="editorial"` for refined section headings (mono 12.5/18 label, red marker, ink navigation action with a 44 px minimum target). Do not duplicate its styles or change legacy defaults to update a single screen.
- Explore prioritizes social content before extensive topic grids and promotional banners. Its home previews contain up to three entries per content section and six topics, with access to complete categories or the full topic sheet. These are Explore-specific limits; preserve pagination and all-item access.
- In long discovery lists, let the display title scroll away and keep only useful search controls sticky on an opaque surface. Keep the search input mounted across query/result states, preserve query and topic when switching categories, and avoid nesting vertical virtualized lists in vertical scroll views.
- Explore post previews use `DiscoveryPostRow` with avatar/author identity instead of large ranking numbers. Keep profile/follow rows distinct from publication cards, and do not apply preview typography automatically to full posts. Screenshot approval does not establish keyboard, accessibility, or performance validation.
- A control that looks actionable must act. No chevron, menu, or sort affordance without a handler; when the API cannot support the action, remove the control or render it as static text with no affordance.
- Choose card anatomy by metadata volume, not by copying another card. A heading plus an indented metadata block needs a small icon and several metadata lines; a large mark or avatar with one or two lines uses a single two-column row with a vertically centered chevron. Never repeat the card title in its supporting line, and never show a status marker that contradicts its label (a red presence dot with "0 pessoas").
- Inside a React Native `Modal`, the native `SafeAreaView` reports zero insets. Use `useSafeAreaInsets()` from the app provider, and keep viewer chrome and controls out of the notch and status bar; verify on a notched device.
- A gesture that moves (pinch, pan, drag) must suppress tap and double-tap handlers for a short window (~450 ms). Without it, a small pinch counts as two quick taps and a hard drag that slips the finger fires the tap action. Settle shared values on deactivate so the gesture never ends mid-way.
- Fullscreen media keeps the image inside the usable area and the chrome at the bottom, in thumb reach. If the feed crops media, the fullscreen view is the only path to the whole file, so it is not optional.
