# @stamhoofd/criminal-record-check

Reading and checking an extract from the Belgian criminal record (`uittreksel uit het strafregister`,
model 596.2).

- `src/server` is server-only: it parses the pdf with `unpdf` and runs the checks of the automatic
  control on the result. The bytes are untrusted input, so parsing runs with limits on file size,
  page count and wall-clock time, and the text is only ever compared as plain text.
- `src/testing` builds a minimal pdf with a text layer, so the parser can be exercised without a
  real extract (there is no realistic non-blank one).
- The signature verification of FOD Justitie is passed in as a check result. It will live in this
  package as well, as a method shared with the browser pre-check, but it is not implemented yet: a
  document whose signature was not verified is never approved automatically, it goes to a reviewer.
