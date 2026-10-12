# Manual encoding in Stamhoofd

Use AutoEncoder for ordinary structures. When a protocol, representation, or trust boundary needs custom behavior, implement `Encodeable` and a static decoder yourself. See the [library guide](https://github.com/SimonBackx/simple-encoding/blob/master/docs/manual-encoding.md) for the interfaces and a standalone example.

The application-specific examples are best read in their implementations:

- [Token](../../shared/structures/src/Token.ts): OAuth2 snake_case keys and `token_type: 'bearer'`; relative expiration in seconds becomes an absolute `Date`. The absolute `expires_on` extension is also in seconds and is converted to milliseconds for `Date`. Refresh token expiration follows the same convention.
- [TranslatedString](../../shared/structures/src/TranslatedString.ts): accepts untranslated strings and language maps, retaining compatibility with existing stored text. Its field helper also defines the upgrade/downgrade and patch conversions for an existing string field.
- [File](../../shared/structures/src/files/File.ts): decoding depends on the medium and signing configuration. Database signed URLs are discarded; a private network file's signature is required when signing is enabled. `withSignedUrl` verifies the signature asynchronously before requesting a URL. Merely decoding a file does not establish trust. URL validation also runs on encoding and decoding.

Do not copy these implementations into new structures: link to them for the current protocol and security contracts. A manual implementation must handle its own version compatibility and implement patching explicitly if needed.
