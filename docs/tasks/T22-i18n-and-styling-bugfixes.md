# T22 — i18n and styling bug fixes

**Phase:** 4 · **Depends on:** T21 (T09, T11a, T11b for name-style data) · **Risk:** low · **Decisions:** —
**Audit refs:** BUG-05, BUG-06, BUG-07, BUG-12, BUG-13, SEC-05 (render side)

## Goal
- Remove every hardcoded user-visible Hungarian or English string from the render path, so hu, en and de all display correctly.
- Make every Tailwind class a static string that JIT can see.
- Render custom name colour and font **only** through static allowlist maps, so data can never inject classes or styles (SEC-05).
- Fix the misleading edit toast and the approve error that is silently swallowed.

## Context
- **Orchestrator note (from T03):** about 16 translation keys are unused besides the ones T03 removed (for example `levelBeginner`, `welcomeBack`). Before adding new keys, check with grep whether an existing unused key already has the right text and reuse it. The level-name keys are reused by this task. Delete keys that are still unused at the end, in all three languages, with the grep proof in the commit message.
Line numbers are from `eee5668`; re-locate each site by the quoted text or landmark. Files deleted by T03 (FilterPanel, DistanceSelector, Toast, types) are out of scope. **AuthModal's inline `texts` object, InstallGate's `texts` and LanguageSelector's ternaries are migrated in T24, not here.**

**Root cause of most missing styles (BUG-07):** `tailwind.config.ts` `content` scans only `src/pages`, `src/components` and `src/app`, **not `src/lib`**. Class strings defined only in `src/lib/levelUtils.ts` are therefore never generated. Verified by grep: none of these appear literally anywhere in the scanned dirs:
- `bg-gray-500/20`, `border-gray-500/30` (level 1 badge)
- `bg-gray-400/20`, `border-gray-400/30`, `text-gray-300` (level 2)
- the custom name colours `text-emerald-400`, `text-rose-400`, `text-yellow-300`, `text-slate-300`, `text-orange-400`
- the fonts `font-serif`, `font-mono`, `font-extrabold`, `font-light`

Runtime-built classes (BUG-07 proper), which are never generated regardless of the content glob:
1. `ProfilePanel.tsx` colour picker, selected state (currently at :675): `` `${colorOption.value.replace('text-','bg-')}/20 border-2 ${colorOption.value.replace('text-','border-')}` ``.
2. `ProfilePanel.tsx` level-info modal progress bar (currently at :1137): `` `${currentLevel.bgColor.replace('/20','/80')}` ``.

**SEC-05 render sites (data interpolated into className/style):**
- `SpotDetailsPanel.tsx` `ReviewerBadge`: `className={`font-medium ${review.customNameFont || 'font-sans'}`}` (currently at :76), plus colour via `getUserNameColor` (:72).
- `ProfilePanel.tsx` preview (currently at :753-756): `user?.customNameFont` in className; `getCustomNameColorValue(user?.customNameColor)` in `style.color`.
- `src/lib/levelUtils.ts` `getCustomNameColorValue` (currently at :144-150) passes **any** string starting with `#`, `rgb` or `hsl` straight into `style.color`. It is used by `getUserNameColor`, which is called from SpotDetailsPanel (creator, reviewers) and SpotInfoWindow (creator).
- After T11b, `ReviewerBadge` reads font and colour from `meta` (`publicProfiles`), and already checks the font inline against `CUSTOM_NAME_FONTS.map(f => f.value)`. It never reads `review.customNameFont`. T09 validates server-side against the same exact values and drops anything else, including hex colours, to `null`. This task centralises the render-side check in one module and covers the remaining sites. Treat **all** stored values as untrusted at render time.

**Level names:** `LEVEL_THRESHOLDS[].name` (`levelUtils.ts` :29-33) is Hungarian. **Decision: translate via keys.** Matching keys already exist in all three languages: `levelBeginner` (Kezdő), `levelExplorer` (Haladó), `levelMaster` (Felfedező), `levelLegend` (Spotmester), `levelDiamond` (Világutazó). The hu values are identical to today's names. `getSpotsRemainingText` (:199-205) also returns Hungarian.

**German is missing 7 keys** (verified by key diff): `feedback`, `attachImages`, `feedbackPlaceholder`, `feedbackSendError`, `sendFeedback`, `sending`, `patchNotes`. `t()` returns the key name for a missing key, so German users currently see literally "feedback", "attachImages" and so on. The `|| 'fallback'` expressions in `FeedbackPanel.tsx` are dead code, because `t()` never returns a falsy value.

