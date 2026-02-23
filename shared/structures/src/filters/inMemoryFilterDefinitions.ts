import { InMemoryFilterDefinitions, baseInMemoryFilterCompilers, createInMemoryFilterCompiler, createInMemoryWildcardCompilerSelector } from './InMemoryFilter.js';

// This should match the backend logica. Some things that might be possible in the 'in memory' compilers, are not possible in the SQL compilers.
// so that is why we don't support $elemMatch inside selectedChoices - this has been replaced with a wildcard selector instead.
export const recordAnswerItemFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    selected: createInMemoryFilterCompiler('selected'),
    selectedChoice: createInMemoryFilterCompiler('selectedChoice', {
        ...baseInMemoryFilterCompilers,
        id: createInMemoryFilterCompiler('id'),
    }),
    selectedChoices: {
        ...baseInMemoryFilterCompilers,
        id: createInMemoryFilterCompiler('selectedChoices.*.id'),
    },
    value: createInMemoryFilterCompiler('value'),
};

export const recordAnswersFilterCompilers: InMemoryFilterDefinitions = {
    recordAnswers: createInMemoryFilterCompiler('recordAnswers', createInMemoryWildcardCompilerSelector(recordAnswerItemFilterCompilers)),
};

export const memberWithRegistrationsBlobInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    age: createInMemoryFilterCompiler('details.defaultAge'),
    gender: createInMemoryFilterCompiler('details.gender'),
    birthDay: createInMemoryFilterCompiler('details.birthDay'),
    missingData: createInMemoryFilterCompiler('details.missingData'),
    recordAnswers: createInMemoryFilterCompiler('details.recordAnswers', createInMemoryWildcardCompilerSelector(recordAnswerItemFilterCompilers)),
};

export const registrationInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
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
    paymentMethod: createInMemoryFilterCompiler('data.paymentMethod'),
    checkoutMethod: createInMemoryFilterCompiler('data.checkoutMethod.type'),
    checkoutMethodId: createInMemoryFilterCompiler('data.checkoutMethod.id'),
    timeSlotDate: createInMemoryFilterCompiler('data.timeSlot.date'),
    validAt: createInMemoryFilterCompiler('validAt'),
    name: createInMemoryFilterCompiler('data.customer.name'),
    email: createInMemoryFilterCompiler('data.customer.email'),
    phone: createInMemoryFilterCompiler('data.customer.phone'),
    totalPrice: createInMemoryFilterCompiler('data.totalPrice'),
    amount: createInMemoryFilterCompiler('data.amount'),
    timeSlotTime: createInMemoryFilterCompiler('data.timeSlot.timeIndex'),
    openBalance: createInMemoryFilterCompiler('openBalance'),
    location: createInMemoryFilterCompiler('data.locationName'),
    paidAt: createInMemoryFilterCompiler('paidAt'),

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
    recordAnswers: createInMemoryFilterCompiler('data.recordAnswers', createInMemoryWildcardCompilerSelector(recordAnswerItemFilterCompilers)),
};
