import { useTranslate } from '@stamhoofd/frontend-i18n';
import { usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import { AuditLogType, CheckoutMethodType, CheckoutMethodTypeHelper, DocumentStatus, DocumentStatusHelper, EventNotificationStatus, EventNotificationStatusHelper, EventNotificationType, FilterWrapperMarker, getAuditLogTypeName, LoadedPermissions, MemberResponsibility, OrderStatus, OrderStatusHelper, Organization, PaymentMethod, PaymentMethodHelper, PaymentStatus, PaymentStatusHelper, Platform, RecordCategory, RecordType, SetupStepType, StamhoofdCompareValue, StamhoofdFilter, unwrapFilter, User, WebshopPreview } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { Gender } from '../../../../../shared/structures/esm/dist/src/members/Gender';
import { AppType } from '../context';
import { useFinancialSupportSettings } from '../groups';
import { useAuth, useContext, useOrganization, usePlatform, useUser } from '../hooks';
import { DateFilterBuilder } from './DateUIFilter';
import { GroupUIFilterBuilder } from './GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterMode, MultipleChoiceUIFilterOption } from './MultipleChoiceUIFilter';
import { NumberFilterBuilder, NumberFilterFormat } from './NumberUIFilter';
import { StringFilterBuilder } from './StringUIFilter';
import { UIFilter, UIFilterBuilder, UIFilterBuilders } from './UIFilter';

export const paymentsUIFilterBuilders: UIFilterBuilders = [
    new MultipleChoiceFilterBuilder({
        name: 'Betaalmethode',
        options: Object.values(PaymentMethod).map((method) => {
            return new MultipleChoiceUIFilterOption(PaymentMethodHelper.getNameCapitalized(method), method);
        }),
        wrapper: {
            method: {
                $in: FilterWrapperMarker,
            },
        },
    }),

    new MultipleChoiceFilterBuilder({
        name: 'Status',
        options: Object.values(PaymentStatus).map((method) => {
            return new MultipleChoiceUIFilterOption(PaymentStatusHelper.getNameCapitalized(method), method);
        }),
        wrapper: {
            status: {
                $in: FilterWrapperMarker,
            },
        },
    }),
];

// Recursive: self referencing groups
paymentsUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: paymentsUIFilterBuilders,
    }),
);

// This one should match memberWithRegistrationsBlobInMemoryFilterCompilers
export const memberWithRegistrationsBlobUIFilterBuilders: UIFilterBuilders = [
    new NumberFilterBuilder({
        name: 'Leeftijd',
        key: 'age',
    }),
    new DateFilterBuilder({
        name: 'Geboortedatum',
        key: 'birthDay',
    }),
    new MultipleChoiceFilterBuilder({
        name: 'Gender',
        options: [
            new MultipleChoiceUIFilterOption('Vrouw', Gender.Female),
            new MultipleChoiceUIFilterOption('Man', Gender.Male),
            new MultipleChoiceUIFilterOption('Andere', Gender.Other),
        ],
        wrapper: {
            gender: {
                $in: FilterWrapperMarker,
            },
        },
    }),
];

// Recursive: self referencing groups
memberWithRegistrationsBlobUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: memberWithRegistrationsBlobUIFilterBuilders,
    }),
);

// This one should match registrationInMemoryFilterCompilers
export const registrationUIFilterBuilders: UIFilterBuilders = [
    // tood
];

// Recursive: self referencing groups
registrationUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: registrationUIFilterBuilders,
    }),
);

export function useAdvancedRegistrationsUIFilterBuilders() {
    const $platform = usePlatform();
    const $user = useUser();
    const $t = useTranslate();
    const manager = usePlatformManager();
    const owner = useRequestOwner();
    const loading = ref(true);

    manager.value.loadPeriods(false, true, owner).then(() => {
        loading.value = false;
    }).catch((e) => {
        console.error('Failed to load periods in useAdvancedRegistrationsUIFilterBuilders', e);
    });

    return {
        loading,
        filterBuilders: computed(() => {
            const platform = $platform.value;
            const user = $user.value;
            const hasPlatformPermissions = (user?.permissions?.platform !== null);

            const all = [];
            all.push(
                new StringFilterBuilder({
                    name: $t('2f2899e5-4c62-4452-97d2-97f4fd670e86'),
                    key: 'organizationId',
                    allowCreation: false,
                    wrapper: FilterWrapperMarker,
                }),
            );

            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t('322dd34f-a4ec-4065-be53-040725915e20'),
                    options: (platform.periods ?? []).map((period) => {
                        return new MultipleChoiceUIFilterOption(period.nameShort, period.id);
                    }),
                    allowCreation: hasPlatformPermissions,
                    wrapper: {
                        periodId: { $in: FilterWrapperMarker },
                    },
                    additionalUnwrappers: [
                        {
                            periodId: FilterWrapperMarker,
                        },
                    ],
                }),
            );

            all.push(
                new StringFilterBuilder({
                    name: $t('05723781-9357-41b2-9fb8-cb4f80dde7f9'),
                    key: 'uri',
                    allowCreation: hasPlatformPermissions,
                    wrapper: {
                        organization: FilterWrapperMarker,
                    },
                }),
            );

            all.push(
                new StringFilterBuilder({
                    name: $t('47754708-6f27-4afd-b9fe-600a209cb980'),
                    key: 'name',
                    allowCreation: hasPlatformPermissions,
                    wrapper: {
                        organization: FilterWrapperMarker,
                    },
                }),
            );

            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t('ec2de613-f06f-4d9a-888a-40f98b6b3727'),
                    multipleChoiceConfiguration: {
                        isSubjectPlural: true,
                    },
                    options: platform.config.tags.map((tag) => {
                        return new MultipleChoiceUIFilterOption(tag.name, tag.id);
                    }),
                    allowCreation: hasPlatformPermissions,
                    wrapper: {
                        organization: {
                            tags: {
                                $in: FilterWrapperMarker,
                            },
                        },
                    },
                }),
            );

            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t('6705ae0e-8239-4bc0-895d-10128cb5c6c4'),
                    options: platform.config.defaultAgeGroups.map((group) => {
                        return new MultipleChoiceUIFilterOption(group.name, group.id);
                    }),
                    wrapper: {
                        group: {
                            defaultAgeGroupId: {
                                $in: FilterWrapperMarker,
                            },
                        },
                    },
                }),
            );

            all.push(
                new StringFilterBuilder({
                    name: $t('446b88a9-50f5-4c2b-a9e8-742f12034863'),
                    key: 'name',
                    wrapper: {
                        group: FilterWrapperMarker,
                    },
                }),
            );

            all.unshift(
                new GroupUIFilterBuilder({
                    builders: all,
                }),
            );

            return all;
        }),
    };
}

