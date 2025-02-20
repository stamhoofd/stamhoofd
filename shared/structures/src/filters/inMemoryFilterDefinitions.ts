import { InMemoryFilterDefinitions, baseInMemoryFilterCompilers, createInMemoryFilterCompiler, createInMemoryWildcardCompilerSelector } from './InMemoryFilter.js';

export const recordAnswerItemFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    selected: createInMemoryFilterCompiler('selected'),
    selectedChoice: createInMemoryFilterCompiler('selectedChoice', {
        ...baseInMemoryFilterCompilers,
        id: createInMemoryFilterCompiler('id'),
    }),
    selectedChoices: createInMemoryFilterCompiler('selectedChoices', {
        ...baseInMemoryFilterCompilers,
        id: createInMemoryFilterCompiler('id'),
    }),
};

export const recordAnswersFilterCompilers: InMemoryFilterDefinitions = {
    recordAnswers: createInMemoryFilterCompiler('recordAnswers', createInMemoryWildcardCompilerSelector(recordAnswerItemFilterCompilers)),
};

export const memberWithRegistrationsBlobInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    age: createInMemoryFilterCompiler('details.defaultAge'),
    gender: createInMemoryFilterCompiler('details.gender'),
    birthDay: createInMemoryFilterCompiler('details.birthDay'),
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

export const checkoutInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
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
