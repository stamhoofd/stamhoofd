# Translations

Wrap new user-facing text in `$t(...)` with Dutch source text, including interpolation:

```ts
$t('Welkom {firstName},', { firstName: user.firstName });
```

Commit these strings unchanged. Before release, the translation workflow replaces them with `%`-prefixed keys and translates the strings. Do not generate keys during ordinary development or edit `shared/locales/src/nl.json`: replace an existing `$t('%…')` call with new Dutch source text when changing its wording. Look up existing keys in that file.

Use English plain text for `SimpleError.message`, and translated Dutch text for `SimpleError.human`. Code comments and test names remain English.

## Editor and tests

Install the recommended VS Code **i18n Ally** extension. The repository's [editor settings](../../.vscode/settings.json) configure the language and locale paths; build locale output through the normal shared build when it is missing.

The [global declarations](../../shared/types/src/global.ts) provide types, not runtime initialization. Tests must use their package's existing translation setup/wrappers; a missing `$t` at runtime is not a reason to replace translations with hard-coded text. Ask the repository maintainers when the existing test setup or translation automation is unclear.

The release workflow is described by the [translation command](../../shared/cli/src/commands/translate/index.ts).