export function useAdvancedMemberWithRegistrationsBlobUIFilterBuilders() {
    const $platform = usePlatform();
    const $user = useUser();
    const $t = useTranslate();
    const { loading, filterBuilders: registrationFilters } = useAdvancedRegistrationsUIFilterBuilders();
    const financialSupportSettings = useFinancialSupportSettings();
    const auth = useAuth();
    const organization = useOrganization();

    const filterResponsibilities = (responsibilities: MemberResponsibility[]) => {
        return responsibilities.filter((r) => {
            if (organization.value === null) {
                return true;
            }

            if (r.organizationTagIds !== null) {
                return organization.value.meta.matchTags(r.organizationTagIds);
            }

            return true;
        });
    };

    return {
        loading,
        filterBuilders: computed(() => {
            const platform = $platform.value;
            const user = $user.value;

            const all = [
                ...memberWithRegistrationsBlobUIFilterBuilders.slice(1),
            ];

            if (user?.permissions?.platform !== null) {
                all.push(
                    new MultipleChoiceFilterBuilder({
                        name: $t('b0cb950d-856f-4068-bf2f-9636927020f4'),
                        multipleChoiceConfiguration: {
                            isSubjectPlural: true,
                        },
                        options: filterResponsibilities(platform.config.responsibilities).map((responsibility) => {
                            return new MultipleChoiceUIFilterOption(responsibility.name, responsibility.id);
                        }),
                        wrapper: {
                            responsibilities: {
                                $elemMatch: {
                                    responsibilityId: {
                                        $in: FilterWrapperMarker,
                                    },
                                    endDate: null,
                                },
                            },
                        },
                    }),
                );

                for (const responsibility of filterResponsibilities(platform.config.responsibilities)) {
                    if (!responsibility.organizationBased || responsibility.defaultAgeGroupIds === null) {
                        continue;
                    }

                    all.push(
                        new MultipleChoiceFilterBuilder({
                            name: responsibility.name,
                            options: platform.config.defaultAgeGroups.filter(group => responsibility.defaultAgeGroupIds?.includes(group.id)).map((group) => {
                                return new MultipleChoiceUIFilterOption(group.name, group.id);
                            }),
                            wrapper: {
                                responsibilities: {
                                    $elemMatch: {
                                        responsibilityId: responsibility.id,
                                        endDate: null,
                                        group: {
                                            defaultAgeGroupId: {
                                                $in: FilterWrapperMarker,
                                            },
                                        },
                                    },
                                },
                            },
                        }),
                    );
                }
            }

            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t('11007b85-a7ac-48d8-9480-669831cef564'),
                    options: [
                        new MultipleChoiceUIFilterOption($t('6d4c31c6-c70b-4cf2-8890-b2d4507913c7'), 'Active'),
                        new MultipleChoiceUIFilterOption($t('cb1953f4-7e4f-498d-b8d8-54a885753e23'), 'Trial'),
                        new MultipleChoiceUIFilterOption($t('cc528c3f-aed3-4eb6-9db1-70aae5261a28'), 'Expiring'),
                        new MultipleChoiceUIFilterOption($t('33906077-a1d8-4daa-9914-ce129538f68c'), 'Inactive'),
                    ],
                    wrapFilter: (f: StamhoofdFilter) => {
                        const choices = Array.isArray(f) ? f : [f];

                        if (choices.length === 4 || choices.length === 0) {
                            return null;
                        }

                        const activeOrExpiringFilter: StamhoofdFilter = {
                            platformMemberships: {
                                $elemMatch: {
                                    startDate: {
                                        $lte: { $: '$now' },
                                    },
                                    endDate: {
                                        $gt: { $: '$now' },
                                    },
                                },
                            },
                        };

                        const activeOrExpiringFilterButNoTrial: StamhoofdFilter = {
                            platformMemberships: {
                                $elemMatch: {
                                    startDate: {
                                        $lte: { $: '$now' },
                                    },
                                    endDate: {
                                        $gt: { $: '$now' },
                                    },
                                    $or: [
                                        {
                                            trialUntil: null,
                                        },
                                        {
                                            trialUntil: {
                                                $lte: { $: '$now' },
                                            },
                                        },
                                    ],
                                },
                            },
                        };

                        if (choices.length === 3 && ['Active', 'Expiring', 'Trial'].every(x => choices.includes(x))) {
                            return activeOrExpiringFilter;
                        }

                        if (choices.length === 2 && ['Active', 'Expiring'].every(x => choices.includes(x))) {
                            return activeOrExpiringFilterButNoTrial;
                        }

                        if (choices.length === 2 && ['Active', 'Trial'].every(x => choices.includes(x))) {
                            return {
                                platformMemberships: {
                                    $elemMatch: {
                                        endDate: {
                                            $gt: { $: '$now' },
                                        },
                                        startDate: {
                                            $lte: { $: '$now' },
                                        },
                                        $or: [
                                            {
                                                expireDate: null,
                                            },
                                            {
                                                expireDate: {
                                                    $gt: { $: '$now' },
                                                },
                                            },
                                        ],
                                    },
                                },
                            };
                        }

                        const getFilter = (choice: StamhoofdFilter<StamhoofdCompareValue>): StamhoofdFilter => {
                            switch (choice) {
                                case 'Active': {
                                    return {
                                        platformMemberships: {
                                            $elemMatch: {
                                                $and: [
                                                    {
                                                        endDate: {
                                                            $gt: { $: '$now' },
                                                        },
                                                        startDate: {
                                                            $lte: { $: '$now' },
                                                        },
                                                        $or: [
                                                            {
                                                                expireDate: null,
                                                            },
                                                            {
                                                                expireDate: {
                                                                    $gt: { $: '$now' },
                                                                },
                                                            },
                                                        ],
                                                    },
                                                    {
                                                        $or: [
                                                            {
                                                                trialUntil: null,
                                                            },
                                                            {
                                                                trialUntil: {
                                                                    $lte: { $: '$now' },
                                                                },
                                                            },
                                                        ],
                                                    },
                                                ],
                                            },
                                        },
                                    };
                                }
                                case 'Trial': {
                                    return {
                                        platformMemberships: {
                                            $elemMatch: {
                                                endDate: {
                                                    $gt: { $: '$now' },
                                                },
                                                startDate: {
                                                    $lte: { $: '$now' },
                                                },
                                                $or: [
                                                    {
                                                        expireDate: null,
                                                    },
                                                    {
                                                        expireDate: {
                                                            $gt: { $: '$now' },
                                                        },
                                                    },
                                                ],
                                                trialUntil: {
                                                    $gt: { $: '$now' },
                                                },
                                            },
                                        },
                                    };
                                }
                                case 'Inactive': {
                                    return {
                                        $not: activeOrExpiringFilter,
                                    };
                                }
                                case 'Expiring': {
                                    return {
                                        $not: getFilter('Active'),
                                        platformMemberships: {
                                            $elemMatch: {
                                                endDate: {
                                                    $gte: { $: '$now' },
                                                },
                                                expireDate: {
                                                    $lt: { $: '$now' },
                                                },
                                            },
                                        },
                                    };
                                }
                                default: {
                                    return null;
                                }
                            }
                        };

                        const filters = choices.map(getFilter);

                        if (filters.length === 1) {
                            return filters[0];
                        }

                        return {
                            $or: filters,
                        };
                    },
                    unwrapFilter: (f: StamhoofdFilter): StamhoofdFilter | null => {
                        const activeAndExpiring = unwrapFilter(f, {
                            platformMemberships: {
                                $elemMatch: {
                                    endDate: {
                                        $gt: { $: '$now' },
                                    },
                                },
                            },
                        });

                        if (activeAndExpiring.match) {
                            return ['Active', 'Trial', 'Expiring'];
                        }

                        return null;
                    },
                }),
            );

            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t('b0ed8db1-097d-4739-9407-e8aae5e1413c'),
                    options: platform.config.membershipTypes.map((type) => {
                        return new MultipleChoiceUIFilterOption(type.name, type.id);
                    }),
                    wrapper: {
                        platformMemberships: {
                            $elemMatch: {
                                membershipTypeId: {
                                    $in: FilterWrapperMarker,
                                },
                                startDate: {
                                    $lte: { $: '$now' },
                                },
                                endDate: {
                                    $gt: { $: '$now' },
                                },
                                $or: [
                                    {
                                        expireDate: null,
                                    },
                                    {
                                        expireDate: {
                                            $gt: { $: '$now' },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                }),
            );

            all.push(
                new StringFilterBuilder({
                    name: $t('4824fef7-9c02-4a3f-b2fd-117857a7b82c'),
                    key: 'name',
                    wrapper: {
                        $or: [
                            {
                                'details.parents[0]': FilterWrapperMarker,
                            },
                            {
                                'details.parents[1]': FilterWrapperMarker,
                            },
                        ],
                    },
                }),
            );

            all.push(
                new StringFilterBuilder({
                    name: $t('d8d26405-9d24-4217-af9b-5a0edee0d35f'),
                    key: 'email',
                }),
            );

            all.push(
                new StringFilterBuilder({
                    name: $t('81082354-9a9a-4a23-aa02-3273d4906652'),
                    key: 'parentEmail',
                }),
            );

            all.push(
                new StringFilterBuilder({
                    name: $t('a783e1f8-b052-4278-87c9-e00fa4590e8c'),
                    key: 'phone',
                }),
            );

            all.push(
                new StringFilterBuilder({
                    name: $t('532568c8-345e-4675-ba5e-60014bbcf9ae'),
                    key: 'parentPhone',
                }),
            );

            all.push(
                new StringFilterBuilder({
                    name: $t('f8bfc32b-5bc4-4ccc-82ed-514dffd011c2'),
                    key: 'street',
                    wrapper: {
                        $or: [
                            {
                                'details.address': FilterWrapperMarker,
                            },
                            {
                                'details.parents[*].address': FilterWrapperMarker,
                            },
                        ],
                    },
                }),
            );

            all.push(
                new StringFilterBuilder({
                    name: $t('99ea968b-f820-4791-96c3-bb1033603013'),
                    key: 'number',
                    wrapper: {
                        $or: [
                            {
                                'details.address': FilterWrapperMarker,
                            },
                            {
                                'details.parents[*].address': FilterWrapperMarker,
                            },
                        ],
                    },
                }),
            );

            all.push(
                new StringFilterBuilder({
                    name: $t('f5c908ad-c996-4dc8-acc0-dae902f13495'),
                    key: 'city',
                    wrapper: {
                        $or: [
                            {
                                'details.address': FilterWrapperMarker,
                            },
                            {
                                'details.parents[*].address': FilterWrapperMarker,
                            },
                        ],
                    },
                }),
            );

            all.push(
                new StringFilterBuilder({
                    name: $t('28b0f035-cb44-48b7-b60f-093f6adc26fb'),
                    key: 'postalCode',
                    wrapper: {
                        $or: [
                            {
                                'details.address': FilterWrapperMarker,
                            },
                            {
                                'details.parents[*].address': FilterWrapperMarker,
                            },
                        ],
                    },
                }),
            );

            if (financialSupportSettings.enabled) {
                all.push(
                    new MultipleChoiceFilterBuilder({
                        name: financialSupportSettings.financialSupportSettings.value.title,
                        options: [
                            new MultipleChoiceUIFilterOption('Ingeschakeld', true),
                            new MultipleChoiceUIFilterOption('Uitgeschakeld', false),
                            new MultipleChoiceUIFilterOption('Onbepaald', null),
                        ],
                        wrapper: {
                            'details.requiresFinancialSupport': {
                                $in: FilterWrapperMarker,
                            },
                        },
                    }),
                );
            }

            all.push(
                new GroupUIFilterBuilder({
                    name: 'huidige inschrijving',
                    description: 'Filter op leden die een actieve inschrijving heeft die aan deze voorwaarden voldoet.',
                    builders: registrationFilters.value.filter(f => f.name !== 'Werkjaar'),
                    wrapper: {
                        registrations: {
                            $elemMatch: {
                                $and: [
                                    FilterWrapperMarker,
                                    {
                                        periodId: platform.period.id,
                                    },
                                ],
                            },
                        },
                    },
                }),
            );

            if (auth.hasFullAccess()) {
                all.push(
                    new GroupUIFilterBuilder({
                        name: 'historische inschrijving',
                        description: $t('1316502a-5502-49ec-96fe-93e60cb94268'),
                        builders: registrationFilters.value,
                        wrapper: {
                            registrations: {
                                $elemMatch: FilterWrapperMarker,
                            },
                        },
                    }),
                );
            }

            if (user?.permissions?.platform !== null) {
                const responsibilitiesFilters: typeof all = [];

                responsibilitiesFilters.push(
                    new MultipleChoiceFilterBuilder({
                        name: $t('619d07b4-4512-4ca5-933c-93203421ac54'),
                        multipleChoiceConfiguration: {
                            isSubjectPlural: false,
                        },
                        options: platform.config.responsibilities.map((responsibility) => {
                            return new MultipleChoiceUIFilterOption(responsibility.name, responsibility.id);
                        }),
                        wrapper: {
                            responsibilityId: {
                                $in: FilterWrapperMarker,
                            },
                        },
                    }),
                );

                for (const responsibility of platform.config.responsibilities) {
                    if (!responsibility.organizationBased || responsibility.defaultAgeGroupIds === null) {
                        continue;
                    }

                    responsibilitiesFilters.push(
                        new MultipleChoiceFilterBuilder({
                            name: responsibility.name,
                            options: platform.config.defaultAgeGroups.filter(group => responsibility.defaultAgeGroupIds?.includes(group.id)).map((group) => {
                                return new MultipleChoiceUIFilterOption(group.name, group.id);
                            }),
                            wrapper: {
                                responsibilityId: responsibility.id,
                                group: {
                                    defaultAgeGroupId: {
                                        $in: FilterWrapperMarker,
                                    },
                                },
                            },
                        }),
                    );
                }

                responsibilitiesFilters.push(
                    new DateFilterBuilder({
                        name: $t('300d2935-b578-48cc-b58e-1c0446a68d59'),
                        key: 'startDate',
                    }),
                );

                responsibilitiesFilters.push(
                    new DateFilterBuilder({
                        name: $t('85dcdb87-b504-43b6-8a52-c22a046eefad'),
                        key: 'endDate',
                    }),
                );

                responsibilitiesFilters.unshift(
                    new GroupUIFilterBuilder({
                        builders: responsibilitiesFilters,
                    }),
                );

                all.push(
                    new GroupUIFilterBuilder({
                        name: 'historische functie',
                        description: 'Filter op leden die een functie hadden die aan deze voorwaarden voldoet.',
                        builders: responsibilitiesFilters,
                        wrapper: {
                            responsibilities: {
                                $elemMatch: FilterWrapperMarker,
                            },
                        },
                    }),
                );
            }

            all.unshift(
                new GroupUIFilterBuilder({
                    builders: all,
                }),
            );

            return all;
        }),
    };
}

