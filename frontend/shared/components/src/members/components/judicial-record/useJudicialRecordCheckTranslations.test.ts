import { JudicialRecordCheck, JudicialRecordCheckReport, JudicialRecordCheckResult, JudicialRecordCheckStatus, judicialRecordChecksInOrder } from '@stamhoofd/structures';
import { describe, expect, test } from 'vitest';
import { JudicialRecordCheckOutcome, getJudicialRecordCheckOutcome } from './useJudicialRecordCheckTranslations';

function report(statuses: Partial<Record<JudicialRecordCheck, JudicialRecordCheckStatus>>): JudicialRecordCheckReport {
    return JudicialRecordCheckReport.create({
        checks: Object.entries(statuses).map(([check, status]) => JudicialRecordCheckResult.create({
            check: check as JudicialRecordCheck,
            status,
            reason: 'Daarom.',
        })),
    });
}

const allPassed = Object.fromEntries(judicialRecordChecksInOrder.map(check => [check, JudicialRecordCheckStatus.Passed]));

describe('getJudicialRecordCheckOutcome', () => {
    test('passes when every check has a verdict and every verdict passed', () => {
        expect(getJudicialRecordCheckOutcome(report(allPassed))).toBe(JudicialRecordCheckOutcome.Passed);
    });

    test('is a review when the record is simply not blank', () => {
        expect(getJudicialRecordCheckOutcome(report({ ...allPassed, [JudicialRecordCheck.Blank]: JudicialRecordCheckStatus.Failed })))
            .toBe(JudicialRecordCheckOutcome.NotBlank);
    });

    test('is a rejection on any other failed check', () => {
        expect(getJudicialRecordCheckOutcome(report({ ...allPassed, [JudicialRecordCheck.Model]: JudicialRecordCheckStatus.Failed })))
            .toBe(JudicialRecordCheckOutcome.Failed);
    });

    test('a rejection outranks a missing verdict: the four content checks have none when the signature does not hold', () => {
        const signatureRefused = report({
            [JudicialRecordCheck.Authentic]: JudicialRecordCheckStatus.Failed,
            [JudicialRecordCheck.Identity]: JudicialRecordCheckStatus.Pending,
            [JudicialRecordCheck.Model]: JudicialRecordCheckStatus.Pending,
            [JudicialRecordCheck.Age]: JudicialRecordCheckStatus.Pending,
            [JudicialRecordCheck.Blank]: JudicialRecordCheckStatus.Pending,
        });

        expect(getJudicialRecordCheckOutcome(signatureRefused)).toBe(JudicialRecordCheckOutcome.Failed);
    });

    test('concludes nothing while a check is still waiting, not even that it is not blank', () => {
        expect(getJudicialRecordCheckOutcome(report({ ...allPassed, [JudicialRecordCheck.Age]: JudicialRecordCheckStatus.Pending })))
            .toBe(JudicialRecordCheckOutcome.Pending);

        expect(getJudicialRecordCheckOutcome(report({
            ...allPassed,
            [JudicialRecordCheck.Age]: JudicialRecordCheckStatus.Pending,
            [JudicialRecordCheck.Blank]: JudicialRecordCheckStatus.Failed,
        }))).toBe(JudicialRecordCheckOutcome.Pending);
    });

    test('concludes nothing from a check that never arrived', () => {
        expect(getJudicialRecordCheckOutcome(report({ [JudicialRecordCheck.Authentic]: JudicialRecordCheckStatus.Passed })))
            .toBe(JudicialRecordCheckOutcome.Pending);
    });
});
