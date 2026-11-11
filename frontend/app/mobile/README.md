###

Android debug SHA256 fingerprints can be found:

On MacOS without JDK:
`/Applications/Android\ Studio.app/Contents/jre/jdk/Contents/Home/bin/keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`

Other:
`keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`

For production, always use the SHA-256 from the play console (because we use Play App signing), which is:
`A0:7B:07:40:BD:36:D6:07:29:C5:E4:5C:06:68:C6:CE:4B:B0:F6:F8:CD:B3:51:FC:1E:CF:06:78:AF:7C:2C:75`

## Updating native dependencies

Change dependency versions and run `pnpm install` from the repository root. The root postinstall hook detects changes to installed Capacitor runtimes, native plugins, their resolved paths, and the Capacitor configuration. When a refresh is needed, it requires macOS with full Xcode selected, runs `cap update`, and resolves the iOS Swift packages with `xcodebuild`. No frontend build is needed. Errors fail the install; npm dependency changes are not rolled back.

Commit the npm manifests and lockfile, generated Android/iOS changes (including `Package.resolved`), and `native-dependencies.json` together. The latter records the installed native dependencies and generated-file hashes only after a successful refresh. Do not edit it or the generated native dependency paths manually. A missing record requires an initial refresh on macOS.

Unchanged installs work on Linux. Native dependency upgrades on Linux fail with instructions to finish on macOS. The workspace disables `optimisticRepeatInstall` so pnpm runs the postinstall check even on an already-up-to-date installation.

CI also runs the read-only check below, including when install lifecycle scripts are disabled:

```bash
node frontend/app/mobile/scripts/update-native-dependencies.mjs --check
```

App builds still require building the frontend and running `pnpm run sync` from this directory to copy web assets. If that changes the tracked native manifests, run `pnpm install` again before committing.
