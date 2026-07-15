import { compileToInMemoryFilter } from './InMemoryFilter.js';
import type { StamhoofdFilter } from './StamhoofdFilter.js';
import { privateOrderWithTicketsFilterCompilers } from './inMemoryFilterDefinitions.js';

function makeOrder(overrides: Record<string, any> = {}) {
    return {
        id: 'order-1',
        status: 'created',
        number: 1,
        createdAt: new Date('2024-01-01'),
        validAt: null,
        webshopId: 'webshop-1',
        amountToPay: 0,
        payments: [],
        data: {
            customer: { name: 'John Doe', email: 'john@example.com', phone: null },
            cart: { items: [] },
            checkoutMethod: null,
            timeSlot: null,
            discountCodes: [],
            totalPrice: 0,
            amount: 1,
            recordAnswers: {},
            paymentMethod: null,
        },
        ...overrides,
    };
}

function testFilter(filter: StamhoofdFilter, objects: any[], doNotMatch: any[]) {
    const compiled = compileToInMemoryFilter(filter, privateOrderWithTicketsFilterCompilers);
    for (const object of objects) {
        if (compiled(object) !== true) {
            expect.fail(`Object ${JSON.stringify(object)} did not match filter ${JSON.stringify(filter)}`);
        }
    }
    for (const object of doNotMatch) {
        if (compiled(object) !== false) {
            expect.fail(`Object ${JSON.stringify(object)} matched filter ${JSON.stringify(filter)}, but should not have`);
        }
    }
}

