# @stamhoofd/criminal-record-check

Checking an extract from the Belgian criminal record (`uittreksel uit het strafregister`, model
596.2): is it a genuine document of FOD Justitie, and does it say what it has to say?

- `src/server` is server-only. It verifies the signature with
  [`@stamhoofd/pdf-signature`](../pdf-signature/README.md), then parses the pdf with `unpdf` and runs
  the checks on the content. The bytes are untrusted input, so parsing runs with limits on file size,
  page count and wall-clock time, and the text is only ever compared as plain text.
- **The content is only read when the signature holds.** A document we cannot place is not worth
  reading, so its content checks come back as `NotStarted` and the delivery is rejected on the
  signature alone.
- `src/testing` builds a minimal pdf with a text layer, so the content checks can be exercised
  without a real extract (there is no realistic non-blank one, and signing one would need the private
  key of FOD Justitie). `checkCriminalRecordExtractContent` takes the signature result as an
  argument, which is what lets those tests run — and what the QR-code route will use, where the
  document is authentic because we downloaded it at FOD Justitie ourselves.
