import { JudicialRecordCheck, JudicialRecordCheckReport, JudicialRecordCheckResult, JudicialRecordCheckStatus, judicialRecordChecksInOrder } from '@stamhoofd/structures';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-vue';

import JudicialRecordCheckList from './JudicialRecordCheckList.vue';

const allPassed = JudicialRecordCheckReport.create({
    checks: judicialRecordChecksInOrder.map(check => JudicialRecordCheckResult.create({
        check,
        status: JudicialRecordCheckStatus.Passed,
        reason: 'Daarom.',
    })),
});

function renderList(props: { report: JudicialRecordCheckReport | null; showOutcome?: boolean }) {
    return render(JudicialRecordCheckList, { props });
}

test('shows the message under the rows by default', async () => {
    const screen = renderList({ report: allPassed });

    await expect.element(screen.getByTestId('judicial-record-outcome')).toBeVisible();
    await expect.element(screen.getByTestId('judicial-record-outcome')).toHaveTextContent('goedgekeurd');
});

test('leaves the message out for a caller that says it itself, keeping the rows', async () => {
    const screen = renderList({ report: allPassed, showOutcome: false });

    expect(screen.container.querySelector('[data-testid="judicial-record-outcome"]')).toBeNull();
    expect(screen.container.querySelectorAll('.judicial-record-check-row')).toHaveLength(judicialRecordChecksInOrder.length);
});

test('shows every check to the member, the empty record one included', async () => {
    const screen = renderList({ report: allPassed });

    await expect.element(screen.getByText('Blanco strafregister', { exact: true })).toBeVisible();
    expect(screen.container.querySelectorAll('.judicial-record-check-row')).toHaveLength(judicialRecordChecksInOrder.length);
});

test('says the same reason only on the first row that says it', async () => {
    const signatureRefused = JudicialRecordCheckReport.create({
        checks: [
            JudicialRecordCheckResult.create({
                check: JudicialRecordCheck.Authentic,
                status: JudicialRecordCheckStatus.Failed,
                reason: 'De ondertekening klopt niet.',
            }),
            ...[JudicialRecordCheck.Model, JudicialRecordCheck.Identity, JudicialRecordCheck.Age, JudicialRecordCheck.EmptyRecord].map(check => JudicialRecordCheckResult.create({
                check,
                status: JudicialRecordCheckStatus.Pending,
                reason: 'We lazen dit document niet.',
            })),
        ],
    });

    const screen = renderList({ report: signatureRefused, showOutcome: false });
    const reasons = [...screen.container.querySelectorAll('.judicial-record-check-row .style-description-small')];

    expect(reasons.map(element => element.textContent?.trim())).toEqual([
        'De ondertekening klopt niet.',
        'We lazen dit document niet.',
    ]);
});
