import type { InMemoryFilterDefinitions } from './InMemoryFilter.js';
import { baseInMemoryFilterCompilers, createInMemoryFilterCompiler, createInMemoryWildcardCompilerSelector } from './InMemoryFilter.js';

// This should match the backend logica. Some things that might be possible in the 'in memory' compilers, are not possible in the SQL compilers.
// so that is why we don't support $elemMatch inside selectedChoices - this has been replaced with a wildcard selector instead.
//
// A record answer that has not been given (a missing record id, or a missing/empty field on the answer) is treated
// as null on every value path, via treatMissingAsNull. This mirrors the SQL filters, where extracting a missing path
// from the JSON column yields SQL NULL: e.g. filtering '$lt some-date' or '$eq null' then also matches members that
// never answered the question, exactly like the SQL query would.
const nullableRecordValue = { treatMissingAsNull: true };
export const recordAnswerItemFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    selected: createInMemoryFilterCompiler('selected', undefined, nullableRecordValue),
    selectedChoice: createInMemoryFilterCompiler('selectedChoice', {
        ...baseInMemoryFilterCompilers,
        id: createInMemoryFilterCompiler('id', undefined, nullableRecordValue),
    }, nullableRecordValue),
    selectedChoices: {
        ...baseInMemoryFilterCompilers,
        id: createInMemoryFilterCompiler('selectedChoices.*.id', undefined, nullableRecordValue),
    },
    value: createInMemoryFilterCompiler('value', undefined, nullableRecordValue),
    dateValue: createInMemoryFilterCompiler('dateValue', undefined, nullableRecordValue),
};

export const recordAnswersFilterCompilers: InMemoryFilterDefinitions = {
    recordAnswers: createInMemoryFilterCompiler('recordAnswers', createInMemoryWildcardCompilerSelector(recordAnswerItemFilterCompilers, nullableRecordValue)),
};

export const registrationInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    groupId: createInMemoryFilterCompiler('groupId'),
    group: createInMemoryFilterCompiler('group', {
        ...baseInMemoryFilterCompilers,
        id: createInMemoryFilterCompiler('id'),
    }),
};

export const memberWithRegistrationsBlobInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    age: createInMemoryFilterCompiler('details.defaultAge'),
    gender: createInMemoryFilterCompiler('details.gender'),
    birthDay: createInMemoryFilterCompiler('details.birthDay'),
    missingData: createInMemoryFilterCompiler('details.missingData'),
    recordAnswers: createInMemoryFilterCompiler('details.recordAnswers', createInMemoryWildcardCompilerSelector(recordAnswerItemFilterCompilers, nullableRecordValue)),
    registrations: createInMemoryFilterCompiler('registrations', registrationInMemoryFilterCompilers),
};

export const registerItemInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    member: createInMemoryFilterCompiler('member.patchedMember', memberWithRegistrationsBlobInMemoryFilterCompilers),
    groupPrice: createInMemoryFilterCompiler('groupPrice', {
        ...baseInMemoryFilterCompilers,
        id: createInMemoryFilterCompiler('id'),
    }),
    options: createInMemoryFilterCompiler('options', {
        ...baseInMemoryFilterCompilers,
        option: createInMemoryFilterCompiler('option', {
            ...baseInMemoryFilterCompilers,
            id: createInMemoryFilterCompiler('id'),
        }),
        optionMenu: createInMemoryFilterCompiler('optionMenu', {
            ...baseInMemoryFilterCompilers,
            id: createInMemoryFilterCompiler('id'),
        }),
        amount: createInMemoryFilterCompiler('amount'),
    }),
    ...recordAnswersFilterCompilers,
};

export const documentInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
};

/**
 * These filters are used for filtering record categories/records in webshops. Try to keep it a bit limited as we'll have to support them for eternity.
 */
export const checkoutInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    items: createInMemoryFilterCompiler('cart.items', {
        ...baseInMemoryFilterCompilers,
        amount: createInMemoryFilterCompiler('amount'),
        product: createInMemoryFilterCompiler('product', {
            ...baseInMemoryFilterCompilers,
            id: createInMemoryFilterCompiler('id'),
        }),
        productPrice: createInMemoryFilterCompiler('productPrice', {
            ...baseInMemoryFilterCompilers,
            id: createInMemoryFilterCompiler('id'),
        }),
    }),
    checkoutMethod: createInMemoryFilterCompiler('checkoutMethod', {
        ...baseInMemoryFilterCompilers,
        id: createInMemoryFilterCompiler('id'),
        type: createInMemoryFilterCompiler('type'),

    }),
    ...recordAnswersFilterCompilers,
};

export const receivableBalanceObjectContactInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    meta: createInMemoryFilterCompiler('meta', {
        ...baseInMemoryFilterCompilers,
        responsibilityIds: createInMemoryFilterCompiler('responsibilityIds'),
    }),
};

export const organizationItemInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    tags: createInMemoryFilterCompiler('meta.tags'),
};

export const eventNotificationsInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    ...recordAnswersFilterCompilers,
};

export const paymentFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    paidAt: createInMemoryFilterCompiler('paidAt'),
    method: createInMemoryFilterCompiler('method'),
    price: createInMemoryFilterCompiler('price'),
    transferDescription: createInMemoryFilterCompiler('transferDescription'),
};

export const privateOrderFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,

    // Generic filtering
    id: createInMemoryFilterCompiler('id'),
    timeSlotEndTime: createInMemoryFilterCompiler('data.timeSlot.endTime'),
    timeSlotStartTime: createInMemoryFilterCompiler('data.timeSlot.startTime'),
    webshopId: createInMemoryFilterCompiler('webshopId'),

    // The following fields are required for sorting
    // Make sure to implement all sorters here, for proper pagination
    createdAt: createInMemoryFilterCompiler('createdAt'),
    number: createInMemoryFilterCompiler('number'),
    status: createInMemoryFilterCompiler('status'),
    checkoutMethod: createInMemoryFilterCompiler('data.checkoutMethod.type'),
    checkoutMethodId: createInMemoryFilterCompiler('data.checkoutMethod.id'),
    discountCodes: {
        ...baseInMemoryFilterCompilers,
        code: createInMemoryFilterCompiler('data.discountCodes.*.code'),
    },
    timeSlotDate: createInMemoryFilterCompiler('data.timeSlot.date'),
    validAt: createInMemoryFilterCompiler('validAt'),
    name: createInMemoryFilterCompiler('data.customer.name'),
    email: createInMemoryFilterCompiler('data.customer.email'),
    phone: createInMemoryFilterCompiler('data.customer.phone'),
    totalPrice: createInMemoryFilterCompiler('data.totalPrice'),
    amount: createInMemoryFilterCompiler('data.amount'),
    timeSlotTime: createInMemoryFilterCompiler('data.timeSlot.timeIndex'),
    location: createInMemoryFilterCompiler('data.locationName'),

    /**
     * @deprecated: only supported in the frontend for now for sorting, not for filtering!
     * If used for real filters, the filter might touch the backend, which is unsupported
     */
    openBalance: createInMemoryFilterCompiler('openBalance'),

    // Other (no sorters)
    items: createInMemoryFilterCompiler('data.cart.items', {
        ...baseInMemoryFilterCompilers,
        amount: createInMemoryFilterCompiler('amount'),
        product: createInMemoryFilterCompiler('product', {
            ...baseInMemoryFilterCompilers,
            id: createInMemoryFilterCompiler('id'),
        }),
        productPrice: createInMemoryFilterCompiler('productPrice', {
            ...baseInMemoryFilterCompilers,
            id: createInMemoryFilterCompiler('id'),
        }),
    }),
    recordAnswers: createInMemoryFilterCompiler('data.recordAnswers', createInMemoryWildcardCompilerSelector(recordAnswerItemFilterCompilers, nullableRecordValue)),
    amountToPay: createInMemoryFilterCompiler('amountToPay'),
    payments: createInMemoryFilterCompiler('payments', paymentFilterCompilers),
};

export const privateOrderWithTicketsFilterCompilers: InMemoryFilterDefinitions = {
    ...privateOrderFilterCompilers,
    ticketScanStatus: createInMemoryFilterCompiler('ticketScanStatus'),
    ticketScannedAt: createInMemoryFilterCompiler('ticketScannedAt'),
    ticketCount: createInMemoryFilterCompiler('tickets.length'),
};
