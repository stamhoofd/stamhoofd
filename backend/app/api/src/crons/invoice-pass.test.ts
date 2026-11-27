import { Organization, OrganizationFactory, Payment } from '@stamhoofd/models';
import { Company } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { createInvoiceCron } from './invoices.js';

const clock = (date: string) => vi.setSystemTime(new Date(`${date}Z`));
const request = vi.fn();

beforeEach(() => {
    TestUtils.setEnvironment('MONTHLY_INVOICE_HEARTBEAT_URL', 'https://example.invalid/monthly');
    request.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', request);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

it('signals each completed empty scan, respecting startup and day gates even after restart', async () => {
    const select = Organization.select.bind(Organization);
    vi.spyOn(Organization, 'select').mockImplementation(() =>
        select().where('id', 'no-such-organization'),
    );
    clock('2026-01-09T00:00');
    const tick = createInvoiceCron();
    clock('2026-01-09T12:00');
    await tick();
    expect(request).not.toHaveBeenCalled();
    clock('2026-01-10T00:00');
    const restarted = createInvoiceCron();
    await restarted();
    expect(request).not.toHaveBeenCalled();
    clock('2026-01-10T05:00');
    request.mockRejectedValueOnce(new Error('offline'));
    await restarted();
    expect(request).toHaveBeenCalledOnce();
    await restarted();
    expect(request).toHaveBeenCalledOnce();
    const afterAttempt = createInvoiceCron();
    clock('2026-01-10T12:00');
    await afterAttempt();
    expect(request).toHaveBeenCalledTimes(2);
    clock('2026-02-10T00:00');
    await afterAttempt();
    expect(request).toHaveBeenCalledTimes(3);
});

it('ignores interrupted scans and signals after the terminal query even in a later month', async () => {
    for (let i = 0; i < 50; i++)
        await new OrganizationFactory({ name: `Month pass ${i}` }).create();
    const select = Organization.select.bind(Organization);
    vi.spyOn(Organization, 'select').mockImplementation(() =>
        select().where('name', 'LIKE', 'Month pass %'),
    );
    const [first] = await Organization.select().orderBy('id').limit(1).fetch();
    first.meta.invoicesEnabled = true;
    first.meta.companies = [Company.create({ name: 'Seller' })];
    await first.save();

    clock('2026-01-10T00:00');
    const tick = createInvoiceCron();
    clock('2026-01-10T06:00');
    vi.spyOn(Payment, 'select').mockImplementationOnce(() => {
        throw new Error('query failed');
    });
    await expect(tick()).rejects.toThrow('query failed');
    await tick();
    await tick();
    expect(request).not.toHaveBeenCalled();

    clock('2026-02-10T00:00');
    await tick(); // 5 x 10 rows, but no terminal query yet
    expect(request).not.toHaveBeenCalled();
    clock('2026-03-10T00:00');
    await tick();
    expect(request).toHaveBeenCalledOnce();

    clock('2026-04-10T00:00');
    await tick();
    const restarted = createInvoiceCron();
    clock('2026-04-10T05:00');
    await restarted();
    expect(request).toHaveBeenCalledOnce();
    await restarted();
    expect(request).toHaveBeenCalledTimes(2);
});

it('does not signal when processing the last yielded organization throws', async () => {
    const org = await new OrganizationFactory({}).create();
    org.meta.invoicesEnabled = true;
    org.meta.companies = [Company.create({ name: 'Seller' })];
    await org.save();
    const singleRow = Organization.select().where('id', org.id);
    vi.spyOn(Organization, 'select').mockReturnValueOnce(singleRow);
    clock('2026-05-10T00:00');
    const tick = createInvoiceCron();
    clock('2026-05-10T06:00');
    vi.spyOn(Payment, 'select').mockImplementationOnce(() => {
        throw new Error('last organization failed');
    });
    await expect(tick()).rejects.toThrow('last organization failed');
    await tick();
    expect(request).not.toHaveBeenCalled();
});

it.each([1, 2])(
    'uses the month when the last of %i organizations was yielded for billing',
    async (count) => {
        for (let i = 0; i < count; i++) {
            const org = await new OrganizationFactory({ name: `Rollover ${count}-${i}` }).create();
            org.meta.invoicesEnabled = true;
            org.meta.companies = [Company.create({ name: 'Seller' })];
            await org.save();
        }
        const select = Organization.select.bind(Organization);
        vi.spyOn(Organization, 'select').mockImplementation(() =>
            select().where('name', 'LIKE', `Rollover ${count}-%`),
        );
        const payments = Payment.select.bind(Payment);
        const work = vi.spyOn(Payment, 'select').mockImplementationOnce(() => {
            clock('2026-01-31T23:01'); // February 1 in Brussels
            return payments();
        });
        clock('2026-01-30T00:00');
        const tick = createInvoiceCron();
        clock('2026-01-31T22:59');
        await tick();
        await tick(); // February 1: too early
        expect(work).toHaveBeenCalledTimes(count);
        expect(request).toHaveBeenCalledOnce();
        clock('2026-02-10T06:00');
        await tick();
        expect(work).toHaveBeenCalledTimes(2);
        expect(request).toHaveBeenCalledTimes(count === 1 ? 2 : 1);
    },
);