//
// CHECKOUT
//

// This one should match memberWithRegistrationsBlobInMemoryFilterCompilers
export const checkoutUIFilterBuilders: UIFilterBuilders = [
    // todo
];

// Recursive: self referencing groups
checkoutUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: checkoutUIFilterBuilders,
    }),
);

// Cached outstanding balances

export const cachedOutstandingBalanceUIFilterBuilders: UIFilterBuilders = [
    new NumberFilterBuilder({
        name: 'Openstaand bedrag',
        type: NumberFilterFormat.Currency,
        key: 'amountOpen',
    }),
    new NumberFilterBuilder({
        name: 'Bedrag in verwerking',
        type: NumberFilterFormat.Currency,
        key: 'amountPending',
    }),
    /* new MultipleChoiceFilterBuilder({
        name: 'Type',
        options: [
            new MultipleChoiceUIFilterOption('Verenigingen', ReceivableBalanceType.organization),
            new MultipleChoiceUIFilterOption('Leden', ReceivableBalanceType.member),
            new MultipleChoiceUIFilterOption('Accounts', ReceivableBalanceType.user),
        ],
        wrapper: {
            objectType: {
                $in: FilterWrapperMarker,
            },
        },
    }), */
];

cachedOutstandingBalanceUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: cachedOutstandingBalanceUIFilterBuilders,
    }),
);

