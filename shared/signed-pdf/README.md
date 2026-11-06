# PDF signatures

Verifies that a PDF was digitally signed by a pinned signer and has not been modified since. Uses
WebCrypto only, so the same code can run in the browser and the backend.

```ts
import { verifyPdfFromFodJustitie, verifyPdfSignature, FOD_JUSTITIE_SIGNATURE_POLICY } from '@stamhoofd/signed-pdf';

// Resolves when the signature is valid, throws a SimpleError otherwise.
const { signedAt, certificatePath } = await verifyPdfFromFodJustitie(bytes, 90);

// The same thing, for a signer this package does not pin a shorthand for.
const verified = await verifyPdfSignature(bytes, FOD_JUSTITIE_SIGNATURE_POLICY, 90);
```

- `bytes`: the PDF as a `Uint8Array`.
- `policy`: the signer to accept, its pinned trust anchor and intermediates, and a file size cap. See
  `PdfSignaturePolicy`. `FOD_JUSTITIE_SIGNATURE_POLICY` (Belgian *uittreksel uit het strafregister*)
  is the only one so far, and `verifyPdfFromFodJustitie` is the shorthand that pins it.
- `maxAgeInDays`: how long ago the document may have been signed. This depends on the use, so it
  is a parameter rather than part of the policy.

It answers with `signedAt`, the signing time the signature itself carries — signed along with the
document, so it is not a date read off the pdf — and `certificatePath`, the chain that validated,
from the signer up to the pinned anchor.

## Limitations

No revocation check (OCSP/CRL) and no reading of the document's content. Revocation is a network
lookup, so it never lands here: this package runs in the browser. Do it server side in the package
that wraps this one, over the `certificatePath` this answers with (the backend should run this step
again as well!)

`maximumFileSize` is verified when the bytes are already in memory, so protect uploads before calling `verifyPdfSignature`.

## Tests

`stam test signed-pdf`. The suite generates its own certificates and signed PDFs, through
`src/testing/SignedPdfBuilder.ts` — in `src` rather than beside the tests because the package that
wraps this one builds the same pdfs to test the revocation lookup it adds.
