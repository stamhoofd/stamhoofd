import { useTranslate } from '@stamhoofd/frontend-i18n';
import { usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import { AuditLogType, CheckoutMethodType, CheckoutMethodTypeHelper, DocumentStatus, DocumentStatusHelper, EventNotificationStatus, EventNotificationStatusHelper, EventNotificationType, FilterWrapperMarker, getAuditLogTypeName, Group, LoadedPermissions, MemberResponsibility, OrderStatus, OrderStatusHelper, Organization, OrganizationRecordsConfiguration, PaymentMethod, PaymentMethodHelper, PaymentStatus, PaymentStatusHelper, Platform, RecordCategory, RecordType, SetupStepType, StamhoofdCompareValue, StamhoofdFilter, unwrapFilter, User, WebshopPreview } from '@stamhoofd/structures';
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
        name: $t(`07e7025c-0bfb-41be-87bc-1023d297a1a2`),
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
        name: $t(`e4b54218-b4ff-4c29-a29e-8bf9a9aef0c5`),
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
        name: $t(`e96d9ea7-f8cc-42c6-b23d-f46e1a56e043`),
        key: 'age',
    }),
    new DateFilterBuilder({
        name: $t(`f3b87bd8-e36c-4fb8-917f-87b18ece750e`),
        key: 'birthDay',
    }),
    new MultipleChoiceFilterBuilder({
        name: $t(`fd3fea4f-73c7-4c8d-90cd-80ea90e53b98`),
        options: [
            new MultipleChoiceUIFilterOption($t(`06466432-eca6-41d0-a3d6-f262f8d6d2ac`), Gender.Female),
            new MultipleChoiceUIFilterOption($t(`b54b9706-4c0c-46a6-9027-37052eb76b28`), Gender.Male),
            new MultipleChoiceUIFilterOption($t(`8f7475aa-c110-49b2-8017-1a6dd0fe72f9`), Gender.Other),
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

export function useMemberWithRegistrationsBlobFilterBuilders() {
    return (recordConfiguration: OrganizationRecordsConfiguration) => {
        const all: UIFilterBuilders = [];

        if (recordConfiguration.birthDay) {
            all.push(new DateFilterBuilder({
                name: $t(`f3b87bd8-e36c-4fb8-917f-87b18ece750e`),
                key: 'birthDay',
            }));

            all.push(new NumberFilterBuilder({
                name: $t(`e96d9ea7-f8cc-42c6-b23d-f46e1a56e043`),
                key: 'age',
            }));
        }

        if (recordConfiguration.gender) {
            all.push(new MultipleChoiceFilterBuilder({
                name: $t(`fd3fea4f-73c7-4c8d-90cd-80ea90e53b98`),
                options: [
                    new MultipleChoiceUIFilterOption($t(`06466432-eca6-41d0-a3d6-f262f8d6d2ac`), Gender.Female),
                    new MultipleChoiceUIFilterOption($t(`b54b9706-4c0c-46a6-9027-37052eb76b28`), Gender.Male),
                    new MultipleChoiceUIFilterOption($t(`8f7475aa-c110-49b2-8017-1a6dd0fe72f9`), Gender.Other),
                ],
                wrapper: {
                    gender: {
                        $in: FilterWrapperMarker,
                    },
                },
            }));
        }

        // Add record categories
        all.push(...getFilterBuildersForRecordCategories(recordConfiguration.recordCategories));

        // Recursive: self referencing groups
        all.unshift(
            new GroupUIFilterBuilder({
                builders: all,
            }),
        );

        return all;
    };
}

export function usePlatformMemberFilterBuilders() {
    // the platform member passes all filters directly to the memberWithRegistrationsBlob
    return useMemberWithRegistrationsBlobFilterBuilders();
}

export function useRegisterItemFilterBuilders() {
    return (group: Group) => {
        const all: UIFilterBuilders = [
            new NumberFilterBuilder({
                name: $t(`e96d9ea7-f8cc-42c6-b23d-f46e1a56e043`),
                key: 'age',
                wrapper: {
                    member: FilterWrapperMarker,
                },
            }),
            new DateFilterBuilder({
                name: $t(`f3b87bd8-e36c-4fb8-917f-87b18ece750e`),
                key: 'birthDay',
                wrapper: {
                    member: FilterWrapperMarker,
                },
            }),
            new MultipleChoiceFilterBuilder({
                name: $t(`fd3fea4f-73c7-4c8d-90cd-80ea90e53b98`),
                options: [
                    new MultipleChoiceUIFilterOption($t(`06466432-eca6-41d0-a3d6-f262f8d6d2ac`), Gender.Female),
                    new MultipleChoiceUIFilterOption($t(`b54b9706-4c0c-46a6-9027-37052eb76b28`), Gender.Male),
                    new MultipleChoiceUIFilterOption($t(`8f7475aa-c110-49b2-8017-1a6dd0fe72f9`), Gender.Other),
                ],
                wrapper: {
                    member: {
                        gender: {
                            $in: FilterWrapperMarker,
                        },
                    },
                },
            }),
        ];

        // Add price filter
        all.push(
            new MultipleChoiceFilterBuilder({
                name: $t(`ae21b9bf-7441-4f38-b789-58f34612b7af`),
                options: [
                    ...group.settings.prices.map((price) => {
                        return new MultipleChoiceUIFilterOption(price.name, price.id);
                    }),
                ],
                allowCreation: group.settings.prices.length > 1,
                wrapper: {
                    groupPrice: {
                        id: {
                            $in: FilterWrapperMarker,
                        },
                    },
                },
            }),
        );

        // Option filter
        for (const menu of group.settings.optionMenus) {
            all.push(
                new MultipleChoiceFilterBuilder({
                    name: menu.name,
                    options: [
                        ...menu.options.map((option) => {
                            return new MultipleChoiceUIFilterOption(option.name, option.id);
                        }),
                    ],
                    wrapper: {
                        options: {
                            $elemMatch: {
                                optionMenu: {
                                    id: menu.id,
                                },
                                option: {
                                    id: {
                                        $in: FilterWrapperMarker,
                                    },
                                },
                            },
                        },
                    },
                }),
            );
        }

        // Add record categories
        all.push(...getFilterBuildersForRecordCategories(group.settings.recordCategories));

        // Recursive: self referencing groups
        all.unshift(
            new GroupUIFilterBuilder({
                builders: all,
            }),
        );

        return all;
    };
}

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

export function useAdvancedPlatformMembershipUIFilterBuilders() {
    const $platform = usePlatform();
    const $user = useUser();
    const $t = useTranslate();
    const manager = usePlatformManager();
    const owner = useRequestOwner();
    const loading = ref(true);

    manager.value.loadPeriods(false, true, owner).then(() => {
        loading.value = false;
    }).catch((e) => {
        console.error('Failed to load periods in useAdvancedPlatformMembershipUIFilterBuilders', e);
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
                new DateFilterBuilder({
                    name: $t('300d2935-b578-48cc-b58e-1c0446a68d59'),
                    key: 'startDate',
                }),
            );

            all.push(
                new DateFilterBuilder({
                    name: $t('85dcdb87-b504-43b6-8a52-c22a046eefad'),
                    key: 'endDate',
                }),
            );

            all.push(
                new NumberFilterBuilder({
                    name: $t('b4f47589-f6b4-4f9e-a83b-ad4cbb3de416'),
                    key: 'price',
                    type: NumberFilterFormat.Currency,
                }),
            );

            all.push(
                new NumberFilterBuilder({
                    name: $t('9e6fd655-abb5-43b2-ac0e-c62409058700'),
                    key: 'priceWithoutDiscount',
                    type: NumberFilterFormat.Currency,
                }),
            );

            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t('41b46e42-08eb-4146-b71c-d77c90f46219'),
                    options: [
                        new MultipleChoiceUIFilterOption($t('c5235739-b78a-4add-ab2f-515aef40073d'), true),
                        new MultipleChoiceUIFilterOption($t('539dc5d4-c221-412b-bc33-fe28f85625c4'), false),
                    ],
                    wrapFilter: (f: StamhoofdFilter) => {
                        const choices = Array.isArray(f) ? f : [f];

                        if (choices.length === 2) {
                            return null;
                        }

                        if (choices.length === 1 && choices[0] === true) {
                            return {
                                balanceItemId: {
                                    $neq: null,
                                },
                            };
                        }

                        return {
                            balanceItemId: null,
                        };
                    },
                }),
            );

            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t('87d9975e-d0ac-41d4-8472-dedcfaa571cb'),
                    options: [
                        new MultipleChoiceUIFilterOption($t(`be88b0da-348e-4394-b36c-1136af8aef7d`), true),
                        new MultipleChoiceUIFilterOption($t(`2c94e906-587b-4ff0-b829-c176fb7120f7`), false),
                    ],
                    wrapFilter: (f: StamhoofdFilter) => {
                        const choices = Array.isArray(f) ? f : [f];

                        if (choices.length === 2) {
                            return null;
                        }

                        if (choices.length === 1 && choices[0] === false) {
                            return {
                                $or: [
                                    {
                                        trialUntil: {
                                            $lte: { $: '$now' },
                                        },
                                    },
                                    {
                                        trialUntil: null,
                                    },
                                ],
                            } as StamhoofdFilter;
                        }

                        return {
                            trialUntil: {
                                $gt: { $: '$now' },
                            },
                        };
                    },
                }),
            );

            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t('2f6eb4f4-cfc7-498f-9aef-e534979ea402'),
                    description: $t('730983be-3471-4350-8c74-966480d46727'),
                    options: [
                        new MultipleChoiceUIFilterOption($t('2f6eb4f4-cfc7-498f-9aef-e534979ea402'), true),
                        new MultipleChoiceUIFilterOption($t('039c2f51-c533-4262-91d6-24e4a503b003'), false),
                    ],
                    allowCreation: hasPlatformPermissions,
                    wrapFilter: (f: StamhoofdFilter) => {
                        const choices = Array.isArray(f) ? f : [f];

                        if (choices.length === 2) {
                            return null;
                        }

                        if (choices.length === 1 && choices[0] === false) {
                            return {
                                locked: false,
                            } as StamhoofdFilter;
                        }

                        return {
                            locked: true,
                        };
                    },
                }),
            );

            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t('52b7cfdf-2f2c-4d88-8689-96a91f885654'),
                    description: $t('227a2170-37b7-46b0-ac1e-516f603379b5'),
                    options: [
                        new MultipleChoiceUIFilterOption($t('48148df3-81a8-439e-a368-64355aa7da6e'), true),
                        new MultipleChoiceUIFilterOption($t('6507f89c-5c50-4c37-943f-ec17f5831cf0'), false),
                    ],
                    allowCreation: hasPlatformPermissions,
                    wrapFilter: (f: StamhoofdFilter) => {
                        const choices = Array.isArray(f) ? f : [f];

                        if (choices.length === 2) {
                            return null;
                        }

                        if (choices.length === 1 && choices[0] === true) {
                            return {
                                organizationId: $platform.value.membershipOrganizationId,
                            };
                        }

                        return {
                            organizationId: {
                                $neq: $platform.value.membershipOrganizationId,
                            },
                        };
                    },
                }),
            );

            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t('388a4417-a2df-4943-b446-d13d2445824b'),
                    options: platform.config.membershipTypes.map((membershipType) => {
                        return new MultipleChoiceUIFilterOption(membershipType.name, membershipType.id);
                    }),
                    wrapper: {
                        membershipTypeId: {
                            $in: FilterWrapperMarker,
                        },
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
    const { loading: loadingMembershipFilters, filterBuilders: membershipFilters } = useAdvancedPlatformMembershipUIFilterBuilders();

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
        loading: computed(() => loading.value || loadingMembershipFilters.value),
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

                        const activeOrExpiring = unwrapFilter(f, {
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
                        });

                        if (activeOrExpiring.match) {
                            return ['Active', 'Expiring', 'Trial'];
                        }

                        const activeOrExpiringButNoTrial = unwrapFilter(f, {
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
                        });

                        if (activeOrExpiringButNoTrial.match) {
                            return ['Active', 'Expiring'];
                        }

                        const activeOrTrial = unwrapFilter(f, {
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
                        });

                        if (activeOrTrial.match) {
                            return ['Active', 'Trial'];
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
                            new MultipleChoiceUIFilterOption($t(`e8339839-a2d6-4a98-ae6b-091fb658d25f`), true),
                            new MultipleChoiceUIFilterOption($t(`3729f1c6-ec66-4530-9012-48e0821c0bc1`), false),
                            new MultipleChoiceUIFilterOption($t(`3cbc8829-a005-42be-9d10-d6a6efba1de1`), null),
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
                    name: $t(`3c904919-303b-40a9-a67c-3a406692ac87`),
                    description: $t(`4fb3dc46-fcd1-4aa4-a427-2f903aa231ef`),
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
                        name: $t('9bebe05c-cc6b-4f78-8704-80143df8e010'),
                        description: $t('1316502a-5502-49ec-96fe-93e60cb94268'),
                        builders: registrationFilters.value,
                        wrapper: {
                            registrations: {
                                $elemMatch: FilterWrapperMarker,
                            },
                        },
                    }),
                );

                all.push(
                    new GroupUIFilterBuilder({
                        name: $t('07cba8c8-a135-48e8-83c4-59313ef296d8'),
                        description: $t('8cd6fafc-25ae-4b8d-94e6-fa9d8be0ec16'),
                        builders: membershipFilters.value,
                        wrapper: {
                            platformMemberships: {
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
                        name: $t(`4e4aca2d-1947-4a9a-9182-1aa7bad87474`),
                        description: $t(`37427bf2-d1bd-466a-b92b-414390bf1fe5`),
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
        name: $t(`40d7ac9f-f62d-4a9d-8b2f-5fcfb938c12f`),
        type: NumberFilterFormat.Currency,
        key: 'amountOpen',
    }),
    new NumberFilterBuilder({
        name: $t(`5e73bf1c-6413-4fa5-8049-bff5faf4d8ea`),
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
        name: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
        key: 'name',
    }),
    new StringFilterBuilder({
        name: $t(`ca52d8d3-9a76-433a-a658-ec89aeb4efd5`),
        key: 'firstName',
    }),
    new StringFilterBuilder({
        name: $t(`171bd1df-ed4b-417f-8c5e-0546d948469a`),
        key: 'lastName',
    }),
    new StringFilterBuilder({
        name: $t(`7400cdce-dfb4-40e7-996b-4817385be8d8`),
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
                name: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
                key: 'name',
            }),

            new StringFilterBuilder({
                name: $t(`54b992a4-20e1-4232-8d2e-93c9353c6af3`),
                key: 'city',
            }),

            new StringFilterBuilder({
                name: $t(`5ed579c6-bfe4-453b-bc13-5e38690849e1`),
                key: 'postalCode',
            }),

            new StringFilterBuilder({
                name: $t('5e99e2aa-a240-4894-8de3-f8f0fef20068'),
                key: 'uri',
            }),

            new GroupUIFilterBuilder({
                name: $t(`97dc1e85-339a-4153-9413-cca69959d731`),
                description: $t('6bf80a05-84b0-47ba-ad41-66e2a106669b'),
                builders: organizationMemberUIFilterBuilders,
                wrapper: {
                    members: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }),
            new MultipleChoiceFilterBuilder({
                name: $t(`1bb1402a-c26b-4516-bbe1-08aff32ee3e8`),
                options: [
                    new MultipleChoiceUIFilterOption($t(`1bb1402a-c26b-4516-bbe1-08aff32ee3e8`), 1),
                    new MultipleChoiceUIFilterOption($t(`ddfa1e2d-bb72-4781-8754-d5002249f30d`), 0),
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
                    name: $t(`95fc75cf-bf23-4895-bb64-dfec3944596c`),
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

    const organizationFilter = new MultipleChoiceFilterBuilder({
        name: $t(`6aedccdb-08e6-42c5-ae54-cb26c181ab02`),
        options: [
            new MultipleChoiceUIFilterOption($t(`208e986f-e479-4846-bf51-e557a5d38994`), null),
            ...organizations.map(org => new MultipleChoiceUIFilterOption(org.name, org.id)),
        ],
        wrapper: {
            organizationId: {
                $in: FilterWrapperMarker,
            },
        },
    });
    all.push(organizationFilter);

    const tagsFilter = new MultipleChoiceFilterBuilder({
        name: $t(`2faa00db-5af7-4556-ac49-5b15abf2182f`),
        options: [
            new MultipleChoiceUIFilterOption($t(`3743b6e2-1c6b-4831-a228-6ef082377e3b`), null),
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
        name: $t(`494ad9b9-c644-4b71-bd38-d6845706231f`),
        options: [
            new MultipleChoiceUIFilterOption($t(`fd0de77c-fa11-465b-9a6e-27a766a54efc`), null),
            ...platform.config.defaultAgeGroups.filter(defaultAgeGroup => defaultAgeGroup.isEnabledForTags(allTags)).map(g => new MultipleChoiceUIFilterOption(g.name, g.id)),
        ],
        wrapper: {
            defaultAgeGroupIds: {
                $in: FilterWrapperMarker,
            },
        },
    });
    all.push(defaultAgeGroupFilter);

    const groupFilter = new MultipleChoiceFilterBuilder({
        name: $t(`f52db2d7-c0f5-4f9c-b567-62f657787339`),
        allowCreation: organizations.length > 0,
        options: [
            new MultipleChoiceUIFilterOption($t(`fd0de77c-fa11-465b-9a6e-27a766a54efc`), null),
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

    if (app !== 'registration') {
        const typeFilter = new MultipleChoiceFilterBuilder({
            name: $t(`6c9d45e5-c9f6-49c8-9362-177653414c7e`),
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
        name: $t(`6c9d45e5-c9f6-49c8-9362-177653414c7e`),
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
            name: $t(`e4b54218-b4ff-4c29-a29e-8bf9a9aef0c5`),
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
            name: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
            key: 'name',
        }),
        new StringFilterBuilder({
            name: $t(`7400cdce-dfb4-40e7-996b-4817385be8d8`),
            key: 'email',
        }),
    ];

    if (preview.meta.phoneEnabled) {
        builders.push(new StringFilterBuilder({
            name: $t(`de70b659-718d-445a-9dca-4d14e0a7a4ec`),
            key: 'phone',
        }));
    }

    builders.push(new MultipleChoiceFilterBuilder({
        name: $t(`07e7025c-0bfb-41be-87bc-1023d297a1a2`),
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
            name: $t(`389460d3-8e4b-4238-8d57-a106ec987bcd`),
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
            name: $t(`5dd11b77-abf6-4449-ac3f-74ac1edb5d65`),
            key: 'validAt',
        }),
        new NumberFilterBuilder({
            name: $t(`a023893e-ab2c-4215-9981-76ec16336911`),
            key: 'totalPrice',
            type: NumberFilterFormat.Currency,
        }),
        new NumberFilterBuilder({
            name: $t(`697df3e7-fbbf-421d-81c2-9c904dce4842`),
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
                name: (hasDelivery && nonDeliveryCount > 0) ? $t(`3c712881-ef26-474f-a431-dd1c74011260`) : (hasDelivery ? $t(`1e5d1c96-1c8d-4608-b68d-c5e395874aab`) : $t(`26bf686d-2d75-44d3-8ade-d99e939be9b2`)),
                key: 'timeSlotDate',
            }));
    }

    if (timeCount > 1) {
        // todo: change sort of timeSlotTime => should take start time into account => composite key or generated index maybe?
        // todo: maybe group
        builders.push(
            new NumberFilterBuilder({
                name: $t(`4f4fd620-9852-495b-9899-1c598b49924a`),
                key: 'timeSlotEndTime',
                type: NumberFilterFormat.TimeMinutes,
            }));

        builders.push(
            new NumberFilterBuilder({
                name: $t(`bc92bec8-a315-4f67-8bee-7c210e19b8ef`),
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
            name: $t(`bb5c03d2-d684-40b6-9aa9-6f0877f41441`),
            key: 'id',
        }),
        new NumberFilterBuilder({
            name: $t(`89eafa94-6447-4608-a71e-84752eab10c8`),
            key: 'number',
        }),
        new StringFilterBuilder({
            name: $t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`),
            key: 'description',
        }),
        new MultipleChoiceFilterBuilder({
            name: $t(`62a07ea0-53ad-4962-88ff-26ea1ab493b0`),
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

export function getFilterBuildersForRecordCategories(categories: RecordCategory[], prefix = '') {
    const all: UIFilterBuilder<UIFilter>[] = [];

    for (const category of categories) {
        const allForCategory: UIFilterBuilder<UIFilter>[] = [];
        const categoryPrefix = category.name + ' → ';

        for (const record of category.records) {
            if (record.type === RecordType.Checkbox) {
                allForCategory.push(
                    new MultipleChoiceFilterBuilder({
                        name: prefix + categoryPrefix + record.name,
                        options: [
                            new MultipleChoiceUIFilterOption($t('d87cdb56-c8a6-4466-a6fd-f32fe59561f5'), true),
                            new MultipleChoiceUIFilterOption($t('01b79813-933b-4045-b426-82700f921eaa'), false),
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

            if (record.type === RecordType.ChooseOne) {
                allForCategory.push(
                    new MultipleChoiceFilterBuilder({
                        name: prefix + categoryPrefix + record.name,
                        options: [
                            ...record.choices.map(c => new MultipleChoiceUIFilterOption(c.name, c.id)),
                        ],
                        wrapper: {
                            recordAnswers: {
                                [record.id]: {
                                    selectedChoice: {
                                        id: {
                                            $in: FilterWrapperMarker,
                                        },
                                    },
                                },
                            },
                        },
                    }),
                );
            }

            if (record.type === RecordType.MultipleChoice) {
                allForCategory.push(
                    new MultipleChoiceFilterBuilder({
                        name: prefix + categoryPrefix + record.name,
                        options: [
                            ...record.choices.map(c => new MultipleChoiceUIFilterOption(c.name, c.id)),
                        ],
                        wrapper: {
                            recordAnswers: {
                                [record.id]: {
                                    selectedChoices: {
                                        $elemMatch: {
                                            id: {
                                                $in: FilterWrapperMarker,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    }),
                );
            }
        }

        allForCategory.push(
            ...getFilterBuildersForRecordCategories(category.childCategories, prefix + categoryPrefix),
        );

        if (allForCategory.length > 0) {
            const group = new GroupUIFilterBuilder({
                name: category.name,
                builders: allForCategory,
            });
            allForCategory.unshift(group);
            all.push(
                group,
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
