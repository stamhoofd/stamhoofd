# @stamhoofd/pdf-verify

Backend side of verifying a signed pdf: wraps
[`@stamhoofd/pdf-verify-core`](../../../shared/pdf-verify-core/README.md), which holds the part that
also runs in the browser, and adds the step that cannot live there — the revocation lookup.

```ts
import { verifyPdfFromFodJustitie } from '@stamhoofd/pdf-verify';

// Resolves when the signature is valid and nothing in its chain is revoked, throws a SimpleError otherwise.
const signedAt = await verifyPdfFromFodJustitie(bytes, 31);
```

`signedAt` is the moment the signature says it was made. It is one of the signed attributes, so it
comes out of the signature rather than off the document, which is what makes it the date worth
storing next to an accepted file.

For another signer, `verifyPdf(bytes, policy, maximumAgeInDays)` takes a `PdfSignaturePolicy` of the
core package: the signer to accept, its pinned trust anchor and intermediates, and a file size cap.

## Revocation

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
- **The chain comes from the signature check**, which answers with the path it validated. The
  certificate set of a container is not covered by its signature, so picking a chain back out of it
  by name would not be reading the chain that was validated.
- **One revoked certificate is enough**, wherever in the chain it sits. The anchor itself is not
  looked up: it is pinned by the hash of its public key, which says more than its own authority
  could.
- **A status that could not be established rejects the file too** (`revocation_unavailable`), since
  the alternative is accepting a signature we did not finish checking. It is a 500: nothing is wrong
  with what was uploaded, an authority did not answer us.
- **The lists are cached** until their own `nextUpdate`, capped at a day from the moment they were
  fetched, shared across requests, one fetch per url at a time, and never cached unless they verify.
- **The urls come out of certificates**, so they are treated as input even though the chain is
  pinned: http and https only, never an address or a name of our own network, no redirects, a short
  timeout and a cap on what is read.

## Tests

`stam test pdf-verify`. The suite builds its own certificates, signed pdfs, OCSP responses and
revocation lists, and answers requests out of a stub, so no test touches the network. The signed pdfs
come from `@stamhoofd/pdf-verify-core/testing/SignedPdfBuilder.js`: a real extract holds someone's
name, birth date and address, so one is never committed here.
