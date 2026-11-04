# PDF signatures

Verifies that a PDF was digitally signed by a pinned signer and has not been modified since. Uses
WebCrypto only, so the same code can run in the browser and the backend.

```ts
import { verifyPdfSignature, FOD_JUSTITIE_SIGNATURE_POLICY } from '@stamhoofd/pdf-signature';

// Resolves when the signature is valid, throws a SimpleError otherwise.
await verifyPdfSignature(bytes, FOD_JUSTITIE_SIGNATURE_POLICY, 90);
```

- `bytes`: the PDF as a `Uint8Array`.
- `policy`: the signer to accept, its pinned trust anchor and intermediates, and a file size cap. See
  `PdfSignaturePolicy`. `FOD_JUSTITIE_SIGNATURE_POLICY` (Belgian *uittreksel uit het strafregister*)
  is the only one so far.
- `maximumAgeInDays`: how long ago the document may have been signed. This depends on the use, so it
  is a parameter rather than part of the policy.

## Limitations

No revocation check (OCSP/CRL) and no reading of the document's content. Do these server side outside this package, the server can use this package as the first step (backend should run this step again!)

`maximumFileSize` is verified when the bytes are already in memory, so protect uploads before calling `verifyPdfSignature`.

## Tests

`stam test pdf-signature`. The suite generates its own certificates and signed PDFs.