//
// ORGANIZATIONS
//

const organizationMemberUIFilterBuilders: UIFilterBuilders = [
    new StringFilterBuilder({
        name: 'Naam',
        key: 'name',
    }),
    new StringFilterBuilder({
        name: 'Voornaam',
        key: 'firstName',
    }),
    new StringFilterBuilder({
        name: 'Achternaam',
        key: 'lastName',
    }),
    new StringFilterBuilder({
        name: 'E-mailadres',
        key: 'email',
    }),
];

export function useGetOrganizationUIFilterBuilders() {
    const $t = useTranslate();
    const platform = usePlatform();

    const setupStepFilterNameMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('be92d7b0-92ad-42d6-b9e2-b414671ac57d'),
        [SetupStepType.Companies]: $t('6313a021-6795-4b7e-842c-f4574e433324'),
        [SetupStepType.Groups]: $t('b6458e9c-2ddf-4cb0-8051-fb6a220c4127'),
        [SetupStepType.Premises]: $t('7f531562-9609-456e-a8c3-2b373cad3f29'),
        [SetupStepType.Emails]: $t('36a44efc-4cb0-4180-8678-938cc51d3ae8'),
        [SetupStepType.Payment]: $t('d951a3d6-58f6-4e56-a482-2b8652ddd3bf'),
        [SetupStepType.Registrations]: $t('98a4f650-2fc9-455f-8454-dfe7a8140faa'),
    };

    const getOrganizationUIFilterBuilders = (user: User | null) => {
        const all = [
            new StringFilterBuilder({
                name: 'Naam',
                key: 'name',
            }),

            new StringFilterBuilder({
                name: 'Gemeente',
                key: 'city',
            }),

            new StringFilterBuilder({
                name: 'Postcode',
                key: 'postalCode',
            }),

            new StringFilterBuilder({
                name: $t('5e99e2aa-a240-4894-8de3-f8f0fef20068'),
                key: 'uri',
            }),

            new GroupUIFilterBuilder({
                name: 'Leden',
                description: $t('6bf80a05-84b0-47ba-ad41-66e2a106669b'),
                builders: organizationMemberUIFilterBuilders,
                wrapper: {
                    members: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }),
            new MultipleChoiceFilterBuilder({
                name: 'Actief',
                options: [
                    new MultipleChoiceUIFilterOption('Actief', 1),
                    new MultipleChoiceUIFilterOption('Inactief', 0),
                ],
                wrapper: {
                    active: {
                        $in: FilterWrapperMarker,
                    },
                },
            })];

        if (user?.permissions?.platform !== null) {
            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t('ec2de613-f06f-4d9a-888a-40f98b6b3727'),
                    multipleChoiceConfiguration: {
                        isSubjectPlural: true,
                    },
                    options: platform.value.config.tags.map((tag) => {
                        return new MultipleChoiceUIFilterOption(tag.name, tag.id);
                    }),
                    wrapper: {
                        tags: {
                            $in: FilterWrapperMarker,
                        },
                    },
                }),
            );

            all.push(
                new MultipleChoiceFilterBuilder({
                    name: 'Voltooide vlagmomenten',
                    multipleChoiceConfiguration: {
                        isSubjectPlural: true,
                        mode: MultipleChoiceUIFilterMode.And,
                        showOptionSelectAll: true,
                    },
                    options: Object.entries(setupStepFilterNameMap).map(
                        ([k, v]) =>
                            new MultipleChoiceUIFilterOption(
                                v,
                                k as SetupStepType,
                            ),
                    ),
                    wrapFilter: (f: StamhoofdFilter) => {
                        const choices = Array.isArray(f) ? f : [f];

                        return {
                            setupSteps: {
                                $elemMatch: {
                                    periodId: {
                                        $eq: platform.value.period.id,
                                    },
                                    ...Object.fromEntries(
                                        Object.values(SetupStepType)
                                            .filter(
                                                x => choices.includes(x),
                                            )
                                            .map((setupStep) => {
                                                return [
                                                    setupStep,
                                                    {
                                                        reviewedAt: {
                                                            $neq: null,
                                                        },
                                                        complete: true,
                                                    },
                                                ];
                                            }),
                                    ),
                                },
                            },
                        };
                    },
                    unwrapFilter: (f: StamhoofdFilter): StamhoofdFilter | null => {
                        if (typeof f !== 'object') return null;

                        const elemMatch = (f as any).setupSteps?.$elemMatch;
                        if (!elemMatch) return null;

                        const periodId = elemMatch.periodId?.$eq;
                        if (periodId !== platform.value.period.id) return null;

                        const enumValues = Object.values(SetupStepType);
                        const stringifiedValueToMatch = JSON.stringify({
                            reviewedAt: { $neq: null },
                            complete: true,
                        });

                        const results: SetupStepType[] = [];

                        for (const [key, value] of Object.entries(elemMatch)) {
                            if (enumValues.includes(key as SetupStepType)) {
                                if (JSON.stringify(value) === stringifiedValueToMatch) {
                                    results.push(key as SetupStepType);
                                }
                                else {
                                    return null;
                                }
                            }
                            else if (key !== 'periodId') {
                                return null;
                            }
                        }

                        if (results.length) {
                            return results;
                        }

                        return null;
                    },
                },
                ),
            );
        }

        // Recursive: self referencing groups
        all.unshift(
            new GroupUIFilterBuilder({
                builders: all,
            }),
        );

        return all;
    };

    return { getOrganizationUIFilterBuilders };
}

