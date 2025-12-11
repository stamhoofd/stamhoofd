import { usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import { FilterWrapperMarker, Gender, MemberResponsibility, Organization, OrganizationRecordsConfiguration, PermissionLevel, PermissionsResourceType, RecordCategory, StamhoofdCompareValue, StamhoofdFilter, unwrapFilter } from '@stamhoofd/structures';
import { computed, ComputedRef, Ref, ref } from 'vue';
import { useFinancialSupportSettings } from '../../groups';
import { useAuth, useOrganization, usePlatform, useUser } from '../../hooks';
import { DateFilterBuilder } from '../DateUIFilter';
import { getFilterBuildersForRecordCategories } from '../filterBuilders';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { NumberFilterBuilder, NumberFilterFormat } from '../NumberUIFilter';
import { StringFilterBuilder } from '../StringUIFilter';
import { UIFilter, UIFilterBuilder, UIFilterBuilders } from '../UIFilter';
import { useAdvancedRegistrationsUIFilterBuilders } from './registrations';

export function useAdvancedMemberWithRegistrationsBlobUIFilterBuilders() {
    const $platform = usePlatform();
    const $user = useUser();

    const { loading, filterBuilders: registrationFilters } = useAdvancedRegistrationsUIFilterBuilders();
    const { loading: loadingMembershipFilters, filterBuilders: membershipFilters } = useAdvancedPlatformMembershipUIFilterBuilders();
    const financialSupportSettings = useFinancialSupportSettings();
    const organization = useOrganization();

    const auth = useAuth();

    return {
        loading: computed(() => loading.value || loadingMembershipFilters.value),
        filterBuilders: computed(() => {
            const all = createMemberWithRegistrationsBlobFilterBuilders({ organization, $user, $platform, financialSupportSettings, auth, registrationFilters, membershipFilters });

            all.unshift(
                new GroupUIFilterBuilder({
                    builders: all,
                }),
            );

            return all;
        }),
    };
}

export function createMemberWithRegistrationsBlobFilterBuilders({ organization, $user, $platform, financialSupportSettings, auth, registrationFilters, membershipFilters }: { organization: Ref<Organization | null, Organization | null>; $platform: ReturnType<typeof usePlatform>; $user: ReturnType<typeof useUser>; financialSupportSettings: ReturnType<typeof useFinancialSupportSettings>; auth: ReturnType<typeof useAuth>; registrationFilters: ComputedRef<UIFilterBuilder<UIFilter>[]>; membershipFilters: ComputedRef<UIFilterBuilder<UIFilter>[]> }) {
    const platform = $platform.value;
    const user = $user.value;

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

    const all = getMemberBaseFilters(
        OrganizationRecordsConfiguration.build({
            platform,
            organization: organization.value,
        }),
    );

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

    const currentPeriodId = STAMHOOFD.userMode === 'platform' ? platform.period.id : organization.value?.period.period.id;

    if (currentPeriodId) {
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
                                    periodId: currentPeriodId,
                                },
                            ],
                        },
                    },
                },
            }),
        );
    }

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

    function filterRecordCategory(recordCategory: RecordCategory) {
        return auth.hasResourceAccess(PermissionsResourceType.RecordCategories, recordCategory.id) || auth.getPlatformAccessibleOrganizationTags(PermissionLevel.Full) === 'all';
    }

    const recordCategoriesFilterBuilders: UIFilterBuilder<UIFilter>[] = [];
    recordCategoriesFilterBuilders.push(
        ...getFilterBuildersForRecordCategories(
            platform.config.recordsConfiguration.recordCategories.filter(filterRecordCategory),
            undefined,
            { includeNullable: true },
        ),
    );

    if (organization.value !== null) {
        // Also include complex filters
        recordCategoriesFilterBuilders.push(
            ...getFilterBuildersForRecordCategories(
                organization.value.meta.recordsConfiguration.recordCategories.filter(filterRecordCategory),
                undefined,
                { includeNullable: true },
            ),
        );

        all.push(
            new NumberFilterBuilder({
                name: $t(`beb45452-dee7-4a7f-956c-e6db06aac20f`),
                key: 'cachedBalance.amountOpen',
                type: NumberFilterFormat.Currency,
                wrapFilter: (f: StamhoofdFilter) => {
                    return {
                        registrations: {
                            $elemMatch: {
                                $and: [{ organizationId: organization.value!.id }, f],
                            },
                        },
                    };
                },
                unwrapFilter: (f: StamhoofdFilter): StamhoofdFilter | null => {
                    const value = (f as object)?.['registrations']?.['$elemMatch'];
                    if (value?.['cachedBalance.amountOpen']) {
                        return {
                            'cachedBalance.amountOpen': value['cachedBalance.amountOpen'],
                        };
                    }
                    return null;
                },
            }));
    }

    if (recordCategoriesFilterBuilders.length > 0) {
        const groupFilter = new GroupUIFilterBuilder({
            name: $t('4953cb1c-9ba5-40a6-91ad-c25cda4cdfcc'),
            builders: recordCategoriesFilterBuilders,
            wrapper: {
                details: FilterWrapperMarker,
            },
        });
        recordCategoriesFilterBuilders.unshift(groupFilter);
        all.push(groupFilter);
    }

    return all;
}

