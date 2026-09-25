# T24 — A single `useT()` translation hook

**Phase:** 5 · **Depends on:** T23 · **Risk:** low · **Decisions:** —
**Audit refs:** ARCH-04

## Goal
Replace the five translation mechanisms with one: a typed `useT()` hook for React code and a pure `translate(lang, key, vars?)` for non-React code. All inline text objects and ternaries move into `src/lib/translations.ts`. Visible text in every language stays identical, including the current fallback behaviour when no language has been chosen yet.

## Context
Line numbers are from `eee5668`; re-locate by landmark.

The five mechanisms today:
1. **Store `t`**: `useLanguageStore.ts` `t` (currently at :20-23). It uses `language || 'hu'` and returns the key when missing. Used by most components via `const { t } = useLanguageStore()`.
2. **Direct `translations[...]` access:**
   - `SettingsPanel.tsx` (`const t = translations[language] || translations.hu`, currently at :36; plus `newT` in `handleLanguageChange` :105-112, which deliberately uses the **new** language for the toast).
   - `NotificationSettingsModal.tsx` (`translations[language || 'hu']`, :90).
   - `usePushNotifications.ts` (`translations[language || 'hu']`, :26).
3. **Inline text objects:**
   - `AuthModal.tsx` `texts` (hu/de/en, :29-132; selection `texts[language] || texts.en`, :134). Note the nested `errors.*`.
   - `InstallGate.tsx` `texts` (module level, :9-55; selection `|| texts.hu`, :98). Several values are JSX containing `<strong>` and `&quot;`.
4. **Ternaries:** `LanguageSelector.tsx` (:36-40). They are keyed on the **locally selected** language (`selectedLang`), not the store, with English when nothing is selected, so the title changes live as the user taps a language.
5. Hardcoded strings (removed by T22).

**Fallback differences.** These only matter while `language === null`, which is before the first choice in LanguageSelector (`hasSelectedLanguage === false`):

| Place | Fallback when `language` is null |
|---|---|
| store `t`, SettingsPanel, NotificationSettingsModal, usePushNotifications, InstallGate | `hu` |
| AuthModal | **`en`** |
| LanguageSelector | **`en`** (and it follows `selectedLang`, not the store) |

**Decision: preserve per-site fallbacks.** `useT()` defaults to `'hu'` (same as the store), and accepts `{ fallback: 'en' }`, which AuthModal uses. LanguageSelector uses `translate(selectedLang ?? 'en', key)`.

After T22, key parity across hu, en and de is enforced by `src/lib/translations.test.ts`, so the "missing key" behaviour no longer differs between mechanisms.

## Files
- Create: `src/hooks/useT.ts`, `src/lib/i18n.ts` (pure `translate`, `interpolate`, `splitBold`), `src/lib/i18n.test.ts`, `src/hooks/useT.test.tsx` (if T01 set up a jsdom environment; otherwise test through `translate`), and the e2e spec `e2e/i18n.spec.ts`.
- Modify: `src/lib/translations.ts`, `src/store/useLanguageStore.ts`, `src/components/AuthModal.tsx`, `src/components/InstallGate.tsx`, `src/components/LanguageSelector.tsx`, `src/components/SettingsPanel.tsx`, `src/components/NotificationSettingsModal.tsx`, `src/hooks/usePushNotifications.ts`, `src/store/useToastStore.ts`, and every component that calls `useLanguageStore().t` (mechanical).

## Steps
1. **`src/lib/i18n.ts`** (pure):
   - `export type Language = 'hu' | 'en' | 'de'`. Move the type out of the store, and re-export it from the store for compatibility.
   - `translate(lang: Language, key: TranslationKey, vars?: Record<string, string | number>): string`. It returns `translations[lang][key]`, and if that is missing, returns `key` (same as the store today). It then applies `interpolate`.
   - `interpolate(s, vars)` replaces each `{name}` with the value. Unknown placeholders stay as they are. It has the same semantics as today's `.replace('{x}', v)`, which only replaces the **first** occurrence, so check that no string contains a placeholder twice.
   - `splitBold(s): Array<{ text: string; bold: boolean }>` parses `**…**` markers. It is used to render `<strong>` without `innerHTML`.
2. **`src/hooks/useT.ts`**:
   ```ts
   export function useT(opts?: { fallback?: Language }) {
     const language = useLanguageStore((s) => s.language);
     const lang = language ?? opts?.fallback ?? 'hu';
     return useCallback((key: TranslationKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
   }
   ```
   It also exposes `useLanguage()`, returning `language ?? fallback`, for the date locale in SpotDetailsPanel (`getDateLocale`).
3. **Move inline texts into `translations.ts`**, in all three languages.
   - **Prefixes avoid collisions and value drift with existing keys:** `auth*` for AuthModal (`authWelcome`, `authWelcomeDesc`, `authSignIn`, `authSignUp`, `authSignInDesc`, `authSignUpDesc`, `authSigningIn`, `authGoogle`, `authOr`, `authWithEmail`, `authUsername`, `authEmail`, `authPassword`, `authUsernamePlaceholder`, `authEmailPlaceholder`, `authPasswordPlaceholder`, `authPasswordHint`, `authNoAccount`, `authHaveAccount`, `authBack`, `authTerms`, and `authErrGoogle` … `authErrSignUpFailed` for the 9 `errors.*`); `install*` for InstallGate; `langSelect*` for LanguageSelector (`langSelectTitle`, `langSelectDesc`, `langSelectContinue`).
   - Copy every value **verbatim** from today's objects. The three languages of AuthModal and InstallGate map to hu, en and de.
   - LanguageSelector's German strings use the formal "Sie" and the English strings its own wording; copy them exactly.
   - `googleWith: 'Google'` and `passwordPlaceholder: '••••••••'` are identical in every language; they still get keys, for uniformity.
