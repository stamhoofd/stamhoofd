import { isSimpleError } from '@common/errors';
import { extractPdfLines } from '@stamhoofd/pdf-parse';
import { verifyPdfFromFodJustitie } from '@stamhoofd/pdf-verify';
import { JudicialRecordCheck, JudicialRecordCheckReport, JudicialRecordCheckResult, JudicialRecordCheckStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import type { JudicialRecordExtract } from './JudicialRecordExtract.js';
import { JUDICIAL_RECORD_MODEL, readJudicialRecordExtract } from './JudicialRecordExtract.js';

const SIGNER_NAME = 'FOD Justitie';

/** The checks that are run on the text of the document, so only once the signature holds. */
const CONTENT_CHECKS = [JudicialRecordCheck.Identity, JudicialRecordCheck.Model, JudicialRecordCheck.Age, JudicialRecordCheck.Blank];

export interface JudicialRecordCheckRequest {
    /** The original pdf, exactly as it was received: untrusted input. */
    data: Uint8Array;

    firstName: string;
    lastName: string;
    birthDay: Date | null;

    /** How many days old the document may be, counted from the day it was drawn up. */
    maxAgeInDays: number;
}

/**
 * Everything we can establish about a delivered judicial record extract on our own, without a human
 * looking at it.
 *
 * Nothing here is stored and nothing is read from the database: the same document delivered twice
 * gives the same answer, and a reviewer opening one later has it checked again rather than shown a
 * stored verdict.
 */
export class JudicialRecordService {
    /**
     * The five checks of the automatic control, in display order.
     *
     * The signature first, because it is what makes the text worth reading: a file we cannot place
     * could say anything. Its content is only parsed once the signature holds.
     */
    static async check(request: JudicialRecordCheckRequest): Promise<JudicialRecordCheckReport> {
        const { authentic, signedAt } = await this.checkSignature(request.data, request.maxAgeInDays);

        if (signedAt === null) {
            return report([authentic, ...pending(CONTENT_CHECKS, $t('We lazen dit document niet: eerst moet vaststaan dat het van {signerName} komt.', { signerName: SIGNER_NAME }))]);
        }

        let lines: string[];

        try {
            lines = await extractPdfLines(request.data);
        } catch (error) {
            // A pdf we cannot read the text of: no text layer, or beyond the limits the package
            // accepts. Its own message says what to do about it, which is the same for all four.
            if (!isSimpleError(error)) {
                throw error;
            }

            return report([authentic, ...pending(CONTENT_CHECKS, human(error))]);
        }

        return report([authentic, ...this.checkContent(readJudicialRecordExtract(lines), request, signedAt, new Date())]);
    }

    /**
     * Check 1. Answers with the signing time as well, since that is the one date here that is
     * covered by the signature, and null when the signature did not hold.
     */
    private static async checkSignature(data: Uint8Array, maxAgeInDays: number): Promise<{ authentic: JudicialRecordCheckResult; signedAt: Date | null }> {
        try {
            const signedAt = await verifyPdfFromFodJustitie(data, maxAgeInDays);

            return {
                authentic: result(JudicialRecordCheck.Authentic, JudicialRecordCheckStatus.Passed, $t('Digitaal ondertekend door {signerName} op {date}.', { signerName: SIGNER_NAME, date: Formatter.dateTime(signedAt) })),
                signedAt,
            };
        } catch (error) {
            if (!isSimpleError(error)) {
                throw error;
            }

            // Nothing is wrong with the document when an authority did not answer us about its
            // certificates, so that is not a verdict on the document: it is a check without one,
            // and trying again later can still give it one.
            const status = (error.statusCode ?? 400) >= 500
                ? JudicialRecordCheckStatus.Pending
                : JudicialRecordCheckStatus.Failed;

            return {
                authentic: result(JudicialRecordCheck.Authentic, status, human(error)),
                signedAt: null,
            };
        }
    }

    /** Checks 2 to 5, on the text of a document whose signature already held. */
    static checkContent(extract: JudicialRecordExtract, request: Omit<JudicialRecordCheckRequest, 'data'>, signedAt: Date, atDate: Date): JudicialRecordCheckResult[] {
        return [
            checkIdentity(extract, request),
            checkModel(extract),
            checkAge(extract, signedAt, request.maxAgeInDays, atDate),
            checkBlank(extract, signedAt),
        ];
    }
}

/**
 * Check 2. The name we expected is in the reason, never the name we found: an extract that is not
 * this member's is someone else's, and that someone did not agree to us repeating their name here.
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
 * Check 3. The purpose has to start with the model number, not merely mention it somewhere: 596.2
 * also turns up in the boilerplate of other models, so a 596.1 extract can name it while being
 * another document.
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
 * Check 4. Recent enough, and drawn up the day it was signed.
 *
 * Those two belong together. The date in the header is printed text and says nothing by itself; the
 * signing time comes out of the signature. Requiring them to be the same day is what lets the
 * printed date be read as the day the extract was drawn up, and what catches an older extract whose
 * header was edited - the signature covers the bytes, but a header is also just bytes to it.
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
 * Check 5. Blank, and blank as of the day the extract was drawn up.
 *
 * The marker is a heading the document prints about itself, with a date beside it - that date is
 * when the register was established to be blank. An extract drawn up today that states it was blank
 * a month ago says nothing about today, so the date has to be the day of the document.
 *
 * It is compared against the signing time rather than against the printed header date, because that
 * is the date check 4 already ties the header to: with both checks passed, all three are one day.
 */
function checkBlank(extract: JudicialRecordExtract, signedAt: Date): JudicialRecordCheckResult {
    if (extract.blankSince === null) {
        return result(JudicialRecordCheck.Blank, JudicialRecordCheckStatus.Failed, $t('Dit is geen blanco uittreksel uit het strafregister.'));
    }

    if (!isSameDay(extract.blankSince, signedAt)) {
        return result(JudicialRecordCheck.Blank, JudicialRecordCheckStatus.Failed, $t('Dit uittreksel is blanco sinds {blank}, niet sinds de dag waarop het werd opgemaakt ({document}).', {
            blank: Formatter.date(extract.blankSince, true),
            document: Formatter.date(signedAt, true),
        }));
    }

    return result(JudicialRecordCheck.Blank, JudicialRecordCheckStatus.Passed, $t('Blanco uittreksel uit het strafregister op {date}.', { date: Formatter.date(extract.blankSince, true) }));
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

/**
 * Names and dates printed on a document are compared the way a person would read them: accents,
 * capitals and punctuation are how a name is written, not which name it is.
 */
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