### String inventory → keys (hu / en / de)
Use existing keys where marked; add every "new" key to all three languages.

| Site (landmark, current line) | Current literal | Key | hu | en | de |
|---|---|---|---|---|---|
| SpotDetailsPanel `handleDeleteImage` :434 (BUG-05) | `t('confirmDeleteSpot').replace('helyet','képet')` | new `confirmDeleteImage` | Biztosan törlöd ezt a képet? Ez a művelet nem vonható vissza. | Are you sure you want to delete this image? This action cannot be undone. | Möchten Sie dieses Bild wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden. |
| SpotDetailsPanel `handleSubmitReview` :347 | Már értékelted ezt a helyet! | new `alreadyReviewed` | Már értékelted ezt a helyet! | You have already reviewed this spot! | Du hast diesen Ort bereits bewertet! |
| SpotDetailsPanel `formatDate` :294 | Unknown | new `unknownDate` | Ismeretlen | Unknown | Unbekannt |
| SpotDetailsPanel `handleHighlightSpot` :336 | 'Error highlighting spot' (fallback) | existing `highlightError` | — | — | — |
| SpotDetailsPanel `handleSaveEdit` :418 (BUG-12) | always `nameUpdated` | existing `nameUpdated` / `descriptionUpdated` + new `spotUpdated` | Hely frissítve! | Spot updated! | Ort aktualisiert! |
| AddSpotModal location box :207 | 📍 Location: | existing `location` → `📍 {t('location')}: …` | — | — | — |
| AddSpotModal preview badge :328 | Fő | new `primaryBadge` | Fő | Main | Haupt |
| AddSpotModal preview button :348 | Legyen fő | new `makePrimary` | Legyen fő | Make main | Als Hauptbild |
| AuthModal signup hint :294 | 3-20 karakter, csak kisbetű, szám és _ | new `usernameRules` | 3-20 karakter, csak kisbetű, szám és _ | 3-20 characters, lowercase letters, numbers and _ only | 3-20 Zeichen, nur Kleinbuchstaben, Zahlen und _ |
| ProfilePanel level badge :380 | `{level}. szint` | new `levelLabel` | {level}. szint | Level {level} | Stufe {level} |
| ProfilePanel perks :423 | `✨ {n}x kiemelés` | new `perkHighlights` | {count}x kiemelés | {count}x highlight | {count}x Hervorhebung |
| ProfilePanel perks :424 | 🎨 ikonok | new `perkIcons` | ikonok | icons | Symbole |
| ProfilePanel perks :425 | 💎 testreszabás | new `perkCustomization` | testreszabás | customization | Anpassung |
| ProfilePanel toggle :525, heading :552 | Helyek kiemelése | new `highlightSpots` | Helyek kiemelése | Highlight spots | Orte hervorheben |
| ProfilePanel toggle :525 | Kiemelés bezárása | new `closeHighlightPanel` | Kiemelés bezárása | Close highlights | Hervorhebung schließen |
| ProfilePanel toggle :535 | Név testreszabása | new `customizeName` | Név testreszabása | Customize name | Namen anpassen |
| ProfilePanel toggle :535 | Testreszabás bezárása | new `closeCustomization` | Testreszabás bezárása | Close customization | Anpassung schließen |
| ProfilePanel :555 | `{a} / {b} kiemelve` | new `highlightedCount` | {count} / {max} kiemelve | {count} / {max} highlighted | {count} / {max} hervorgehoben |
| ProfilePanel :563 | Nincs jóváhagyott helyed a kiemeléshez. | new `noApprovedSpotsToHighlight` | (same) | You have no approved spots to highlight. | Du hast keine freigegebenen Orte zum Hervorheben. |
| ProfilePanel :607 | Kiemelés megszüntetve | new `highlightRemoved` | Kiemelés megszüntetve | Highlight removed | Hervorhebung entfernt |
| ProfilePanel :610 | Hely kiemelve! ✨ | new `spotHighlighted` | Hely kiemelve! ✨ | Spot highlighted! ✨ | Ort hervorgehoben! ✨ |
| ProfilePanel :613, :667, :709 | Hiba történt | new `genericError` | Hiba történt | Something went wrong | Ein Fehler ist aufgetreten |
| ProfilePanel :625 | Törlés / Kiemel | existing `delete` / new `highlightAction` | Kiemel | Highlight | Hervorheben |
| ProfilePanel :645 | 💎 Gyémánt Testreszabás | new `diamondCustomization` | Gyémánt Testreszabás | Diamond Customization | Diamant-Anpassung |
| ProfilePanel :648 | 5. szint kizárólagos funkciók - … | new `diamondCustomizationDesc` | 5. szint kizárólagos funkciók - válassz egyedi színt és betűstílust! | Level 5 exclusive features - choose a custom colour and font style! | Exklusive Funktionen ab Stufe 5 - wähle eine eigene Farbe und Schriftart! |
| ProfilePanel :654 | Név színe: | new `nameColorLabel` | Név színe: | Name colour: | Namensfarbe: |
| ProfilePanel :665 | Szín beállítva: {name} | new `colorSet` | Szín beállítva: {name} | Colour set: {name} | Farbe gesetzt: {name} |
| ProfilePanel :686, :728 | ✓ Aktív | new `activeLabel` | Aktív | Active | Aktiv |
| ProfilePanel :696 | Betűstílus: | new `fontStyleLabel` | Betűstílus: | Font style: | Schriftart: |
| ProfilePanel :707 | Betűstílus beállítva: {name} | new `fontSet` | Betűstílus beállítva: {name} | Font style set: {name} | Schriftart gesetzt: {name} |
| ProfilePanel :738 | Előnézet: | new `previewLabel` | Előnézet: | Preview: | Vorschau: |
| ProfilePanel :760 | Így fog megjelenni másoknak | new `previewHint` | Így fog megjelenni másoknak | This is how others will see you | So sehen dich andere |
| ProfilePanel :683, :725, :758 | 'username' fallback | existing `username` | — | — | — |
| levelUtils `getSpotsRemainingText` :201 | Maximum szint elérve! 🎉 | new `maxLevelReached` | Maximum szint elérve! 🎉 | Maximum level reached! 🎉 | Höchste Stufe erreicht! 🎉 |
| levelUtils `getSpotsRemainingText` :204 | `{n} hely a következő szintig` | new `spotsToNextLevel` | {count} hely a következő szintig | {count} spots to the next level | {count} Orte bis zur nächsten Stufe |
| levelUtils `CUSTOM_NAME_COLORS` :164-170 | Gyémánt Kék … Tüzes Narancs | new `nameColorCyan`, `nameColorPurple`, `nameColorEmerald`, `nameColorRose`, `nameColorGold`, `nameColorSilver`, `nameColorOrange` | (current hu names) | Diamond Blue, Purple Magic, Emerald Green, Ruby Red, Golden Glow, Silver Moonlight, Fiery Orange | Diamantblau, Lila Zauber, Smaragdgrün, Rubinrot, Goldglanz, Silbernes Mondlicht, Feuriges Orange |
| levelUtils `CUSTOM_NAME_FONTS` :177-183 | Normál … Vékony Elegáns | new `nameFontNormal`, `nameFontBold`, `nameFontHandwriting`, `nameFontModern`, `nameFontElegant`, `nameFontExtraBold`, `nameFontLightElegant` | (current hu names) | Normal, Bold, Handwriting, Modern, Elegant, Extra Bold, Light Elegant | Normal, Fett, Handschrift, Modern, Elegant, Extrafett, Leicht elegant |
| MapThemeSwitcher :15 | `t('themeSatellite') \|\| 'Műhold'` | existing `themeSatellite` (drop dead fallback) | — | — | — |
| FeedbackPanel :107,:117,:134,:186 | `\|\| 'Visszajelzések'` etc. | existing keys (drop fallbacks; add the 7 missing **de** values: Feedback, Bilder anhängen, Beschreibe dein Feedback ausführlich..., Fehler beim Senden des Feedbacks, Senden, Wird gesendet..., Versionshinweise) | — | — | — |
| FeedbackPanel `PatchNotesPreview` :195, :202 | Betöltés... / No patch notes yet. | new `loading`, `noPatchNotes` | Betöltés... / Még nincsenek frissítési megjegyzések. | Loading... / No patch notes yet. | Wird geladen... / Noch keine Versionshinweise. |
| FeedbackPanel :80 | `\|\| 'Failed sending feedback.'` | existing `feedbackSendError` | — | — | — |
| useToastStore `toastTitles` :8-10, :27 | ✅ Success / ❌ Error / ℹ️ Info / Notification | new `toastSuccess`, `toastError`, `toastInfo`, `notificationDefaultTitle` (emoji prefix stays in code) | Siker / Hiba / Info / Értesítés | Success / Error / Info / Notification | Erfolg / Fehler / Info / Benachrichtigung |
| usePushNotifications foreground :153 | New Notification | new `newNotification` | Új értesítés | New Notification | Neue Benachrichtigung |

