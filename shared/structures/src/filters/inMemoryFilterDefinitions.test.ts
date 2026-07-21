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
});
