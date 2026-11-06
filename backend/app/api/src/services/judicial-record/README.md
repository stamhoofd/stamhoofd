# Judicial record service

Accepting a delivered extract from the judicial record (`uittreksel uit het strafregister`) for a
member.

```ts
import { JudicialRecordService } from '../services/judicial-record/JudicialRecordService.js';

const status = await JudicialRecordService.deliver({
    member,
    data: pdfBytes,
    maxAgeInDays: 30,
});

status; // JudicialRecordDeliveryStatus.AutoOk or .Manual
```

The five automatic checks themselves are
[`@stamhoofd/judicial-record-check`](../../../../../../shared/judicial-record-check/README.md), which
the frontend runs as well: authenticity, identity, model, age and blank, each with a sentence saying
why. What is left here is what only the backend can do.

Who may deliver an extract for which member, and what is done with the outcome, belongs to the
endpoint on top of this: `POST /members/:id/judicial-record`, in
[`DeliverMemberJudicialRecordEndpoint.ts`](../../endpoints/global/members/DeliverMemberJudicialRecordEndpoint.ts).
That endpoint is the final submit of the member portal flow: the browser already ran these same five
checks and showed the member what held, so the response is a `JudicialRecordDeliveryResponse` with
the status on it and not the checklist. It runs them again here because a request cannot prove the
browser did.

## 1. The member has to deliver an extract at all

`JudicialRecordHelper.getRequirement` over the responsibilities the member holds — the same rule the
member view shows, and the same one
[`judicialRecordStatus.ts`](../../helpers/judicialRecordStatus.ts) mirrors in SQL for the member
list. Derived rather than read from a column, so it stays correct when a responsibility changes its
minimum age. Not required is a simple error, and the document is not read at all.

No organization is passed in, and that is deliberate. Organizations define responsibilities with a
`judicialRecordMinimumAge` of their own next to the platform ones, and an extract is delivered from
the member portal, which on a platform is inside no organization at all. A single organization in
scope would therefore be null exactly where an organization-defined requirement has to be found, and
the member would be told they do not have to deliver while they do. So each responsibility record is
resolved against its own `organizationId` instead.

## 2. Revocation is the only thing that refuses a delivery

A validated certificate chain goes to
[`assertChainNotRevoked`](../../../../../shared/certificate-revocation/README.md), which asks the
issuing authorities whether anything in it has been revoked. That lookup is a network call to those
authorities, so it cannot live in code the browser runs — which is exactly why it is the one refusal
left here.

Everything else becomes `Manual`, **a failed signature check included**. Whoever delivered the
extract was shown every check before this step and chose to deliver anyway, so refusing it here
would refuse something they were already told about. An extract from another country, which our
checks cannot read, is the same case: a reviewer opens it.

## 3. The status

`AutoOk` when every check passed, `Manual` otherwise. There is no refused value in
`JudicialRecordDeliveryStatus`: a refusal is a thrown error, and only revocation throws one.

Nothing is stored — not the document and not the status. Storing either, and the reviewer who reads
them, arrives with the review flow.

## Tests

`stam test api -- judicial-record`. The check package and the revocation lookup are mocked: the
first has its own tests, the second talks to an authority, and a real signed extract holds someone's
name, birth date and address so one is never committed. What is tested here is the requirement, the
one refusal, and which status each outcome gets.