Store-thrown messages that reach the UI through `error.message` (ProfilePanel `handleAddAdmin`, `handleRemoveAdmin`, `handleSaveUsername` and the highlight/customize handlers; UsernameSetupModal `handleSave`; AddSpotModal `handleSubmit`): re-grep `throw new Error(` in `src/store` after T11a/T11b. Follow the existing `MAX_SPOT_IMAGES` pattern: the store throws an UPPER_SNAKE code, and the display site maps known codes to keys. Unknown errors fall back to that site's existing generic key (`usernameSaveError`, `adminAddError`, `genericError`, …). For callable errors (`HttpsError`), map on `error.code`.

**Deliberately not translated in this task** (document in the commit body):
- `aria-label` and `alt` strings. The T04 e2e selectors depend on them; a later a11y task handles these.
- Language endonyms: `Magyar`, `English`, `Deutsch`, `Magyarország`, `International`, `Deutschland`.
- The `Admin`/`ADMIN` badges, which read the same in hu, en and de.
- Service-worker notification fallbacks in `src/app/api/firebase-messaging-sw/route.ts`, which have no language access.
- Emoji-only glyphs.

## Files
- Modify: `tailwind.config.ts`, `src/lib/translations.ts`, `src/lib/levelUtils.ts`, `src/components/ProfilePanel.tsx`, `src/components/SpotDetailsPanel.tsx`, `src/components/SpotInfoWindow.tsx` (only if the colour call changes signature), `src/components/AddSpotModal.tsx`, `src/components/AuthModal.tsx` (hint line only), `src/components/FeedbackPanel.tsx`, `src/components/MapThemeSwitcher.tsx`, `src/components/UsernameSetupModal.tsx` (error mapping), `src/store/useToastStore.ts`, `src/hooks/usePushNotifications.ts`, `src/store/useUserStore.ts` (error codes only).
- Create: `src/lib/nameStyle.ts`, `src/lib/nameStyle.test.ts`, `src/lib/levelUtils.test.ts`, `src/lib/translations.test.ts`.
- Modify, **only if** `CUSTOM_NAME_COLORS`/`CUSTOM_NAME_FONTS` change shape: `functions/test/levels.parity.test.ts` (T09; it imports them from `src/lib/levelUtils.ts`). Update its mapping only, never the value lists.