export function getOrganizationUIFilterBuildersForTags(platform: Platform) {
    const $t = useTranslate();

    const all: UIFilterBuilder[] = [];

    const tagFilter = new MultipleChoiceFilterBuilder({
        name: $t('ceba695c-105b-49c9-aaa4-bf716c4aec6b'),
        multipleChoiceConfiguration: {
            isSubjectPlural: true,
        },
        options: platform.config.tags.map(tag => new MultipleChoiceUIFilterOption(tag.name, tag.id)),
        wrapper: {
            tags: {
                $in: FilterWrapperMarker,
            },
        },
    });

    all.push(tagFilter);

    all.unshift(
        new GroupUIFilterBuilder({
            builders: all,
        }),
    );

    return all;
}

// Events
export function useEventUIFilterBuilders({ platform, organizations, app }: { platform: Platform; organizations: Organization[]; app: AppType | 'auto' }) {
    const context = useContext();

    return computed(() => getEventUIFilterBuilders({ platform, organizations, app, permissions: context.value.auth.permissions }));
}

function getEventUIFilterBuilders({ platform, organizations, app, permissions }: { platform: Platform; organizations: Organization[]; app: AppType | 'auto'; permissions: LoadedPermissions | null | undefined }) {
    const all: UIFilterBuilder<UIFilter>[] = [];

    const groupFilter = new MultipleChoiceFilterBuilder({
        name: 'Lokale groep',
        options: [
            new MultipleChoiceUIFilterOption('Nationale activiteiten', null),
            ...organizations.map(org => new MultipleChoiceUIFilterOption(org.name, org.id)),
        ],
        wrapper: {
            organizationId: {
                $in: FilterWrapperMarker,
            },
        },
    });
    all.push(groupFilter);

    const tagsFilter = new MultipleChoiceFilterBuilder({
        name: 'Regio',
        options: [
            new MultipleChoiceUIFilterOption('Alles', null),
            ...platform.config.tags.map(tag => new MultipleChoiceUIFilterOption(tag.name, tag.id)),
        ],
        wrapper: {
            organizationTagIds: {
                $in: FilterWrapperMarker,
            },
        },
    });

    all.push(tagsFilter);

    const allTags = organizations.flatMap(organization => organization.meta.tags);

    const defaultAgeGroupFilter = new MultipleChoiceFilterBuilder({
        name: 'Standaard leeftijdsgroep',
        options: [
            new MultipleChoiceUIFilterOption('Iedereen', null),
            ...platform.config.defaultAgeGroups.filter(defaultAgeGroup => defaultAgeGroup.isEnabledForTags(allTags)).map(g => new MultipleChoiceUIFilterOption(g.name, g.id)),
        ],
        wrapper: {
            defaultAgeGroupIds: {
                $in: FilterWrapperMarker,
            },
        },
    });
    all.push(defaultAgeGroupFilter);

    if (organizations.length > 0) {
        const groupFilter = new MultipleChoiceFilterBuilder({
            name: 'Inschrijvingsgroep',
            options: [
                new MultipleChoiceUIFilterOption('Iedereen', null),
                ...organizations
                    .flatMap(organization => organization.period.getCategoryTree({ permissions }).getAllGroups().map((g) => {
                        return new MultipleChoiceUIFilterOption((organizations.length > 1 ? (organization.name + ' - ') : '') + g.settings.name, g.id);
                    })),
            ],
            wrapper: {
                groupIds: {
                    $in: FilterWrapperMarker,
                },
            },
        });
        all.push(groupFilter);
    }

    if (app !== 'registration') {
        const typeFilter = new MultipleChoiceFilterBuilder({
            name: 'Type',
            options: [
                ...platform.config.eventTypes.map(type => new MultipleChoiceUIFilterOption(type.name, type.id)),
            ],
            wrapper: {
                typeId: {
                    $in: FilterWrapperMarker,
                },
            },
        });

        all.push(typeFilter);
    }

    all.unshift(
        new GroupUIFilterBuilder({
            builders: all,
        }),
    );

    return all;
}

