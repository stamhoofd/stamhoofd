import { JudicialRecordCheck, JudicialRecordCheckStatus, judicialRecordChecksInOrder } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import type { JudicialRecordCheckRequest } from '../src/checkJudicialRecord.js';
import { checkJudicialRecord, checkJudicialRecordContent } from '../src/checkJudicialRecord.js';
import { readJudicialRecordExtract } from '../src/JudicialRecordExtract.js';

/** The moment the signature of the fixture says it was made, so the day the extract was drawn up. */
const SIGNED_AT = new Date('2026-11-02T17:02:46.000Z');

/** Eight days after the document was drawn up. */
const NOW = new Date('2026-11-10T09:00:00.000Z');

const MEMBER: Omit<JudicialRecordCheckRequest, 'data'> = {
    firstName: 'Jan',
    lastName: 'Janssens',
    birthDay: new Date('2006-04-05T00:00:00.000Z'),
    maxAgeInDays: 31,
};

function lines(overrides: { date?: string; lastName?: string; firstName?: string; birthDay?: string; purpose?: string; blank?: string | null } = {}): string[] {
    const all = [
        `Ref. doc : 20261102-5351 - Datum : ${overrides.date ?? '02/11/2026'} Betreft : JANSSENS JAN - 05/04/2006 1 / 1`,
        'UITTREKSEL UIT HET STRAFREGISTER',
        `Naam : ${overrides.lastName ?? 'JANSSENS'}`,
        `Voornaam : ${overrides.firstName ?? 'JAN PIETER'}`,
        `Geboortedatum : ${overrides.birthDay ?? '05/04/2006'}`,
        'Finaliteit van het uittreksel :',
        overrides.purpose ?? '596.2 - model bestemd voor de contacten met minderjarigen',
    ];

    const blank = overrides.blank === undefined ? '02/11/2026' : overrides.blank;

    if (blank !== null) {
        all.push(`BLANCO STRAFREGISTER (${blank})`);
    }

    return all;
}

function check(overrides: Parameters<typeof lines>[0] = {}, member: Partial<Omit<JudicialRecordCheckRequest, 'data'>> = {}) {
    const results = checkJudicialRecordContent(readJudicialRecordExtract(lines(overrides)), { ...MEMBER, ...member }, SIGNED_AT, NOW);

    return new Map(results.map(result => [result.check, result]));
}

describe('checkJudicialRecordContent', () => {
    test('passes every content check on a blank extract of the member', () => {
        const results = check();

        for (const [name, result] of results) {
            expect(result.status, name).toBe(JudicialRecordCheckStatus.Passed);
            expect(result.reason, name).not.toBe('');
        }
    });

    describe('identity', () => {
        test('accepts a member who goes by one of their given names', () => {
            expect(check({ firstName: 'JAN PIETER MARIA' }).get(JudicialRecordCheck.Identity)!.isPassed).toBe(true);
        });

        test('accepts a name written with other accents and capitals', () => {
            expect(check({ lastName: 'DE LÉTTER', firstName: 'JÀN' }, { lastName: 'de Letter', firstName: 'Jan' }).get(JudicialRecordCheck.Identity)!.isPassed).toBe(true);
        });

        test('refuses the extract of someone else', () => {
            const result = check({ lastName: 'PEETERS' }).get(JudicialRecordCheck.Identity)!;

            expect(result.isFailed).toBe(true);
            // The name on the document is someone else's, so it is not repeated back
            expect(result.reason).toContain('Jan Janssens');
            expect(result.reason).not.toContain('PEETERS');
        });

        test('refuses another birth date', () => {
            expect(check({ birthDay: '05/04/2007' }).get(JudicialRecordCheck.Identity)!.isFailed).toBe(true);
        });

        test('refuses a given name the document does not hold', () => {
            expect(check({ firstName: 'PIETER' }).get(JudicialRecordCheck.Identity)!.isFailed).toBe(true);
        });

        test('refuses a member without a birth date, which nothing on the document can match', () => {
            expect(check({}, { birthDay: null }).get(JudicialRecordCheck.Identity)!.isFailed).toBe(true);
        });

        test('fails when the name is not on the document at all', () => {
            const results = checkJudicialRecordContent(readJudicialRecordExtract(['UITTREKSEL UIT HET STRAFREGISTER']), MEMBER, SIGNED_AT, NOW);

            expect(results.find(result => result.check === JudicialRecordCheck.Identity)!.isFailed).toBe(true);
        });
    });

    describe('model', () => {
        test('refuses another model', () => {
            expect(check({ purpose: '596.1 - model bestemd voor gereglementeerde activiteiten' }).get(JudicialRecordCheck.Model)!.isFailed).toBe(true);
        });

        test('refuses a model that only mentions 596.2', () => {
            expect(check({ purpose: '596.1 - niet te verwarren met model 596.2' }).get(JudicialRecordCheck.Model)!.isFailed).toBe(true);
        });
    });

    describe('age', () => {
        test('refuses a document older than the maximum age', () => {
            const result = check({}, { maxAgeInDays: 7 }).get(JudicialRecordCheck.Age)!;

            expect(result.isFailed).toBe(true);
            expect(result.reason).toContain('7');
        });

        test('accepts a document exactly as old as the maximum age', () => {
            expect(check({}, { maxAgeInDays: 8 }).get(JudicialRecordCheck.Age)!.isPassed).toBe(true);
        });

        test('refuses a printed date that is not the day the document was signed', () => {
            // The signature covers the bytes of the document, so a header holding another date is
            // not a modified document - it is a document that was drawn up on another day
            expect(check({ date: '01/11/2026' }).get(JudicialRecordCheck.Age)!.isFailed).toBe(true);
        });

        test('fails when the document carries no date', () => {
            expect(check({ date: 'onbekend' }).get(JudicialRecordCheck.Age)!.isFailed).toBe(true);
        });
    });

    describe('blank', () => {
        test('refuses an extract without the blank marker', () => {
            expect(check({ blank: null }).get(JudicialRecordCheck.Blank)!.isFailed).toBe(true);
        });

        test('refuses a marker dated before the day the extract was drawn up', () => {
            const result = check({ blank: '02/10/2026' }).get(JudicialRecordCheck.Blank)!;

            expect(result.isFailed).toBe(true);
            // Names the day the register was established to be blank, not the day of the document
            expect(result.reason).toContain(Formatter.date(new Date('2026-10-02T00:00:00.000Z'), true));
        });
    });
});

describe('checkJudicialRecord', () => {
    /**
     * The happy path cannot run here: it needs a pdf signed by FOD Justitie itself, and a real
     * extract holds someone's name, birth date and address. The content checks are covered above,
     * on the values of a document; this covers what the package does around them.
     */
    test('reports the signature failure and leaves the content checks without a verdict', async () => {
        const { report, certificatePath } = await checkJudicialRecord({
            ...MEMBER,
            data: new TextEncoder().encode('Dit is geen pdf.'),
        });

        expect(report.isPassed).toBe(false);
        expect(report.getChecks().map(result => result.check)).toEqual([...judicialRecordChecksInOrder]);

        // Nothing was established about a chain, so there is none to look certificates up in
        expect(certificatePath).toBeNull();

        const authentic = report.get(JudicialRecordCheck.Authentic)!;
        expect(authentic.isFailed).toBe(true);
        expect(authentic.reason).not.toBe('');

        for (const check of judicialRecordChecksInOrder.filter(check => check !== JudicialRecordCheck.Authentic)) {
            expect(report.get(check)!.status, check).toBe(JudicialRecordCheckStatus.Pending);
        }
    });
});
