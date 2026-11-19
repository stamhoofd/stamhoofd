import { Formatter } from '@stamhoofd/utility';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import DueAtDescription from './DueAtDescription.vue';

function renderDescription(dueAt: Date | null) {
    return render(DueAtDescription, {
        props: { dueAt },
        global: {
            config: {
                globalProperties: {
                    $t: (globalThis as any).$t ?? ((value: string) => value),
                    formatDate: Formatter.date.bind(Formatter),
                } as any,
            },
        },
    });
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-03-02T10:00:00+01:00'));
});

afterEach(() => {
    vi.useRealTimers();
});

test('shows nothing without a due date', () => {
    const { container } = renderDescription(null);
    expect(container.textContent?.trim()).toBe('');
});

test('shows the date from which the balance becomes visible, one week before the due date', async () => {
    const screen = renderDescription(new Date('2027-03-20T00:00:00+01:00'));
    await expect.element(screen.getByText(Formatter.date(new Date('2027-03-13T12:00:00+01:00'), true), { exact: false })).toBeVisible();
});

test('counts calendar days when the week crosses the switch to summer time', async () => {
    // Summer time starts on 28 March 2027
    const screen = renderDescription(new Date('2027-04-01T00:00:00+02:00'));
    await expect.element(screen.getByText(Formatter.date(new Date('2027-03-25T12:00:00+01:00'), true), { exact: false })).toBeVisible();
});

test('says the balance is visible immediately when the due date is within a week', async () => {
    const screen = renderDescription(new Date('2027-03-05T00:00:00+01:00'));
    await expect.element(screen.getByText('onmiddellijk', { exact: false })).toBeVisible();
});
