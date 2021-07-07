
###

Android debug SHA256 fingerprints can be found:

On MacOS without JDK:
`/Applications/Android\ Studio.app/Contents/jre/jdk/Contents/Home/bin/keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`

Other:
`keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`

For production, always use the SHA-256 from the play console (because we use Play App signing), which is:
`A0:7B:07:40:BD:36:D6:07:29:C5:E4:5C:06:68:C6:CE:4B:B0:F6:F8:CD:B3:51:FC:1E:CF:06:78:AF:7C:2C:75`