## Steps
1. **Tailwind content:** add `"./src/lib/**/*.{js,ts,jsx,tsx}"` to `content` in `tailwind.config.ts`.
2. **`src/lib/nameStyle.ts`** (pure, no React). The allowlist keys are the exact values stored today, so existing data stays valid.
   - **Imports:** T09's `functions/test/levels.parity.test.ts` imports `../../src/lib/levelUtils` under the functions vitest, where the `@/` alias does not resolve. So `levelUtils.ts` and `nameStyle.ts` use **relative** imports only (`levelUtils.ts` → `./nameStyle`), and import `./translations` with `import type` only (`TranslationKey`), never `@/lib/...` and never a runtime import of the dictionaries.
   ```ts
   export const NAME_COLORS = {
     'text-cyan-300':    { textClass: 'text-cyan-300',    selectedClass: 'bg-cyan-300/20 border-2 border-cyan-300',       hex: '#67e8f9', labelKey: 'nameColorCyan' },
     'text-purple-400':  { textClass: 'text-purple-400',  selectedClass: 'bg-purple-400/20 border-2 border-purple-400',   hex: '#c084fc', labelKey: 'nameColorPurple' },
     'text-emerald-400': { textClass: 'text-emerald-400', selectedClass: 'bg-emerald-400/20 border-2 border-emerald-400', hex: '#34d399', labelKey: 'nameColorEmerald' },
     'text-rose-400':    { textClass: 'text-rose-400',    selectedClass: 'bg-rose-400/20 border-2 border-rose-400',       hex: '#fb7185', labelKey: 'nameColorRose' },
     'text-yellow-300':  { textClass: 'text-yellow-300',  selectedClass: 'bg-yellow-300/20 border-2 border-yellow-300',   hex: '#fde047', labelKey: 'nameColorGold' },
     'text-slate-300':   { textClass: 'text-slate-300',   selectedClass: 'bg-slate-300/20 border-2 border-slate-300',     hex: '#cbd5e1', labelKey: 'nameColorSilver' },
     'text-orange-400':  { textClass: 'text-orange-400',  selectedClass: 'bg-orange-400/20 border-2 border-orange-400',   hex: '#fb923c', labelKey: 'nameColorOrange' },
   } as const satisfies Record<string, { textClass: string; selectedClass: string; hex: string; labelKey: TranslationKey }>;
   export const NAME_FONTS = {
     'font-sans': { className: 'font-sans', labelKey: 'nameFontNormal' },
     'font-bold': { className: 'font-bold', labelKey: 'nameFontBold' },
     'font-serif': { className: 'font-serif', labelKey: 'nameFontHandwriting' },
     'font-mono': { className: 'font-mono', labelKey: 'nameFontModern' },
     'font-serif italic': { className: 'font-serif italic', labelKey: 'nameFontElegant' },
     'font-extrabold': { className: 'font-extrabold', labelKey: 'nameFontExtraBold' },
     'font-light italic': { className: 'font-light italic', labelKey: 'nameFontLightElegant' },
   } as const;
   export function resolveNameFontClass(v: unknown): string  // allowlisted className, else 'font-sans'
   export function resolveNameColorHex(v: unknown): string | undefined // allowlisted hex, else undefined
   ```
   - Use `Object.hasOwn` for lookups; never do an unguarded `obj[v]` with `v === '__proto__'`.
   - The order of entries must equal today's `CUSTOM_NAME_COLORS` and `CUSTOM_NAME_FONTS` order, because the pickers render in that order.
   - Keep `CUSTOM_NAME_COLORS` and `CUSTOM_NAME_FONTS` in `levelUtils.ts` as derived arrays `{ value, labelKey, … }` (drop the Hungarian `name`), or replace their usages with `Object.entries(NAME_COLORS)`. Either way, the picker order stays the same.
