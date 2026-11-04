# @stamhoofd/pdf-verify

Backend side of verifying a signed pdf: wraps
[`@stamhoofd/pdf-verify-core`](../../../shared/pdf-verify-core/README.md), which holds the part that
also runs in the browser, and adds the step that cannot live there — the revocation lookup.

```ts
import { verifyPdfFromFodJustitie } from '@stamhoofd/pdf-verify';

// Resolves when the signature is valid and nothing in its chain is revoked, throws a SimpleError otherwise.
await verifyPdfFromFodJustitie(bytes, 31);
```

For another signer, `verifyPdf(bytes, policy, maximumAgeInDays)` takes a `PdfSignaturePolicy` of the
core package: the signer to accept, its pinned trust anchor and intermediates, and a file size cap.

## Revocation

For every certificate from the signer up to the trust anchor: **OCSP first, the revocation list as
fallback**. OCSP answers about one certificate and is cheap; the list is one file for the whole
authority, but it is signed, cacheable, and keeps working when the responder does not.

- **Nothing is believed unverified.** A response has to be signed by the issuer, or by a responder it
  delegated, and has to be about the certificate we asked for. A list has to carry the issuer's
  signature and still be current. Anything else leaves the status unestablished.
- **One revoked certificate is enough**, wherever in the chain it sits. The anchor itself is not
  looked up: it is pinned by the hash of its public key, which says more than its own authority
  could.
- **A status that could not be established rejects the file too** (`revocation_unavailable`), since
  the alternative is accepting a signature we did not finish checking.
- **The lists are cached** until their own `nextUpdate`, capped at a day, shared across requests, one
  fetch per url at a time, and never cached unless they verify.
- **The urls come out of certificates**, so they are treated as input even though the chain is
  pinned: http and https only, never a host given as an ip address, no redirects, a short timeout and
  a cap on what is read.

## Tests

`stam test pdf-verify`. The suite builds its own certificates, OCSP responses and revocation lists,
and answers requests out of a stub, so no test touches the network.
