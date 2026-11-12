import type { InMemoryFilterDefinitions } from './InMemoryFilter.js';
import {
    baseInMemoryFilterCompilers,
    createInMemoryFilterCompiler,
    createInMemoryWildcardCompilerSelector,
} from './InMemoryFilter.js';

// This should match the backend logica. Some things that might be possible in the 'in memory' compilers, are not possible in the SQL compilers.
// so that is why we don't support $elemMatch inside selectedChoices - this has been replaced with a wildcard selector instead.
export const recordAnswerItemFilterCompilers: InMemoryFilterDefinitions = new Map([
    ...baseInMemoryFilterCompilers,
    ['selected', createInMemoryFilterCompiler('selected')],
    [
        'selectedChoice',
        createInMemoryFilterCompiler(
            'selectedChoice',
            new Map([...baseInMemoryFilterCompilers, ['id', createInMemoryFilterCompiler('id')]]),
        ),
    ],
    [
        'selectedChoices',
        new Map([
            ...baseInMemoryFilterCompilers,
            ['id', createInMemoryFilterCompiler('selectedChoices.*.id')],
        ]),
    ],
    ['value', createInMemoryFilterCompiler('value')],
    ['dateValue', createInMemoryFilterCompiler('dateValue')],
]);

export const recordAnswersFilterCompilers: InMemoryFilterDefinitions = new Map([
    ...baseInMemoryFilterCompilers,
    [
        'recordAnswers',
        createInMemoryFilterCompiler(
            'recordAnswers',
            createInMemoryWildcardCompilerSelector(recordAnswerItemFilterCompilers),
        ),
    ],
]);

export const optionItemFilterCompilers: InMemoryFilterDefinitions = new Map([
    ...baseInMemoryFilterCompilers,
    [
        'option',
        createInMemoryFilterCompiler(
            'option',
            new Map([...baseInMemoryFilterCompilers, ['id', createInMemoryFilterCompiler('id')]]),
        ),
    ],
    [
        'optionMenu',
        createInMemoryFilterCompiler(
            'optionMenu',
            new Map([...baseInMemoryFilterCompilers, ['id', createInMemoryFilterCompiler('id')]]),
        ),
    ],
]);

export const optionsFilterCompilers: InMemoryFilterDefinitions = new Map([
    ['options', createInMemoryFilterCompiler('options', optionItemFilterCompilers)],
]);

export const fieldAnswerItemFilterCompilers: InMemoryFilterDefinitions = new Map([
    ...baseInMemoryFilterCompilers,
    [
        'field',
        createInMemoryFilterCompiler(
            'field',
            new Map([...baseInMemoryFilterCompilers, ['id', createInMemoryFilterCompiler('id')]]),
        ),
    ],
    ['answer', createInMemoryFilterCompiler('answer')],
]);

export const fieldAnswersFilterCompilers: InMemoryFilterDefinitions = new Map([
    ...baseInMemoryFilterCompilers,
    // The field-answer UI wrapper applies its conditions to a single answer implicitly.
    [
        'fieldAnswers',
        (filter, compilers, key) =>
            createInMemoryFilterCompiler('fieldAnswers', fieldAnswerItemFilterCompilers)(
                { $elemMatch: filter },
                compilers,
                key,
            ),
    ],
]);

export const registrationInMemoryFilterCompilers: InMemoryFilterDefinitions = new Map([
    ...baseInMemoryFilterCompilers,
    ['groupId', createInMemoryFilterCompiler('groupId')],
    [
        'group',
        createInMemoryFilterCompiler(
            'group',
            new Map([...baseInMemoryFilterCompilers, ['id', createInMemoryFilterCompiler('id')]]),
        ),
    ],
]);

export const memberWithRegistrationsBlobInMemoryFilterCompilers: InMemoryFilterDefinitions =
    new Map([
        ...baseInMemoryFilterCompilers,
        ['age', createInMemoryFilterCompiler('details.defaultAge')],
        ['gender', createInMemoryFilterCompiler('details.gender')],
        ['birthDay', createInMemoryFilterCompiler('details.birthDay')],
        ['missingData', createInMemoryFilterCompiler('details.missingData')],
        [
            'recordAnswers',
            createInMemoryFilterCompiler(
                'details.recordAnswers',
                createInMemoryWildcardCompilerSelector(recordAnswerItemFilterCompilers),
            ),
        ],
        [
            'registrations',
            createInMemoryFilterCompiler('registrations', registrationInMemoryFilterCompilers),
        ],
    ]);