4. **InstallGate rich text:**
   - Encode `<strong>X</strong>` as `**X**` in the translation string, with `&quot;` becoming a literal `"`. Example: `installIosStep2`: hu `Görgess le és válaszd a **"Főképernyőhöz adás"** opciót.`
   - Render `splitBold(t(key)).map((p, i) => p.bold ? <strong key={i}>{p.text}</strong> : <Fragment key={i}>{p.text}</Fragment>)`.
   - The resulting DOM (text nodes plus `<strong>`) must equal today's. Compare `innerHTML` of the `<ol>` before and after in an e2e or unit render test.
   - InstallGate uses `useT()` (fallback `'hu'`, as today).
5. **AuthModal:** `const t = useT({ fallback: 'en' })`. Replace `t.x` with `t('authX')` and `t.errors.y` with `t('authErrY')`. The signing-up label `t.signUp + '...'` becomes `` `${t('authSignUp')}...` ``, unchanged. The T22 hint key `usernameRules` also goes through this `t` (a behaviour change only when `language === null`; note it in the commit).
6. **LanguageSelector:** remove the unused `translations` import. `const lang = selectedLang ?? 'en'`, then `translate(lang, 'langSelectTitle')` and so on.
7. **SettingsPanel:** `const t = useT()`; `t.foo` becomes `t('foo')`. `handleLanguageChange` uses `translate(newLanguage, 'languageChanged', { language: langName })`, so the toast stays in the **new** language. Endonyms stay literal.
8. **NotificationSettingsModal and usePushNotifications:** replace the local `t` with `useT()`. In the hook, keep `useCallback` stability semantics (`useT` already memoizes).
9. **Non-React code** (`useToastStore`, anything else outside components): `translate(useLanguageStore.getState().language ?? 'hu', key)`.
10. **Mechanical migration:**
    - `const { t } = useLanguageStore()` becomes `const t = useT()` everywhere. Where the component also reads `language`, use `useLanguage()`.
    - Where `.replace('{x}', v)` is applied to a `t()` result, switch to `t(key, { x: v })`: ProfilePanel `confirmRemoveAdmin`, T22's new keys.
    - Remove `t` from `useLanguageStore` (the store keeps `language`, `setLanguage` and `hasSelectedLanguage`, with the persist name `spoton-language` unchanged).
11. **Tests:**
    - `i18n.test.ts`: `translate` works for every language and a missing key; `interpolate`; `splitBold` handles no markers, one, two, and markers at the start or end.
    - A test that every `auth*` and `install*` key exists in all three languages. The parity test covers this; add an explicit list assertion as well.
12. **E2E `i18n.spec.ts`:** run twice, with the `spoton-language` localStorage state set via `addInitScript` to `{"state":{"language":"hu","hasSelectedLanguage":true},"version":0}` and then `en`. Also set `spoton-install-prompt-dismissed=true`. Assert, per language:
    - The bottom-nav aria-label of the explore button (`Felfedezés` / `Explore`).
    - After clicking profile while signed out, the AuthModal title (`Üdvözöl a SpotOn` / `Welcome to SpotOn`) and the email button text (`Email címmel` / `With Email`).
    - The empty-state or other text the T04 seed makes visible.

    In a third case, clear the language state and assert that LanguageSelector shows `Select Language`, then after clicking Magyar shows `Válassz Nyelvet`.

## Must NOT change
- Every visible string in hu, en and de, including punctuation, emoji, `…`/`...` and the `&quot;` quotes.
- Fallback behaviour per site while `language === null` (table above).
- The persisted store shape and name (`spoton-language`: `language`, `hasSelectedLanguage`).
- SettingsPanel's language-changed toast language (the new language), and LanguageSelector following `selectedLang`.
- InstallGate DOM structure (including `<strong>` placement) and its `DISMISS_KEY`.

## Acceptance
```bash
npm run verify
npx vitest run src/lib/i18n.test.ts src/lib/translations.test.ts
npm run test:e2e                     # includes i18n.spec.ts (hu + en + first-visit selector)
grep -rn "translations\[" src | grep -v "src/lib/i18n.ts\|src/lib/translations"   # → none
grep -rn "const texts\b\|const texts =" src/components                             # → none
grep -rnE "selectedLang === '(hu|de)' \?" src/components                           # → none
grep -rnE "\{[^}]*\bt\b[^}]*\} = useLanguageStore" src                            # → none (no store t)
```

## Rollback
`git revert`. Users' persisted language is unaffected (same storage key and shape).

## Stop and ask Paul if…
- Paul prefers unifying the null-language fallback to `hu` everywhere (a small visible change for AuthModal and LanguageSelector on first visit).
- Any AuthModal or InstallGate value would need rewording to fit a shared key. Keep the prefixed keys; do not merge them with existing keys without approval.
