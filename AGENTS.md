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

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Design rules

- Standard primary and secondary actions in editorial screens use `EditorialAction` from `src/components/editorial-action.tsx`. Do not copy its styles into feature files.
- Editorial actions are rectangular: 50 px minimum height, 1.5 px `Colors.ink` border, square corners, 22 px leading icon, 8 px icon/text gap, and the mono uppercase `label` text variant. Every tone keeps the black/ink border—including red primary actions; never change the primary border to red. The red tone is the primary action; the paper tone is secondary.
- Use pill-shaped buttons only for compact controls, toggles, chips, or established legacy flows. Do not introduce pills for full-width or side-by-side page actions.
- When two editorial actions share a row, keep them the same height and size them with `flex` on the component's `style` prop rather than changing internal padding, typography, or icon size.
- Editorial inner-page headers follow the library chrome: a 58 px minimum-height row with 4 px horizontal padding, back button, a 1.5 px × 28 px `Colors.ink` vertical divider, then the mono uppercase `label` title. Optional actions such as the overflow menu stay at the far right; use a 44 px spacer when the action is absent so the title area remains stable.
- Form bottom sheets use the shared `BottomSheet` title chrome, `TextField` with `appearance="editorial"`, and `EditorialAction` for full-width primary and secondary actions. Keep controls rectangular and stack actions vertically unless the flow clearly requires a paired choice.
- Every editable text field must have a persistent label and a concise, realistic placeholder that demonstrates the expected content (prefer `Ex.: …` for open-ended fields). A placeholder supplements the label and must never replace it; do not repeat the label verbatim as placeholder text.