export function useAdvancedPlatformMembershipUIFilterBuilders() {
    const $platform = usePlatform();
    const $user = useUser();

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

            const all: UIFilterBuilder[] = [];
            all.push(
                new StringFilterBuilder({
                    name: $t('9c92d16b-947d-4a06-bed4-054d8223d5cb'),
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

/**
 * These are used for the inherited records configuration (don't include filters for record answers)
 * These filters are only used in memory - should not really be supported in our sql filters, but should be in-memory.
 * Should match memberWithRegistrationsBlobInMemoryFilterCompilers
 */
export const getMemberFilterBuildersForInheritedRecords: () => UIFilterBuilders = () => {
    const builders: UIFilterBuilders = [
        ...getMemberBaseFilters(),
        new MultipleChoiceFilterBuilder({
            name: $t(`8e92e034-b745-4d0f-8ac1-4363101f9603`),
            options: [
                new MultipleChoiceUIFilterOption($t('00650ac3-eb78-4c8b-b7ec-d892772837a1'), 'birthDay'),
                new MultipleChoiceUIFilterOption($t('8aad46a6-a864-4e60-a3f0-dffe2b37033c'), 'address'),
                new MultipleChoiceUIFilterOption($t('a68020d1-1ee8-4b57-a307-840fb5deaa02'), 'phone'),
                new MultipleChoiceUIFilterOption($t('effd2b1f-01f6-46e0-a5af-488bcbd93f1d'), 'email'),
                new MultipleChoiceUIFilterOption($t('3f196c5f-1b59-4d18-8fca-feaef78e7f09'), 'parents'),
                new MultipleChoiceUIFilterOption($t('a148463b-5ae7-44d8-9cac-20538fc95431'), 'secondParent'),
                new MultipleChoiceUIFilterOption($t('23911c89-12b5-403a-a355-20f3c986c76f'), 'emergencyContacts'),
            ],
            wrapper: {
                missingData: {
                    $elemMatch: {
                        $in: FilterWrapperMarker,
                    },
                },
            },
        }),
    ];

    builders.unshift(
        new GroupUIFilterBuilder({
            builders,
        }),
    );

    return builders;
};

export function getMemberBaseFilters(recordConfiguration?: OrganizationRecordsConfiguration) {
    const all: UIFilterBuilders = [];

    if (!recordConfiguration || recordConfiguration.birthDay) {
        all.push(new DateFilterBuilder({
            name: $t(`f3b87bd8-e36c-4fb8-917f-87b18ece750e`),
            key: 'birthDay',
        }));

        all.push(new NumberFilterBuilder({
            name: $t(`e96d9ea7-f8cc-42c6-b23d-f46e1a56e043`),
            key: 'age',
        }));
    }

    if (!recordConfiguration || recordConfiguration.gender) {
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
    return all;
}

/**
 * These filters are only used in memory - should not really be supported in our sql filters, but should be in-memory.
 * Should match memberWithRegistrationsBlobInMemoryFilterCompilers
 */
export function useMemberWithRegistrationsBlobFilterBuilders() {
    return (recordConfiguration: OrganizationRecordsConfiguration) => {
        const all: UIFilterBuilders = getMemberBaseFilters(recordConfiguration);

        all.push(new MultipleChoiceFilterBuilder({
            name: $t(`8e92e034-b745-4d0f-8ac1-4363101f9603`),
            options: [
                new MultipleChoiceUIFilterOption($t('00650ac3-eb78-4c8b-b7ec-d892772837a1'), 'birthDay'),
                new MultipleChoiceUIFilterOption($t('8aad46a6-a864-4e60-a3f0-dffe2b37033c'), 'address'),
                new MultipleChoiceUIFilterOption($t('a68020d1-1ee8-4b57-a307-840fb5deaa02'), 'phone'),
                new MultipleChoiceUIFilterOption($t('effd2b1f-01f6-46e0-a5af-488bcbd93f1d'), 'email'),
                new MultipleChoiceUIFilterOption($t('3f196c5f-1b59-4d18-8fca-feaef78e7f09'), 'parents'),
                new MultipleChoiceUIFilterOption($t('a148463b-5ae7-44d8-9cac-20538fc95431'), 'secondParent'),
                new MultipleChoiceUIFilterOption($t('23911c89-12b5-403a-a355-20f3c986c76f'), 'emergencyContacts'),
            ],
            wrapper: {
                missingData: {
                    $elemMatch: {
                        $in: FilterWrapperMarker,
                    },
                },
            },
        }));

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