// Events
export function useAuditLogUIFilterBuilders() {
    const all: UIFilterBuilder<UIFilter>[] = [];

    const typeFilter = new MultipleChoiceFilterBuilder({
        name: 'Type',
        options: [
            ...Object.values(AuditLogType).map(type => new MultipleChoiceUIFilterOption(getAuditLogTypeName(type), type)),
        ],
        wrapper: {
            type: {
                $in: FilterWrapperMarker,
            },
        },
    });

    all.push(typeFilter);

    all.unshift(
        new GroupUIFilterBuilder({
            builders: all,
        }),
    );

    return all;
}

export function getWebshopOrderUIFilterBuilders(preview: WebshopPreview) {
    const builders: UIFilterBuilders = [
        new NumberFilterBuilder({
            name: '#',
            key: 'number',
        }),
        new MultipleChoiceFilterBuilder({
            name: 'Status',
            options: Object.values(OrderStatus)
                .filter(s => s !== OrderStatus.Deleted)
                .map((status) => {
                    return new MultipleChoiceUIFilterOption(Formatter.capitalizeFirstLetter(OrderStatusHelper.getName(status)), status);
                }),
            wrapper: {
                status: {
                    $in: FilterWrapperMarker,
                },
            },
        }),
        new StringFilterBuilder({
            name: 'Naam',
            key: 'name',
        }),
        new StringFilterBuilder({
            name: 'E-mailadres',
            key: 'email',
        }),
    ];

    if (preview.meta.phoneEnabled) {
        builders.push(new StringFilterBuilder({
            name: 'Telefoonnummer',
            key: 'phone',
        }));
    }

    builders.push(new MultipleChoiceFilterBuilder({
        name: 'Betaalmethode',
        options: Object.values(PaymentMethod).map((paymentMethod) => {
            return new MultipleChoiceUIFilterOption(PaymentMethodHelper.getNameCapitalized(paymentMethod), paymentMethod);
        }),
        wrapper: {
            paymentMethod: {
                $in: FilterWrapperMarker,
            },
        },
    }));

    const distinctCheckoutMethods = Formatter.uniqueArray(preview.meta.checkoutMethods.map(m => m.type));

    if (distinctCheckoutMethods.length > 1) {
        builders.push(new MultipleChoiceFilterBuilder({
            name: 'Methode',
            options: distinctCheckoutMethods.map((checkoutMethod) => {
                return new MultipleChoiceUIFilterOption(Formatter.capitalizeFirstLetter(CheckoutMethodTypeHelper.getName(checkoutMethod)), checkoutMethod);
            }),
            wrapper: {
                checkoutMethod: {
                    $in: FilterWrapperMarker,
                },
            },
        }));
    }

    builders.push(
        new DateFilterBuilder({
            name: 'Besteldatum',
            key: 'validAt',
        }),
        new NumberFilterBuilder({
            name: 'Bedrag',
            key: 'totalPrice',
            type: NumberFilterFormat.Currency,
        }),
        new NumberFilterBuilder({
            name: 'Aantal',
            key: 'amount',
        }),
    );

    const timeCount = Formatter.uniqueArray(preview.meta.checkoutMethods.flatMap(method => method.timeSlots.timeSlots).map(t => t.timeRangeString())).length;
    const dateCount = Formatter.uniqueArray(preview.meta.checkoutMethods.flatMap(method => method.timeSlots.timeSlots).map(t => t.dateString())).length;

    const hasDelivery = preview.meta.checkoutMethods.some(method => method.type === CheckoutMethodType.Delivery);

    // Count checkoutmethods that are not delivery
    const nonDeliveryCount = preview.meta.checkoutMethods.filter(method => method.type !== CheckoutMethodType.Delivery).length;

    if (dateCount > 1) {
        builders.push(
            new DateFilterBuilder({
                name: (hasDelivery && nonDeliveryCount > 0) ? 'Afhaal/leverdatum' : (hasDelivery ? 'Leverdatum' : 'Afhaaldatum'),
                key: 'timeSlotDate',
            }));
    }

    if (timeCount > 1) {
        // todo: change sort of timeSlotTime => should take start time into account => composite key or generated index maybe?
        // todo: maybe group
        builders.push(
            new NumberFilterBuilder({
                name: 'Tijdstip einde',
                key: 'timeSlotEndTime',
                type: NumberFilterFormat.TimeMinutes,
            }));

        builders.push(
            new NumberFilterBuilder({
                name: 'Tijdstip start',
                key: 'timeSlotStartTime',
                type: NumberFilterFormat.TimeMinutes,
            }));
    }

    const groupFilter = new GroupUIFilterBuilder({ builders });

    return [groupFilter, ...builders];
}