describe('privateOrderWithTicketsFilterCompilers', () => {
    describe('recordAnswers', () => {
        it('supports filtering on a checkbox record answer', () => {
            testFilter(
                {
                    recordAnswers: {
                        'record-id-1': {
                            selected: { $eq: true },
                        },
                    },
                },
                [
                    makeOrder({ data: { ...makeOrder().data, recordAnswers: { 'record-id-1': { selected: true } } } }),
                ],
                [
                    makeOrder({ data: { ...makeOrder().data, recordAnswers: { 'record-id-1': { selected: false } } } }),
                    makeOrder({ data: { ...makeOrder().data, recordAnswers: {} } }),
                ],
            );
        });

        it('supports filtering on a text record answer value', () => {
            testFilter(
                {
                    recordAnswers: {
                        'record-id-1': {
                            value: { $contains: 'hello' },
                        },
                    },
                },
                [
                    makeOrder({ data: { ...makeOrder().data, recordAnswers: { 'record-id-1': { value: 'say hello world' } } } }),
                ],
                [
                    makeOrder({ data: { ...makeOrder().data, recordAnswers: { 'record-id-1': { value: 'goodbye' } } } }),
                    makeOrder({ data: { ...makeOrder().data, recordAnswers: {} } }),
                ],
            );
        });

        it('supports filtering on a date record answer value', () => {
            testFilter(
                {
                    recordAnswers: {
                        'record-id-1': {
                            // Same filter as the date filter in the UI builds for 'equals'
                            $and: [
                                { dateValue: { $gte: new Date(2023, 5, 10) } },
                                { dateValue: { $lte: new Date(2023, 5, 10, 23, 59, 59, 999) } },
                            ],
                        },
                    },
                },
                [
                    makeOrder({ data: { ...makeOrder().data, recordAnswers: { 'record-id-1': { dateValue: new Date(2023, 5, 10, 14, 30, 15) } } } }),
                ],
                [
                    makeOrder({ data: { ...makeOrder().data, recordAnswers: { 'record-id-1': { dateValue: new Date(2023, 5, 11, 14, 30, 15) } } } }),
                    makeOrder({ data: { ...makeOrder().data, recordAnswers: { 'record-id-1': { dateValue: null } } } }),
                    makeOrder({ data: { ...makeOrder().data, recordAnswers: {} } }),
                ],
            );
        });

        it('supports filtering on a single-choice record answer', () => {
            testFilter(
                {
                    recordAnswers: {
                        'record-id-1': {
                            selectedChoice: {
                                id: { $eq: 'choice-a' },
                            },
                        },
                    },
                },
                [
                    makeOrder({ data: { ...makeOrder().data, recordAnswers: { 'record-id-1': { selectedChoice: { id: 'choice-a' } } } } }),
                ],
                [
                    makeOrder({ data: { ...makeOrder().data, recordAnswers: { 'record-id-1': { selectedChoice: { id: 'choice-b' } } } } }),
                    makeOrder({ data: { ...makeOrder().data, recordAnswers: {} } }),
                ],
            );
        });

        it('supports filtering on a multiple-choice record answer', () => {
            testFilter(
                {
                    recordAnswers: {
                        'record-id-1': {
                            selectedChoices: {
                                id: { $in: ['choice-a'] },
                            },
                        },
                    },
                },
                [
                    makeOrder({ data: { ...makeOrder().data, recordAnswers: { 'record-id-1': { selectedChoices: [{ id: 'choice-a' }, { id: 'choice-b' }] } } } }),
                    makeOrder({ data: { ...makeOrder().data, recordAnswers: { 'record-id-1': { selectedChoices: [{ id: 'choice-a' }] } } } }),
                ],
                [
                    makeOrder({ data: { ...makeOrder().data, recordAnswers: { 'record-id-1': { selectedChoices: [{ id: 'choice-b' }] } } } }),
                    makeOrder({ data: { ...makeOrder().data, recordAnswers: {} } }),
                ],
            );
        });
    });

    // These pin the in-memory engine to the same result the SQL query returns for a record answer that is
    // "empty": either the record id is missing entirely (the question was never answered), or the value on the
    // answer is null. In SQL both extract to NULL from the JSON column, so operators like $lt/$lte/$eq(null)
    // match them, while $gt/$gte/$contains do not. The record-answer compilers mirror this via treatMissingAsNull.
    describe('record answers with missing or null values (SQL parity)', () => {
        const RID = 'record-id-1';

        // An order that answered the record question with the given answer object.
        const answered = (answer: Record<string, any>) => makeOrder({ data: { ...makeOrder().data, recordAnswers: { [RID]: answer } } });
        // An order that never answered the record question.
        const unanswered = makeOrder({ data: { ...makeOrder().data, recordAnswers: {} } });

        describe('date value', () => {
            const stored = new Date(2023, 5, 10, 14, 30, 15);

            it('$lt matches earlier dates, null and unanswered (null is the smallest)', () => {
                testFilter(
                    { recordAnswers: { [RID]: { dateValue: { $lt: new Date(2023, 5, 20) } } } },
                    [
                        answered({ dateValue: stored }),
                        answered({ dateValue: null }),
                        unanswered,
                    ],
                    [
                        answered({ dateValue: new Date(2023, 5, 25) }),
                    ],
                );
            });

            it('$gt matches later dates but not null or unanswered', () => {
                testFilter(
                    { recordAnswers: { [RID]: { dateValue: { $gt: new Date(2023, 5, 5) } } } },
                    [
                        answered({ dateValue: stored }),
                    ],
                    [
                        answered({ dateValue: new Date(2023, 5, 1) }),
                        answered({ dateValue: null }),
                        unanswered,
                    ],
                );
            });

            it('$eq null matches null and unanswered', () => {
                testFilter(
                    { recordAnswers: { [RID]: { dateValue: { $eq: null } } } },
                    [
                        answered({ dateValue: null }),
                        unanswered,
                    ],
                    [
                        answered({ dateValue: stored }),
                    ],
                );
            });
        });

        describe('text or number value', () => {
            it('$contains never matches null or unanswered', () => {
                testFilter(
                    { recordAnswers: { [RID]: { value: { $contains: 'hello' } } } },
                    [
                        answered({ value: 'say hello world' }),
                    ],
                    [
                        answered({ value: 'goodbye' }),
                        answered({ value: null }),
                        unanswered,
                    ],
                );
            });

            it('$eq null matches null and unanswered', () => {
                testFilter(
                    { recordAnswers: { [RID]: { value: { $eq: null } } } },
                    [
                        answered({ value: null }),
                        unanswered,
                    ],
                    [
                        answered({ value: 'anything' }),
                    ],
                );
            });

            it('$lt matches smaller numbers, null and unanswered', () => {
                testFilter(
                    { recordAnswers: { [RID]: { value: { $lt: 10 } } } },
                    [
                        answered({ value: 5 }),
                        answered({ value: null }),
                        unanswered,
                    ],
                    [
                        answered({ value: 15 }),
                    ],
                );
            });
        });

        describe('checkbox (selected)', () => {
            it('$in [null, true] matches the null option for null and unanswered', () => {
                testFilter(
                    { recordAnswers: { [RID]: { selected: { $in: [null, true] } } } },
                    [
                        answered({ selected: true }),
                        answered({ selected: null }),
                        unanswered,
                    ],
                    [
                        answered({ selected: false }),
                    ],
                );
            });

            it('$in [true] does not match null or unanswered', () => {
                testFilter(
                    { recordAnswers: { [RID]: { selected: { $in: [true] } } } },
                    [
                        answered({ selected: true }),
                    ],
                    [
                        answered({ selected: false }),
                        answered({ selected: null }),
                        unanswered,
                    ],
                );
            });
        });

        describe('single choice (selectedChoice)', () => {
            it('$in [null, choice] matches the null option for a null choice and unanswered', () => {
                testFilter(
                    { recordAnswers: { [RID]: { selectedChoice: { id: { $in: [null, 'choice-a'] } } } } },
                    [
                        answered({ selectedChoice: { id: 'choice-a' } }),
                        answered({ selectedChoice: null }),
                        unanswered,
                    ],
                    [
                        answered({ selectedChoice: { id: 'choice-b' } }),
                    ],
                );
            });
        });
    });

    // KNOWN LIMITATION, documented on purpose.
    // SQL uses three-valued logic: NOT(value = X) does not match rows where value IS NULL, so an unanswered
    // record answer does NOT match a "NotEquals"/"NotContains" filter (which the UI builds as $not { $eq }).
    // The in-memory engine is two-valued: !(null === X) is true, so it DOES match. This cannot be reconciled
    // without a tri-state runner, so the two engines differ for negated equality on empty record answers.
    describe('record answers: negated equality differs from SQL for missing or null values', () => {
        const RID = 'record-id-1';
        const answered = (answer: Record<string, any>) => makeOrder({ data: { ...makeOrder().data, recordAnswers: { [RID]: answer } } });
        const unanswered = makeOrder({ data: { ...makeOrder().data, recordAnswers: {} } });

        it('$not { $eq } matches null and unanswered in memory (SQL would not)', () => {
            const filter = { recordAnswers: { [RID]: { $not: { value: { $eq: 'x' } } } } };
            const compiled = compileToInMemoryFilter(filter, privateOrderWithTicketsFilterCompilers);

            // Differs from SQL, which excludes NULLs from a negated equality:
            expect(compiled(unanswered)).toBe(true);
            expect(compiled(answered({ value: null }))).toBe(true);

            // Agrees with SQL for concrete values:
            expect(compiled(answered({ value: 'x' }))).toBe(false);
            expect(compiled(answered({ value: 'y' }))).toBe(true);
        });
    });
});
