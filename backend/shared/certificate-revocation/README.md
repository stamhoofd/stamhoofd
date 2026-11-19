# @stamhoofd/certificate-revocation

Asks the authorities behind a validated certificate path whether anything in it has been revoked. It
is the step a signature check cannot do on its own: a signature stays mathematically valid long after
the key behind it was withdrawn.

```ts
import { assertChainNotRevoked } from '@stamhoofd/certificate-revocation';

// Resolves when nothing in the path is revoked, throws a SimpleError otherwise.
await assertChainNotRevoked(certificatePath);
```

`certificatePath` is the path a signature check answered with: the signer first, the pinned trust
anchor last. Every certificate is checked against the next one as its issuer.

## How it is checked

For every certificate from the signer up to the trust anchor: **OCSP first, the revocation list as
fallback**. OCSP answers about one certificate and is cheap; the list is one file for the whole
authority, but it is signed, cacheable, and keeps working when the responder does not.

- **Nothing is believed unverified.** A response has to be signed by the issuer, or by a responder it
  delegated, and has to be about the certificate we asked for. A list has to carry the issuer's
  signature. Anything else leaves the status unestablished.
- **Nothing is believed stale either.** A `good` from before a revocation is the one answer that must
  not outlive it, so a response or list dated after us, or past its own `nextUpdate`, says nothing —
  and one that names no `nextUpdate` is believed for a day. Every request carries a nonce, and a
  responder that echoes one has to echo ours.
- **The path has to be the one the signature was validated against.** The certificate set of a
  signature container is not covered by its signature, so picking a path back out of it by name would
  not be reading the path that was validated. That is why this takes the path rather than a container.
- **One revoked certificate is enough**, wherever in the path it sits. The anchor itself is not
  looked up: it is pinned by the hash of its public key, which says more than its own authority
  could.
- **A status that could not be established rejects the file too** (`revocation_unavailable`), since
  the alternative is accepting a signature we did not finish checking. It is a 500: nothing is wrong
  with what was uploaded, an authority did not answer us.
- **The lists are cached** until their own `nextUpdate`, capped at a day from the moment they were
  fetched, shared across requests, one fetch per url at a time, and never cached unless they verify.
- **The urls come out of certificates**, so they are treated as input even though the path is
  pinned: http and https only, never an address or a name of our own network, no redirects, a short
  timeout and a cap on what is read.

Neither error names the signer: this package is handed a path and knows nothing about who signed with
it. A caller that does can say so itself.

## Tests

`stam test certificate-revocation`. The suite builds its own certificates, OCSP responses and
revocation lists, and answers requests out of a stub, so no test touches the network.

The internal functions take that stub client, `assertChainNotRevoked` does not: the public entry
point has nothing in it that only a test uses. What it is tested over instead is a path whose
certificates name nowhere to ask, which never reaches the network because there is nothing to call.
