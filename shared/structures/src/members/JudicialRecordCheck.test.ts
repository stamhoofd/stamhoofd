import { JudicialRecordCheck, JudicialRecordCheckReport, JudicialRecordCheckResult, JudicialRecordCheckStatus, judicialRecordChecksInOrder } from './JudicialRecordCheck.js';

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

describe('JudicialRecordCheckReport', () => {
    test('shows the checks in display order, whichever order they came in', () => {
        const unordered = report({
            [JudicialRecordCheck.Blank]: JudicialRecordCheckStatus.Passed,
            [JudicialRecordCheck.Identity]: JudicialRecordCheckStatus.Passed,
            [JudicialRecordCheck.Authentic]: JudicialRecordCheckStatus.Passed,
        });

        expect(unordered.getChecks(true).map(result => result.check)).toEqual([
            JudicialRecordCheck.Authentic,
            JudicialRecordCheck.Identity,
            JudicialRecordCheck.Blank,
        ]);
    });

    test('keeps the blank check from the member', () => {
        expect(report(allPassed).getChecks(false).map(result => result.check)).not.toContain(JudicialRecordCheck.Blank);
    });

    test('passes only when every check has a result that passed', () => {
        expect(report(allPassed).isPassed).toBe(true);
        expect(report({ ...allPassed, [JudicialRecordCheck.Blank]: JudicialRecordCheckStatus.Failed }).isPassed).toBe(false);

        // A check without a verdict is not a check that passed
        expect(report({ ...allPassed, [JudicialRecordCheck.Age]: JudicialRecordCheckStatus.Pending }).isPassed).toBe(false);

        // Nor is a check that never arrived
        expect(report({ [JudicialRecordCheck.Authentic]: JudicialRecordCheckStatus.Passed }).isPassed).toBe(false);
    });

    test('lists the failed checks in display order', () => {
        const failed = report({
            ...allPassed,
            [JudicialRecordCheck.Model]: JudicialRecordCheckStatus.Failed,
            [JudicialRecordCheck.Identity]: JudicialRecordCheckStatus.Failed,
        });

        expect(failed.failedChecks.map(result => result.check)).toEqual([JudicialRecordCheck.Identity, JudicialRecordCheck.Model]);
    });
});
