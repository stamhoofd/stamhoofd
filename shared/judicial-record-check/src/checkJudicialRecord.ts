import { isSimpleError } from '@common/errors';
import { extractPdfLines } from '@stamhoofd/pdf-parse';
import { verifyPdfFromFodJustitie } from '@stamhoofd/signed-pdf';
import { JudicialRecordCheck, JudicialRecordCheckReport, JudicialRecordCheckResult, JudicialRecordCheckStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import type * as pkijs from 'pkijs';
import type { JudicialRecordExtract } from './JudicialRecordExtract.js';
import { JUDICIAL_RECORD_MODEL, readJudicialRecordExtract } from './JudicialRecordExtract.js';

const SIGNER_NAME = 'FOD Justitie';

/** Run on the text of the document, so only once the signature holds. */
const CONTENT_CHECKS = [JudicialRecordCheck.Model, JudicialRecordCheck.Identity, JudicialRecordCheck.Age, JudicialRecordCheck.EmptyRecord];

export interface JudicialRecordCheckRequest {
    /** The original pdf, exactly as it was received: untrusted input. */
    data: Uint8Array;

    firstName: string;
    lastName: string;
    birthDay: Date | null;

    /** How many days old the document may be, counted from the day it was drawn up. */
    maxAgeInDays: number;
}

export interface JudicialRecordCheckOutcome {
    report: JudicialRecordCheckReport;

    /**
     * The validated path, from the signer up to the pinned trust anchor, null when the Authentic
     * check did not pass. Answered rather than kept inside because revocation is looked up on these
     * certificates, and that lookup talks to the authorities that issued them - which cannot happen
     * everywhere this package runs.
     */
    certificatePath: pkijs.Certificate[] | null;

    /**
     * The values read off the document, null when its text was never read. Answered because a caller
     * needs more than the checks: where FOD Justitie serves the document, for a member whose viewer
     * cannot draw the pdf. It holds a name and birth date, so it stays in the process that already
     * has the bytes rather than being answered over http.
     */
    extract: JudicialRecordExtract | null;
}

/**
 * Everything we can establish about a delivered judicial record extract without a human looking
 * at it.
 *
 * The signature goes first because it is what makes the text worth reading: a file we cannot place
 * could say anything, so the content is only parsed once the signature holds.
 */
export async function checkJudicialRecord(request: JudicialRecordCheckRequest): Promise<JudicialRecordCheckOutcome> {
    const { authentic, signedAt, certificatePath } = await checkSignature(request.data);

    if (signedAt === null) {
        return {
            report: report([authentic, ...pending(CONTENT_CHECKS, $t('We lazen dit document niet: eerst moet vaststaan dat het van {signerName} komt.', { signerName: SIGNER_NAME }))]),
            certificatePath,
            extract: null,
        };
    }

    let lines: string[];

    try {
        lines = await extractPdfLines(request.data);
    } catch (error) {
        if (!isSimpleError(error)) {
            throw error;
        }

        // Its own message says what to do about a pdf we cannot read the text of, and that is the
        // same answer for all four content checks
        return {
            report: report([authentic, ...pending(CONTENT_CHECKS, human(error))]),
            certificatePath,
            extract: null,
        };
    }

    const extract = readJudicialRecordExtract(lines);

    return {
        report: report([authentic, ...checkJudicialRecordContent(extract, request, signedAt, new Date())]),
        certificatePath,
        extract,
    };
}

/** Answers with the signing time too, because that is the one date here covered by the signature. */
async function checkSignature(data: Uint8Array): Promise<{ authentic: JudicialRecordCheckResult; signedAt: Date | null; certificatePath: pkijs.Certificate[] | null }> {
    try {
        const { signedAt, certificatePath } = await verifyPdfFromFodJustitie(data);

        return {
            authentic: result(JudicialRecordCheck.Authentic, JudicialRecordCheckStatus.Passed, $t('Digitaal ondertekend door {signerName} op {date}.', { signerName: SIGNER_NAME, date: Formatter.dateTime(signedAt) })),
            signedAt,
            certificatePath,
        };
    } catch (error) {
        if (!isSimpleError(error)) {
            throw error;
        }

        // An authority not answering us about the certificates is not a verdict on the document:
        // nothing is wrong with it, and trying again later can still give it one
        const status = (error.statusCode ?? 400) >= 500
            ? JudicialRecordCheckStatus.Pending
            : JudicialRecordCheckStatus.Failed;

        return {
            authentic: result(JudicialRecordCheck.Authentic, status, human(error)),
            signedAt: null,
            certificatePath: null,
        };
    }
}

/** The checks on the text of a document whose signature already held. */
export function checkJudicialRecordContent(extract: JudicialRecordExtract, request: Omit<JudicialRecordCheckRequest, 'data'>, signedAt: Date, atDate: Date): JudicialRecordCheckResult[] {
    return [
        checkModel(extract),
        checkIdentity(extract, request),
        checkAge(extract, signedAt, request.maxAgeInDays, atDate),
        checkEmptyRecord(extract, signedAt),
    ];
}

/**
 * The purpose has to start with the model number rather than merely mention it: 596.2 also turns up
 * in the boilerplate of other models, so a 596.1 extract can name it while being another document.
 */
function checkModel(extract: JudicialRecordExtract): JudicialRecordCheckResult {
    if (extract.purpose === null) {
        return result(JudicialRecordCheck.Model, JudicialRecordCheckStatus.Failed, $t('We vonden niet terug waarvoor dit uittreksel werd opgemaakt.'));
    }

    if (!extract.purpose.startsWith(JUDICIAL_RECORD_MODEL)) {
        return result(JudicialRecordCheck.Model, JudicialRecordCheckStatus.Failed, $t('Dit is geen uittreksel model {model}, het soort dat nodig is voor activiteiten met minderjarigen.', { model: JUDICIAL_RECORD_MODEL }));
    }

    return result(JudicialRecordCheck.Model, JudicialRecordCheckStatus.Passed, $t('Uittreksel model {model}, het soort dat nodig is voor activiteiten met minderjarigen.', { model: JUDICIAL_RECORD_MODEL }));
}

/**
 * The reason names the member we expected, never the name we found: an extract that is not this
 * member's is someone else's, and that someone did not agree to us repeating their name here.
 */
function checkIdentity(extract: JudicialRecordExtract, member: Pick<JudicialRecordCheckRequest, 'firstName' | 'lastName' | 'birthDay'>): JudicialRecordCheckResult {
    if (extract.firstName === null || extract.lastName === null || extract.birthDay === null) {
        return result(JudicialRecordCheck.Identity, JudicialRecordCheckStatus.Failed, $t('We vonden geen naam en geboortedatum op dit document terug.'));
    }

    const expected = member.firstName + ' ' + member.lastName;

    const matches = member.birthDay !== null
        && isSameName(extract.lastName, member.lastName)
        && isSameFirstName(extract.firstName, member.firstName)
        && isSameDay(extract.birthDay, member.birthDay);

    if (!matches) {
        return result(JudicialRecordCheck.Identity, JudicialRecordCheckStatus.Failed, $t('Dit document werd niet opgemaakt voor {name}.', { name: expected }));
    }

    return result(JudicialRecordCheck.Identity, JudicialRecordCheckStatus.Passed, $t('Opgemaakt voor {name}, met dezelfde geboortedatum.', { name: expected }));
}

/**
 * The header date is printed text and says nothing by itself; the signing time comes out of the
 * signature. Requiring them to be the same day is what lets the printed date be read as the day the
 * extract was drawn up, and what catches an older extract whose header was edited.
 */
function checkAge(extract: JudicialRecordExtract, signedAt: Date, maxAgeInDays: number, atDate: Date): JudicialRecordCheckResult {
    if (extract.documentDate === null) {
        return result(JudicialRecordCheck.Age, JudicialRecordCheckStatus.Failed, $t('We vonden de datum van dit document niet terug.'));
    }

    if (!isSameDay(extract.documentDate, signedAt)) {
        return result(JudicialRecordCheck.Age, JudicialRecordCheckStatus.Failed, $t('De datum op dit document ({printed}) is niet de dag waarop het digitaal ondertekend werd ({signed}).', {
            printed: Formatter.date(extract.documentDate, true),
            signed: Formatter.date(signedAt, true),
        }));
    }

    const date = Formatter.date(extract.documentDate, true);

    if (ageInDays(extract.documentDate, atDate) > maxAgeInDays) {
        return result(JudicialRecordCheck.Age, JudicialRecordCheckStatus.Failed, $t('Dit uittreksel werd opgemaakt op {date} en mag niet ouder zijn dan {days} dagen.', { date, days: maxAgeInDays.toString() }));
    }

    return result(JudicialRecordCheck.Age, JudicialRecordCheckStatus.Passed, $t('Opgemaakt op {date}, niet ouder dan {days} dagen.', { date, days: maxAgeInDays.toString() }));
}

/**
 * The marker carries the date the register was established to hold nothing, and an extract drawn up
 * today that was empty a month ago says nothing about today - so that date has to be the day of the
 * document. Compared against the signing time rather than the printed header date, because that is
 * the date the age check already ties the header to.
 */
function checkEmptyRecord(extract: JudicialRecordExtract, signedAt: Date): JudicialRecordCheckResult {
    if (extract.emptyRecordSince === null) {
        return result(JudicialRecordCheck.EmptyRecord, JudicialRecordCheckStatus.Failed, $t('Dit is geen blanco uittreksel uit het strafregister.'));
    }

    if (!isSameDay(extract.emptyRecordSince, signedAt)) {
        return result(JudicialRecordCheck.EmptyRecord, JudicialRecordCheckStatus.Failed, $t('Dit uittreksel is blanco sinds {since}, niet sinds de dag waarop het werd opgemaakt ({document}).', {
            since: Formatter.date(extract.emptyRecordSince, true),
            document: Formatter.date(signedAt, true),
        }));
    }

    return result(JudicialRecordCheck.EmptyRecord, JudicialRecordCheckStatus.Passed, $t('Blanco uittreksel uit het strafregister op {date}.', { date: Formatter.date(extract.emptyRecordSince, true) }));
}

function report(checks: JudicialRecordCheckResult[]): JudicialRecordCheckReport {
    return JudicialRecordCheckReport.create({ checks });
}

function result(check: JudicialRecordCheck, status: JudicialRecordCheckStatus, reason: string): JudicialRecordCheckResult {
    return JudicialRecordCheckResult.create({ check, status, reason });
}

function pending(checks: JudicialRecordCheck[], reason: string): JudicialRecordCheckResult[] {
    return checks.map(check => result(check, JudicialRecordCheckStatus.Pending, reason));
}

/** Every rejection of both packages carries one, but the type allows it to be absent. */
function human(error: { human?: string; code: string }): string {
    return error.human ?? $t('We konden dit document niet controleren. Laad het originele pdf-bestand op dat je van {signerName} kreeg.', { signerName: SIGNER_NAME });
}

/** Accents, capitals and punctuation are how a name is written, not which name it is. */
function normalizeName(value: string): string {
    return Formatter.removeAccents(value).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

function isSameName(printed: string, expected: string): boolean {
    const normalized = normalizeName(expected);

    return normalized.length > 0 && normalizeName(printed) === normalized;
}

/**
 * An extract prints every given name its holder has; a member record usually holds the one they go
 * by. So the names we have must all be on the document, but the document may hold more.
 */
function isSameFirstName(printed: string, expected: string): boolean {
    const printedNames = new Set(normalizeName(printed).split(' '));
    const expectedNames = normalizeName(expected).split(' ').filter(name => name.length > 0);

    return expectedNames.length > 0 && expectedNames.every(name => printedNames.has(name));
}

/** A printed date names a day, so two of them compare as days - in the timezone we print them in. */
function isSameDay(left: Date, right: Date): boolean {
    return Formatter.dateIso(left) === Formatter.dateIso(right);
}

function ageInDays(documentDate: Date, atDate: Date): number {
    return Formatter.luxon(atDate).startOf('day').diff(Formatter.luxon(documentDate).startOf('day'), 'days').days;
}
