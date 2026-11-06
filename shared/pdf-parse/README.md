# @stamhoofd/pdf-parse

Reads the text of a pdf, in reading order, on [pdf.js](https://mozilla.github.io/pdf.js/)
(`pdfjs-dist`). Frontend and backend both: `import { extractPdfLines } from '@stamhoofd/pdf-parse'`
is the whole setup - no worker file to copy, no bundler configuration, no asset url. See
[pdf.js](#pdfjs) for which build that is and what it costs.

```ts
import { extractPdfLines, parsePrintedDate, readInlineLabelledValue, readLabelledValue, readMarkerDate, readValueOnNextLine } from '@stamhoofd/pdf-parse';

const lines = await extractPdfLines(bytes);

// Naam :            JANSSENS
const name = readLabelledValue(lines, ['Naam', 'Familienaam']);

// Ref. doc : 20261102-5351 - Datum : 02/11/2026 Betreft : JANSSENS JAN - 05/04/2006 1 / 1
// -> a field of that line ends where the next one begins, so this is '02/11/2026'
const printedOn = parsePrintedDate(readInlineLabelledValue(lines, ['Datum']));

// Finaliteit van het uittreksel :
// 596.2 - model bestemd voor de contacten met minderjarigen
const purpose = readValueOnNextLine(lines, ['Finaliteit van het uittreksel']);

// BLANCO STRAFREGISTER (02/11/2026)
const blancoOn = readMarkerDate(lines, ['BLANCO STRAFREGISTER']);
```

- pdf.js emits text items in generator order, not in reading order, so a label and its value can
  arrive in either sequence. Items are grouped per page on their baseline `y` and sorted by `x`, so
  the caller can match on whole lines.
- The bytes are untrusted input, so parsing runs with limits of its own on file size and page count.
  They are fixed here: a pdf that does not fit them is not a document we read. There is no time limit
  on top of those two, because there could not be a useful one: pdf.js runs on this thread, so a
  parse holds the event loop and a timer set against it only fires once that parse is already done.
- Failures are a `SimpleError` with a `human` message that says what to do about it, so a caller can
  pass it straight on to whoever uploaded the file: `invalid_pdf` for a file that is not a readable
  pdf, `pdf_without_text` for one without a text layer, and `pdf_too_large` and `pdf_too_many_pages`
  for a document beyond the limits.

Reading specific text back out of those lines is the other half: `readLabelledValue` for a field
written as `Label: value` on its own line, `readInlineLabelledValue` for a label that sits inside a
longer line next to other fields - ending where the next field of that line begins -
`readValueOnNextLine` for one printed below its label, and `readMarkerDate` for a statement the
document makes about itself. Each takes a list of accepted spellings, so another wording can be
appended without touching the matching. Which labels a document prints its fields behind stays with
the caller: this package extracts, it does not interpret.

Every one of them wants the colon the document prints after its label, which is also what keeps a
label from resolving against a longer word: `Datum` does not answer for `Geboortedatum`, nor
`Finaliteit` for `Finaliteitscode`.

All of them match the same way: ignoring case and how the words are spaced, but with the accents the
document prints - these extracts are issued in French and German too. A spelling that differs in its
accents is another spelling, so it goes in the list, which is what the list is for. A value comes
back with its own accents untouched.

`readMarkerDate` asks for more than the words being somewhere on the page. A document that states
something about itself prints that statement as a heading of its own, with the date it was
established beside it, so the marker has to open its line and the date has to close it: the same
words inside a paragraph that merely mentions them do not answer. It returns that date rather than a
boolean, because the date is what a caller weighs against the dates it has from elsewhere - the
moment the pdf was signed, the date in its header - before taking the marker for an answer.
`parsePrintedDate` reads those other dates the same way, day first.

`tests/helpers` builds a minimal pdf with a text layer at the positions you give it, so the tests
here can read a real pdf rather than a list of lines. It stays with the tests: it is not something
this package offers its callers, and nothing outside needs it.

## pdf.js

`pdfjs-dist` is pinned to an exact version, `6.4.299`. pdf.js ships no stable api contract between
minor versions and the two things this package leans on - the shape of a text item and how the
worker is found - have both changed inside a minor before, so a range here would be a parser that
breaks on an install rather than on a commit.

Of the two builds in the package, this uses `legacy/`. The default `build/` targets current browsers
only, and the app ships into whatever WebView the device happens to have; `legacy/` is the same code
transpiled down, with the core-js polyfills that go with it, and it is also the build pdf.js
documents for Node. That makes one build for all three environments rather than one per environment.

The parse runs on the calling thread. Left to itself pdf.js reaches for
`GlobalWorkerOptions.workerSrc` - a url it either spawns a `Worker` from or imports dynamically -
and that url is something every consumer would have to produce for its own bundler, with no good
answer at all inside a Capacitor WebView. `createMainThreadWorker` sidesteps it by building both
ends of a `MessageChannel` here and setting pdf.js's own `WorkerMessageHandler` up on one of them,
so pdf.js drives a worker that happens to live on this thread and nothing in the setup depends on
an origin, a public path or a bundler plugin. Reading a one-page extract takes about 25 ms, which is
not work worth a thread, and in Node pdf.js stays on the calling thread regardless.

The important part is that it is a worker **per document**. Loading `pdf.worker.mjs` announces its
handler on `globalThis`, and pdf.js consults that global for every document *anyone* opens - so
simply importing this package would have taken a pdf viewer in the same bundle off its worker and
put its rendering on the main thread, silently. `src/pdfjs.ts` therefore puts the global back down
after the import and passes a worker to `getDocument` instead. A consumer that renders pdfs keeps
its own real worker, and `tests/pdfjs.test.ts` holds that line.

One more thing a consumer should know:

- It is large. In a production Vite build, pdf.js and its worker together are about 1.8 MB
  minified, 550 kB gzipped, and tree shaking does not help: the worker is one bundle by
  construction. Import this package from a route or a view that is already code split, and if a
  second package in the app also needs pdf.js, the two should share one copy rather than each
  depend on `pdfjs-dist` on its own.

## Tests

`stam test pdf-parse`.