export function getDocumentsUIFilterBuilders() {
    const builders: UIFilterBuilders = [
        new StringFilterBuilder({
            name: 'Volgnummer',
            key: 'id',
        }),
        new NumberFilterBuilder({
            name: 'Nummer',
            key: 'number',
        }),
        new StringFilterBuilder({
            name: 'Beschrijving',
            key: 'description',
        }),
        new MultipleChoiceFilterBuilder({
            name: 'status',
            options: Object.values(DocumentStatus).map((status) => {
                return new MultipleChoiceUIFilterOption(
                    Formatter.capitalizeFirstLetter(DocumentStatusHelper.getName(status)),
                    status,
                );
            }),
            wrapper: {
                status: {
                    $in: FilterWrapperMarker,
                },
            },
        }),
    ];
    const groupFilter = new GroupUIFilterBuilder({ builders });

    return [groupFilter, ...builders];
}

export function getFilterBuildersForRecordCategories(categories: RecordCategory[]) {
    const all: UIFilterBuilder<UIFilter>[] = [];

    for (const category of categories) {
        const allForCategory: UIFilterBuilder<UIFilter>[] = [];

        for (const record of category.records) {
            if (record.type === RecordType.Checkbox) {
                allForCategory.push(
                    new MultipleChoiceFilterBuilder({
                        name: record.name,
                        options: [
                            new MultipleChoiceUIFilterOption($t('Aangevinkt'), true),
                            new MultipleChoiceUIFilterOption($t('Niet aangevinkt'), false),
                        ],
                        wrapper: {
                            recordAnswers: {
                                [record.id]: {
                                    selected: { $in: FilterWrapperMarker },
                                },
                            },
                        },
                    }),
                );
            }
        }

        allForCategory.push(
            ...getFilterBuildersForRecordCategories(category.childCategories),
        );

        if (allForCategory.length > 0) {
            all.push(
                new GroupUIFilterBuilder({
                    name: category.name,
                    builders: allForCategory,
                }),
            );
        }
    }

    return all;
}

