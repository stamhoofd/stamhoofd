# Translations

You can use `$t` anywhere in your code to translate text.

When adding new strings, simply wrap your text with it. We have automated scripts that will eventually replace your new strings with a unique id. And we’ll automatically translate it to all languages. This will happen before release, you shouldn’t do it manually locally (only on the main branch).

```typescript
$t('Hello world')
```

Will get replaced with

```typescript
$t('75189274-ceb4-40b5-9882-8dd4a7b2fceb')
```

To keep the translations readable, use a VSCode extension such as **`i18n-ally`** (this has been configured correctly for our code).

---

## Advanced

The \$t method will work normally in all places. In some very specific cases we’ve added wrappers to make sure they also work in unit tests. If you ever get errors, please ask Simon Backx

For questions about the automatic translations, ask Bjarne