export const registerItemInMemoryFilterCompilers: InMemoryFilterDefinitions = new Map([
    ...baseInMemoryFilterCompilers,
    [
        'member',
        createInMemoryFilterCompiler(
            'member.patchedMember',
            memberWithRegistrationsBlobInMemoryFilterCompilers,
        ),
    ],
    [
        'groupPrice',
        createInMemoryFilterCompiler(
            'groupPrice',
            new Map([...baseInMemoryFilterCompilers, ['id', createInMemoryFilterCompiler('id')]]),
        ),
    ],
    [
        'options',
        createInMemoryFilterCompiler(
            'options',
            new Map([
                ...baseInMemoryFilterCompilers,
                [
                    'option',
                    createInMemoryFilterCompiler(
                        'option',
                        new Map([
                            ...baseInMemoryFilterCompilers,
                            ['id', createInMemoryFilterCompiler('id')],
                        ]),
                    ),
                ],
                [
                    'optionMenu',
                    createInMemoryFilterCompiler(
                        'optionMenu',
                        new Map([
                            ...baseInMemoryFilterCompilers,
                            ['id', createInMemoryFilterCompiler('id')],
                        ]),
                    ),
                ],
                ['amount', createInMemoryFilterCompiler('amount')],
            ]),
        ),
    ],
    ...recordAnswersFilterCompilers,
]);

export const documentInMemoryFilterCompilers: InMemoryFilterDefinitions = new Map([
    ...baseInMemoryFilterCompilers,
]);

/**
 * These filters are used for filtering record categories/records in webshops. Try to keep it a bit limited as we'll have to support them for eternity.
 */
export const checkoutInMemoryFilterCompilers: InMemoryFilterDefinitions = new Map([
    ...baseInMemoryFilterCompilers,
    [
        'items',
        createInMemoryFilterCompiler(
            'cart.items',
            new Map([
                ...baseInMemoryFilterCompilers,
                ...optionsFilterCompilers,
                ...fieldAnswersFilterCompilers,
                ['amount', createInMemoryFilterCompiler('amount')],
                [
                    'product',
                    createInMemoryFilterCompiler(
                        'product',
                        new Map([
                            ...baseInMemoryFilterCompilers,
                            ['id', createInMemoryFilterCompiler('id')],
                        ]),
                    ),
                ],
                [
                    'productPrice',
                    createInMemoryFilterCompiler(
                        'productPrice',
                        new Map([
                            ...baseInMemoryFilterCompilers,
                            ['id', createInMemoryFilterCompiler('id')],
                        ]),
                    ),
                ],
            ]),
        ),
    ],
    [
        'checkoutMethod',
        createInMemoryFilterCompiler(
            'checkoutMethod',
            new Map([
                ...baseInMemoryFilterCompilers,
                ['id', createInMemoryFilterCompiler('id')],
                ['type', createInMemoryFilterCompiler('type')],
            ]),
        ),
    ],
    ...recordAnswersFilterCompilers,
]);

export const receivableBalanceObjectContactInMemoryFilterCompilers: InMemoryFilterDefinitions =
    new Map([
        ...baseInMemoryFilterCompilers,
        [
            'meta',
            createInMemoryFilterCompiler(
                'meta',
                new Map([
                    ...baseInMemoryFilterCompilers,
                    ['responsibilityIds', createInMemoryFilterCompiler('responsibilityIds')],
                ]),
            ),
        ],
    ]);

export const organizationItemInMemoryFilterCompilers: InMemoryFilterDefinitions = new Map([
    ...baseInMemoryFilterCompilers,
    ['tags', createInMemoryFilterCompiler('meta.tags')],
]);

export const eventNotificationsInMemoryFilterCompilers: InMemoryFilterDefinitions = new Map([
    ...baseInMemoryFilterCompilers,
    ...recordAnswersFilterCompilers,
]);

