# i18n Replace Text

This module searches and translates untranslated text in Vue templates.

## Cli arguments
- `--dry-run`: if true the files will not be written
- `--prompt`: if true the cli will ask to verify every translation
- `--fix`: if true the written files will be fixed with eslint
- `--changes` if true only the changed lines will be translated
- `--compare <commitId1> <commmitId2>`: specify the git commits to compare
- `--attribute-white-list <jsonStringArray>`: specify the attribute names to whitelist, for example: '["title", "placeholder"]'

# i18n Auto Translate

This module finds missing translations and translates them with an ai api.

## Cli arguments
- `--fake`: add fake translations without calling the api (for testing)
- `--translator`: the translator to use, options: GoogleGemini, MistralLarge, MistralSmall, OpenAi or Claude

## Environment variables
- `I18NUUID_ROOT`: the path to the root of the project
- `I18NUUID_LOCALES_DIR`: the path to the directory containing the translations
- `I18NUUID_LOCALES_DIR_DIST`: the path to the directory containing the built translations
- `DEFAULT_LOCALE`: default locale, for example nl-BE
- `DEFAULT_COUNTRY`: default country, for example BE
- `I18NUUID_EXCLUDE_DIRS_ARRAY`: directories to exclude seperated by a comma, for example: dist,esm,node_modules
- `DEFAULT_LOCALES`: an object with the configuration for the default locales. Each key is a language. Each value is another object with the optional key `countries` and the key `default`. Countries is an object where the keys are country codes and the values are an array of country codes. The key is the default country for the countries in the array. The value for default is the default country for all other countries that are not configured. For example: `'{"es":{"countries":{"CO":["CO"]},"default":"ES"},"en":{"default":"GB"},"nl":{"default":"BE"}}'`
- `TRANSLATOR`:` the default translator (same options as the --translator cli argument)
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `MISTRAL_API_KEY`