3. **`getCustomNameColorValue`** → delegate to `resolveNameColorHex`.
   - **Intended change:** raw `#…`/`rgb…`/`hsl…` strings are no longer honoured; a custom value not in the allowlist falls back to the level colour.
   - `getUserNameColor` keeps its signature.
4. **Render sites:**
   - ReviewerBadge `className={`font-medium ${resolveNameFontClass(font)}`}`, where `font` is whatever the post-T11b code passes (a profile font or a legacy `review.customNameFont`).
   - ProfilePanel preview likewise.
   - ProfilePanel picker selected state uses `NAME_COLORS[value].selectedClass` (BUG-07 #1).
   - Picker labels use `t(labelKey)`, and so do the toasts `colorSet`/`fontSet` (`{name}` = the translated label).
5. **Level styles (BUG-07 #2):** add `progressBarClass` to `getLevelInfo`'s return value as a static string per level: L1 `bg-gray-500/80`, L2 `bg-gray-400/80`, L3 and L4 `bg-yellow-500/80`, L5 `bg-cyan-500/80`. Use it in the level-info modal instead of `.replace('/20','/80')`.
6. **Level names:**
   - In `LEVEL_THRESHOLDS`, replace `name` with `nameKey: TranslationKey` (`levelBeginner` … `levelDiamond`).
   - `getLevelInfo` returns `nameKey` instead of `name`.
   - Update ProfilePanel (current :400, :1130, :1178) to `t(levelInfo.nameKey)`.
   - `getSpotsRemainingText(spotsCount, spotsForNext, t)` takes the translate function and uses `maxLevelReached` / `spotsToNextLevel`.
7. **Strings:** apply every row of the inventory table. Interpolate with `.replace('{x}', …)`, the existing convention (T24 adds `vars`).
8. **BUG-12:** in `handleSaveEdit`, compute `nameChanged` and `descChanged` exactly as today's two `if` conditions:
   - only name changed → `nameUpdated`
   - only description changed → `descriptionUpdated`
   - both → `spotUpdated`
   - neither → exit edit mode with **no toast**
9. **BUG-13:** in ProfilePanel `handleApproveSpot`, change the log to `'Failed to approve spot:'` and add `showToast(t('approveError'), 'error')`. No success toast (unchanged).
10. **Tests:**
    - `translations.test.ts`: hu, en and de have identical key sets, and no value is empty.
    - `nameStyle.test.ts`: every allowlist entry resolves. `'fixed inset-0 z-[9999]'`, `'#ff0000'`, `'__proto__'`, `undefined` and `123` resolve to `font-sans` / `undefined`.
    - `levelUtils.test.ts`: `getLevelInfo` at 0, 2, 3, 9, 10, 14, 15, 19, 20 and 100 returns the same level, colours and `nameKey` mapping as before; `progressBarClass` is present; `getSpotsRemainingText` works with a stub `t`.

**Intended behaviour changes:**
- en and de users see translated strings (level names, perks, highlight and customization UI, toasts, confirm dialogs).
- German users see real feedback texts instead of key names.
- Level-1/2 badges now show their grey background and border.
- Custom colours emerald, rose, yellow, slate and orange, and fonts serif, mono, extrabold and light, now actually render. The picker's selected state shows its tinted background and border.
- The level-info progress bar is now visible.
- Non-allowlisted name colours and fonts are ignored.
- The edit toast matches what changed; no toast when nothing changed.
- Approve failures in the pending tab show an error toast.
- The delete-image confirm dialog says "image" in every language.
- Store error messages are shown translated.

## Must NOT change
- Hungarian text of every existing string, except these **intended hu changes** (today's English literal or fallback becomes the hu key value):
  - SpotDetailsPanel `formatDate`: `Unknown` → `Ismeretlen` (`unknownDate`).
  - SpotDetailsPanel `handleHighlightSpot` fallback: `Error highlighting spot` → the hu `highlightError` value.
  - usePushNotifications foreground title: `New Notification` → `Új értesítés`.
  - useToastStore titles: `✅ Success` → `✅ Siker`, `❌ Error` → `❌ Hiba`, fallback `Notification` → `Értesítés` (`ℹ️ Info` is unchanged).
  - FeedbackPanel `PatchNotesPreview`: `No patch notes yet.` → `Még nincsenek frissítési megjegyzések.`
  - ProfilePanel name previews (:683, :725, :758): fallback `username` → `Felhasználónév`.
  - The German key-name fallbacks (German only).
- Stored values of `customNameColor` and `customNameFont` (no data migration). The picker writes the same values as today.
- Level thresholds, colours, icons, `maxHighlights`, `canCustomize*`, and name hex colours for levels 1-5.
- DOM structure, aria-labels, ids and `alt`s (e2e landmarks).
- AuthModal, InstallGate and LanguageSelector texts (except the AuthModal hint line), which T24 migrates.

## Acceptance
```bash
npm run verify
npm run verify:fn                     # T09's functions/test/levels.parity.test.ts imports CUSTOM_NAME_* from levelUtils
npx vitest run src/lib/translations.test.ts src/lib/nameStyle.test.ts src/lib/levelUtils.test.ts
npm run test:e2e
LC_ALL=C.UTF-8 grep -rnP "[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]" src --include=*.tsx --include=*.ts --exclude=*.test.ts | grep -v "src/lib/translations.ts" | grep -v "AuthModal.tsx\|InstallGate.tsx\|LanguageSelector.tsx"
#   → only endonyms (Magyarország) remain
grep -rn "\.replace('text-'\|\.replace('/20'\|replace('helyet'" src   # → no output
grep -rn "customNameFont ||\|customNameFont}" src/components          # → no output (all via resolveNameFontClass)
grep -rn "|| '" src/components/FeedbackPanel.tsx src/components/MapThemeSwitcher.tsx   # → no t(...) || 'literal' fallbacks
```
Manual:
- Switch to en and de and open the profile at levels 1, 3 and 5 (emulator seed users). Level names, perks and customization UI are translated. The level-1 badge has its grey pill. The selected colour tile is tinted.
- Seed a legacy review with `customNameFont: 'fixed inset-0 z-[9999] bg-black'`: the review renders normally.

## Rollback
`git revert` the commit. No data or deploy implications.

## Stop and ask Paul if…
- The T09 allowlist (`functions/src/lib/levels.ts` `NAME_COLORS`/`NAME_FONTS`, with its parity test against `levelUtils`) no longer equals the keys above. The parity test must stay green. If `CUSTOM_NAME_COLORS`/`CUSTOM_NAME_FONTS` change shape here, update the parity test's mapping, not the value lists.
- Paul wants aria-labels and alt texts translated now.
- An English or German translation above is unacceptable. Wording is Paul's call; do not guess alternatives.
