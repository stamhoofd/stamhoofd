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

## Stored text: `TranslatedString`

`$t` resolves to the language of the current request or user. That is right for text that is rendered on the spot, and wrong for text that is **stored** and read later by someone else: a group name, an event name, the name of a balance item. Store those as a `TranslatedString` (`@stamhoofd/structures`), which holds either one plain string or a map of languages and resolves with `toString()` in the reader's language.

**Declaring a field**

```typescript
@field(TranslatedString.field({ version: 426 }))
name = new TranslatedString();
```

- A translated text is never `null`; an empty `TranslatedString` means "no text". `TranslatedString.field` maps a `null` string or `null` patch from an older client to an empty value.
- `TranslatedString.field` works for new fields and for turning an existing `string` field into a translatable one: it keeps old clients working through upgrade/downgrade hooks (they keep sending and receiving a plain string in their language).
- Converting an existing field is a change to an existing property, so it needs an explicit version and a manual bump of `Version.ts` (see [Versioning data](https://github.com/SimonBackx/simple-encoding/blob/master/docs/versioning.md)). `...NextVersion` is for new fields only.
- Backend models store it in a `json` column with `TranslatedStringDecoder`. Filter and sort on such a column through `SQLTranslatedString(SQL.column(...), '$.value')`, which compares in the current language. A `varchar` column needs a migration to `json`, see the `events` and `balance_items` migrations for the pattern.
- In the frontend, edit it with `TInput` or `TTextarea` instead of a plain `<input>`.

**Creating a value**

| The text is | Use |
|---|---|
| Already in one language only (a webshop name, text an admin typed, a member name) | `TranslatedString.create(text)` |
| Already translated (a group name) | pass it on as it is |
| Produced by the backend from a translation key | `I18n.translateAll(key, replacements)` from `@stamhoofd/backend-i18n` |
| Built in code per language (dates, concatenations with `$t`) | `I18n.mapLanguages(() => ...)` |

`I18n.translateAll` and `I18n.mapLanguages` fill **every platform language** (`STAMHOOFD.locales`), so the reader sees their own language regardless of who created the value. They run the builder inside `I18n.runWithLocale`, so `$t`, `$getLanguage` and `Formatter` dates inside it resolve per language, also in crons without a request context. A `TranslatedString` passed as replacement is inserted in the matching language.

```typescript
// Wrong: frozen in the language of the request
balanceItem.name = TranslatedString.create($t('%Ot'));

// Right: every platform language
balanceItem.name = I18n.translateAll('%Ot');
balanceItem.name = I18n.translateAll('%1Mt', { name: member.name, group: group.settings.name });
balanceItem.name = I18n.mapLanguages(() => $t('%1cJ', { date: Formatter.date(day, true) }));
```

The builder of `I18n.mapLanguages` must be synchronous: the language override only applies for the duration of the call.

---

## Advanced

The \$t method will work normally in all places. In some very specific cases we’ve added wrappers to make sure they also work in unit tests. If you ever get errors, please ask Simon Backx

For questions about the automatic translations, ask Bjarne