/**
 * These filters are compatible with the SQLFilter in the backend
 */
export function useEventNotificationBackendFilterBuilders() {
    const platform = usePlatform();

    return () => {
        const all: UIFilterBuilders = [
            new DateFilterBuilder({
                name: $t('86983e38-4283-4f0a-bd1d-f48f050d3681'),
                key: 'startDate',
            }),
            new DateFilterBuilder({
                name: $t('c15040b1-3202-45a8-8d30-030a4e4c5f9c'),
                key: 'endDate',
            }),
            new MultipleChoiceFilterBuilder({
                name: $t('b8edf1c5-ebc8-4aae-83c1-249c08db529d'),
                options: [
                    ...platform.value.config.eventTypes.map((eventType) => {
                        return new MultipleChoiceUIFilterOption(eventType.name, eventType.id);
                    }),
                ],
                wrapper: {
                    events: {
                        $elemMatch: {
                            typeId: {
                                $in: FilterWrapperMarker,
                            },
                        },
                    },
                },
            }),
            new MultipleChoiceFilterBuilder({
                name: $t('fde0cfa6-c279-4eef-ab75-8f62fd4028a8'),
                options: [
                    ...Object.values(EventNotificationStatus).map((status) => {
                        return new MultipleChoiceUIFilterOption(
                            Formatter.capitalizeFirstLetter(EventNotificationStatusHelper.getName(status)),
                            status,
                        );
                    }),
                ],
                wrapper: {
                    status: {
                        $in: FilterWrapperMarker,
                    },
                },
            }),
            new MultipleChoiceFilterBuilder({
                name: $t('cef37396-3c75-4a85-b14e-d1f7cfb9e546'),
                multipleChoiceConfiguration: {
                    isSubjectPlural: true,
                },
                options: platform.value.config.tags.map(tag => new MultipleChoiceUIFilterOption(tag.name, tag.id)),
                wrapper: {
                    organization: {
                        $elemMatch: {
                            tags: {
                                $in: FilterWrapperMarker,
                            },
                        },
                    },
                },
            }),
            new StringFilterBuilder({
                name: $t('05723781-9357-41b2-9fb8-cb4f80dde7f9'),
                key: 'uri',
                wrapper: {
                    organization: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }),

            new StringFilterBuilder({
                name: $t('47754708-6f27-4afd-b9fe-600a209cb980'),
                key: 'name',
                wrapper: {
                    organization: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }),
        ];

        // Recursive: self referencing groups
        all.unshift(
            new GroupUIFilterBuilder({
                builders: all,
            }),
        );

        return all;
    };
}

/**
 * These filters are compatible with the SQLFilter in the backend
 */
export function useEventNotificationInMemoryFilterBuilders() {
    const platform = usePlatform();

    return (type: EventNotificationType) => {
        const all: UIFilterBuilders = [
            new DateFilterBuilder({
                name: $t('86983e38-4283-4f0a-bd1d-f48f050d3681'),
                key: 'startDate',
            }),
            new DateFilterBuilder({
                name: $t('c15040b1-3202-45a8-8d30-030a4e4c5f9c'),
                key: 'endDate',
            }),
            new MultipleChoiceFilterBuilder({
                name: $t('b8edf1c5-ebc8-4aae-83c1-249c08db529d'),
                options: [
                    ...platform.value.config.eventTypes.map((eventType) => {
                        return new MultipleChoiceUIFilterOption(eventType.name, eventType.id);
                    }),
                ],
                wrapper: {
                    events: {
                        $elemMatch: {
                            typeId: {
                                $in: FilterWrapperMarker,
                            },
                        },
                    },
                },
            }),
        ];

        if (type) {
            // Also include complex filters
            all.push(...getFilterBuildersForRecordCategories(type.recordCategories));
        }

        // Recursive: self referencing groups
        all.unshift(
            new GroupUIFilterBuilder({
                builders: all,
            }),
        );

        return all;
    };
}
