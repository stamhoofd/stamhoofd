import { StripeAccount, StripeMetaData } from '#StripeAccount.ts';

const createAccount = (options: {
    current_deadline?: number;
    future_deadline?: number;
    missingData?: boolean;
}): StripeAccount => {
    const account = new StripeAccount();
    const meta = new StripeMetaData();

    if (options.current_deadline) meta.requirements.current_deadline = options.current_deadline;
    if (options.future_deadline) meta.future_requirements.current_deadline = options.future_deadline;
    if (options.missingData) meta.requirements.currently_due = ['company.verification.document'];

    account.meta = meta;
    return account;
};

describe('StripeAccount', () => {
    [
        {
            type: 'current',
            options: {
                current_deadline: new Date().getTime(),
            },
        },
        {
            type: 'feature',
            options: {
                future_deadline: new Date().getTime(),
            },
        },
    ].forEach((testSet) => {
        test(`It shows an error with the details when there are missing details and a ${testSet.type} deadline`, () => {
            const account = createAccount({
                ...testSet.options,
                missingData: true,
            });

            expect(account.warning?.text).toContain('%Zg4');
        });

        test(`It show an error without specifics when none are present for a ${testSet.type} deadline`, () => {
            const account = createAccount({
                ...testSet.options,
            });

            expect(account.warning?.text).not.toContain('%Zg4');
        });
    });
});
