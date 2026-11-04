# @stamhoofd/pdf-parse

Reads the text of a pdf, in reading order. Backend only: it uses
[`unpdf`](https://github.com/unjs/unpdf), which wraps pdf.js.

```ts
import { extractPdfLines, readLabelledValue } from '@stamhoofd/pdf-parse';

const lines = await extractPdfLines(bytes);
const name = readLabelledValue(lines, ['Naam', 'Familienaam']);
```

- pdf.js emits text items in generator order, not in reading order, so a label and its value can
  arrive in either sequence. Items are grouped per page on their baseline `y` and sorted by `x`, so
  the caller can match on whole lines.
- The bytes are untrusted input, so parsing runs with limits of its own on file size, page count and
  wall-clock time. They are fixed here: a pdf that does not fit them is not a document we read.
- Failures are a `SimpleError` with a `human` message that says what to do about it, so a caller can
  pass it straight on to whoever uploaded the file: `invalid_pdf` for a file that is not a readable
  pdf, `pdf_without_text` for one without a text layer, `pdf_too_large` and `pdf_too_many_pages` for
  a document beyond the limits, and `pdf_parse_timeout` for one that would not finish.

Reading specific text back out of those lines is the other half: `readLabelledValue` for a field
written as `Label: value` on its own line, `readInlineLabelledValue` for a label that sits inside a
longer line next to other fields, `readValueOnNextLine` for one printed below its label, and
`containsText` for a marker that is either there or not. Each takes a list of accepted spellings, so
another wording can be appended without touching the matching. Which labels a document prints its
fields behind stays with the caller: this package extracts, it does not interpret.

`src/testing` builds a minimal pdf with a text layer at the positions you give it, for tests of
whatever reads those lines.

## Tests

`stam test pdf-parse`.