export const paymentFilterCompilers: InMemoryFilterDefinitions = new Map([
    ...baseInMemoryFilterCompilers,
    ['paidAt', createInMemoryFilterCompiler('paidAt')],
    ['method', createInMemoryFilterCompiler('method')],
    ['price', createInMemoryFilterCompiler('price')],
    ['transferDescription', createInMemoryFilterCompiler('transferDescription')],
]);

export const privateOrderFilterCompilers: InMemoryFilterDefinitions = new Map([
    ...baseInMemoryFilterCompilers,

    // Generic filtering
    ['id', createInMemoryFilterCompiler('id')],
    ['timeSlotEndTime', createInMemoryFilterCompiler('data.timeSlot.endTime')],
    ['timeSlotStartTime', createInMemoryFilterCompiler('data.timeSlot.startTime')],
    ['webshopId', createInMemoryFilterCompiler('webshopId')],

    // The following fields are required for sorting
    // Make sure to implement all sorters here, for proper pagination
    ['createdAt', createInMemoryFilterCompiler('createdAt')],
    ['number', createInMemoryFilterCompiler('number')],
    ['status', createInMemoryFilterCompiler('status')],
    ['paymentMethod', createInMemoryFilterCompiler('data.paymentMethod')],
    ['checkoutMethod', createInMemoryFilterCompiler('data.checkoutMethod.type')],
    ['checkoutMethodId', createInMemoryFilterCompiler('data.checkoutMethod.id')],
    [
        'discountCodes',
        new Map([
            ...baseInMemoryFilterCompilers,
            ['code', createInMemoryFilterCompiler('data.discountCodes.*.code')],
        ]),
    ],
    ['timeSlotDate', createInMemoryFilterCompiler('data.timeSlot.date')],
    ['validAt', createInMemoryFilterCompiler('validAt')],
    ['name', createInMemoryFilterCompiler('data.customer.name')],
    ['email', createInMemoryFilterCompiler('data.customer.email')],
    ['phone', createInMemoryFilterCompiler('data.customer.phone')],
    ['totalPrice', createInMemoryFilterCompiler('data.totalPrice')],
    ['amount', createInMemoryFilterCompiler('data.amount')],
    ['timeSlotTime', createInMemoryFilterCompiler('data.timeSlot.timeIndex')],
    ['location', createInMemoryFilterCompiler('data.locationName')],

    /**
     * @deprecated: only supported in the frontend for now for sorting, not for filtering!
     * If used for real filters, the filter might touch the backend, which is unsupported
     */
    ['openBalance', createInMemoryFilterCompiler('openBalance')],

    // Other (no sorters)
    [
        'items',
        createInMemoryFilterCompiler(
            'data.cart.items',
            new Map([
                ...baseInMemoryFilterCompilers,
                ['amount', createInMemoryFilterCompiler('amount')],
                [
                    'product',
                    createInMemoryFilterCompiler(
                        'product',
                        new Map([
                            ...baseInMemoryFilterCompilers,
                            ['id', createInMemoryFilterCompiler('id')],
                        ]),
                    ),
                ],
                [
                    'productPrice',
                    createInMemoryFilterCompiler(
                        'productPrice',
                        new Map([
                            ...baseInMemoryFilterCompilers,
                            ['id', createInMemoryFilterCompiler('id')],
                        ]),
                    ),
                ],
                ...optionsFilterCompilers,
                ...fieldAnswersFilterCompilers,
            ]),
        ),
    ],
    [
        'recordAnswers',
        createInMemoryFilterCompiler(
            'data.recordAnswers',
            createInMemoryWildcardCompilerSelector(recordAnswerItemFilterCompilers),
        ),
    ],
    ['amountToPay', createInMemoryFilterCompiler('amountToPay')],
    ['payments', createInMemoryFilterCompiler('payments', paymentFilterCompilers)],
]);

export const privateOrderWithTicketsFilterCompilers: InMemoryFilterDefinitions = new Map([
    ...privateOrderFilterCompilers,
    ['ticketScanStatus', createInMemoryFilterCompiler('ticketScanStatus')],
    ['ticketScannedAt', createInMemoryFilterCompiler('ticketScannedAt')],
    ['ticketCount', createInMemoryFilterCompiler('tickets.length')],
]);
