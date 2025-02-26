# i18n Replace Text

This module searches and translates untranslated text in Vue templates.

## Cli arguments
- `--dry-run`: if true the files will not be written
- `--prompt`: if true the cli will ask to verify every translation
- `--fix`: if true the written files will be fixed with eslint
- `--changes` if true only the changed lines will be translated
- `--compare <commitId1> <commmitId2>`: specify the git commits to compare
- `--attribute-white-list <jsonStringArray>`: specify the attribute names to whitelist, for example: '["title", "placeholder"]'
