# @stamhoofd/judicial-record-check

What we can establish about a delivered extract from the judicial record (`uittreksel uit het
strafregister`) without a human looking at it. Runs in the frontend and in the backend: it reads the
file and nothing else.

```ts
import { checkJudicialRecord } from '@stamhoofd/judicial-record-check';

const { report, certificatePath } = await checkJudicialRecord({
    data: pdfBytes,
    firstName: 'Jan',
    lastName: 'Janssens',
    birthDay: new Date('2006-04-05'),
    maxAgeInDays: 31,
});

report.isPassed; // every check has a result and that result passed
```

Nothing is stored and nothing is read from a database: the same document delivered twice gives the
same answer, and a reviewer opening one later has it checked again rather than shown a stored
verdict. Who may deliver an extract for which member, and what happens with the outcome, belongs to
the service on top of this.

## The five checks

Each answers passed, failed or pending, with a sentence saying why. Three states, not two: a check
without a verdict is not a check that failed, and reporting the four content checks as failures
because a signature did not hold would say four things are wrong with a document when only one is.
Nothing is approved on a pending check, so the distinction costs no safety.

1. **Authentic** — [`@stamhoofd/signed-pdf`](../signed-pdf/README.md): which bytes the signature
   covers, the signature itself, the pinned signer and the certificate chain. It answers with the
   moment the signature says it was made, which the dates below are judged against. A refusal
   because an authority did not answer us is pending rather than failed: nothing is wrong with the
   document, and trying again later can still give it a verdict.
2. **Identity** — the name and birth date printed on the extract are the member's. An extract prints
   every given name its holder has, where a member record usually holds the one they go by, so the
   names we have must all be on the document and the document may hold more. Accents, capitals and
   punctuation are how a name is written, not which name it is. The reason names the member we
   expected, never the name we found: an extract that is not theirs is someone else's.
3. **Model** — the purpose has to *start* with `596.2`, the model for activities with minors. Not
   merely mention it: the number turns up in the boilerplate of other models, so a 596.1 extract can
   name it while being another document.
4. **Age** — no older than `maxAgeInDays`, **and** drawn up the day it was signed. Those belong
   together. The date in the header is printed text and says nothing by itself; the signing time
   comes out of the signature. Requiring them to be the same day is what lets the printed date be
   read as the day the extract was drawn up. **This is the only place the limit is applied.**
   `@stamhoofd/signed-pdf` hands back the signing time and judges no age of its own, deliberately:
   the limit differs per caller, and one rule in two places is one rule too many.
5. **Blank** — the extract states its own blankness as a heading with a date beside it, and that
   date is when the register was established to be blank. An extract drawn up today that was blank a
   month ago says nothing about today, so that date has to be the day of the document. It is
   compared against the signing time, which check 4 already ties the header date to: with both
   passed, all three dates are one day.

The signature comes first because it is what makes the text worth reading — a file we cannot place
could say anything — so the content is only parsed once it holds. A document whose text we cannot
read at all (a scan, a photo saved as a pdf) leaves checks 2 to 5 pending with the message
[`@stamhoofd/pdf-parse`](../pdf-parse/README.md) gives for it, which says what to do about it.

## Revocation is the caller's

There is no revocation lookup here, because this package also runs in a browser: it would mean
talking to the authorities that issued the certificates. The validated chain is answered as
`certificatePath` instead, so a caller that can do the lookup runs it over those certificates and
folds the outcome into the Authentic check. It is null when that check did not pass — there is then
no chain we established anything about.

## Reasons are sentences, not codes

Both packages underneath already answer with a message meant for whoever uploaded the file: which
step of the signature refused it, which limit a pdf did not fit. Reducing those dozens of outcomes
to a handful of codes to re-word them in the frontend would throw away the part that tells someone
what to do about it. They are rendered in the language of the request, so they are written on the
way out and not meant to be stored and shown again later.

## What is specific to FOD Justitie

`JudicialRecordExtract.ts`: the labels its fields are printed behind, the blank marker, and the
model we accept. How a line has to be taken apart to find a value is `@stamhoofd/pdf-parse`'s; the
signature goes through `@stamhoofd/signed-pdf`. Neither package knows what a judicial record is.

Every field takes a list of accepted spellings, so another wording — a second Dutch variant, or the
French and German equivalents — can be appended without touching the checks. There is no language
detection: a field either resolves or it is null, and the check that needs it then fails with its
own reason.

## Tests

`stam test judicial-record-check`. The content checks run over the values of a document, so they need
no pdf. The happy path of `checkJudicialRecord` itself cannot run here: it needs a pdf signed by FOD
Justitie, and a real extract holds someone's name, birth date and address, so one is never
committed.
