import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { usePlatformManager } from '@stamhoofd/networking/PlatformManager';
import type { MemberResponsibility, Organization, RecordCategory, StamhoofdCompareValue, StamhoofdFilter } from '@stamhoofd/structures';
import { FilterWrapperMarker, Gender, OrganizationRecordsConfiguration, PermissionLevel, PermissionsResourceType, UitpasSocialTariffStatus, unwrapFilter } from '@stamhoofd/structures';
import type { ComputedRef, Ref } from 'vue';
import { computed, ref } from 'vue';
import { useFinancialSupportSettings } from '../../groups';
import { useAuth, useOrganization, usePlatform, useUser } from '../../hooks';
import { DateFilterBuilder } from '../DateUIFilter';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterMode, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { NumberFilterBuilder, NumberFilterFormat } from '../NumberUIFilter';
import { StringFilterBuilder } from '../StringUIFilter';
import type { UIFilter, UIFilterBuilder, UIFilterBuilders } from '../UIFilter';
import { simpleBooleanFilterFactory, simpleMultipleChoiceFilterFactory } from './helpers';
import { getFilterBuildersForRecordCategories } from './record-categories';
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

    const recordsConfiguration = OrganizationRecordsConfiguration.build({
        platform,
        organization: organization.value,
    });

    const all = getMemberBaseFilters(
        recordsConfiguration,
    );

    if (user?.permissions?.platform !== null) {
        all.push(
            new MultipleChoiceFilterBuilder({
                name: $t('%7D'),
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
            name: $t('%7E'),
            options: [
                new MultipleChoiceUIFilterOption($t('%1H0'), 'Active'),
                new MultipleChoiceUIFilterOption($t('%1IH'), 'Trial'),
                new MultipleChoiceUIFilterOption($t('%7F'), 'Expiring'),
                new MultipleChoiceUIFilterOption($t('%7G'), 'Inactive'),
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
            name: $t('%7H'),
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
            name: $t('%7o'),
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
            name: $t('%wT'),
            key: 'email',
        }),
    );

    all.push(
        new StringFilterBuilder({
            name: $t('%7b'),
            key: 'parentEmail',
        }),
    );

    all.push(
        new StringFilterBuilder({
            name: $t('%7c'),
            key: 'phone',
        }),
    );

    all.push(
        new StringFilterBuilder({
            name: $t('%7d'),
            key: 'parentPhone',
        }),
    );

    all.push(
        new StringFilterBuilder({
            name: $t('%7p'),
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
            name: $t('%7q'),
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
            name: $t('%1PP'),
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
            name: $t('%c'),
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
        all.push(simpleBooleanFilterFactory({
            name: financialSupportSettings.financialSupportSettings.value.title,
            optionNames: {
                true: $t(`%1H0`),
                false: $t(`%1Kt`),
            },
            filterIfTrue: {
                $or: [
                    {
                        'details.requiresFinancialSupport': true,
                    },
                    {
                        'details.uitpasNumberDetails.socialTariff.status': UitpasSocialTariffStatus.Active,
                    },
                ],
            },
        }));
    }

    if (!recordsConfiguration || recordsConfiguration.dataPermission) {
        all.push(simpleBooleanFilterFactory({
            name: $t('%vY'),
            optionNames: {
                true: $t(`%1MV`),
                false: $t(`%1MW`),
            },
            filterIfTrue: {
                'details.dataPermissions': true,
            },
        }));
    }

    all.push(new DateFilterBuilder({
        key: 'createdAt',
        name: $t('%1Jc'),
    }));

    const currentPeriodId = STAMHOOFD.userMode === 'platform' ? platform.period.id : organization.value?.period.period.id;

    if (currentPeriodId) {
        all.push(
            new GroupUIFilterBuilder({
                name: $t(`%c0`),
                description: $t(`%c1`),
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

    if (auth.hasFullAccess() || auth.hasAccessForSomeResourceOfType(PermissionsResourceType.OrganizationTags, PermissionLevel.Full)) {
        // If you have full access for an organization, or full access to an organization tag, you can filter on historical registrations
        all.push(
            new GroupUIFilterBuilder({
                name: $t('%BU'),
                description: $t('%8U'),
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
                name: $t('%BV'),
                description: $t('%BW'),
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
                name: $t('%H2'),
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
                name: $t('%1Of'),
                key: 'startDate',
            }),
        );

        responsibilitiesFilters.push(
            new DateFilterBuilder({
                name: $t('%1P8'),
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
                name: $t(`%c2`),
                description: $t(`%c3`),
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
                name: $t(`%76`),
                key: 'memberCachedBalance.amountOpen',
                type: NumberFilterFormat.Currency,
                wrapper: {
                    registrations: {
                        $elemMatch: {
                            $and: [{ organizationId: organization.value!.id }, FilterWrapperMarker],
                        },
                    },
                },
                additionalUnwrappers: [
                    {
                        registrations: {
                            $elemMatch: {
                                $and: [FilterWrapperMarker],
                            },
                        },
                    }
                ]
            }));
    }

    // accounts
    all.push(simpleBooleanFilterFactory({
        name: $t('%1MN'),
        description: $t('%1MO'),
        optionNames: {
            true: $t('%1MP'),
            false: $t('%1MQ'),
        },
        filterIfTrue: {
            users: {
                $elemMatch: {
                    verified: true,
                },
            },
        },
    }));

    // missing data
    all.push(simpleMultipleChoiceFilterFactory({
        name: $t(`%17z`),
        description: $t('%1MR'),
        filterMode: MultipleChoiceUIFilterMode.Or,
        options: [
            {
                name: $t('%17w'),
                value: 'birthDay',
                filter: {
                    birthDay: null,
                },
            },

            {
                name: $t('%Cn'),
                value: 'address',
                filter: {
                    'details.address': {
                        value: null,
                    },
                },
            },
            {
                name: $t('%wD'),
                value: 'phone',
                filter: {
                    phone: null,
                },
            },
            {
                name: $t('%1FK'),
                value: 'email',
                filter: {
                    email: null,
                },
            },
            {
                name: $t('%XH'),
                value: 'parents',
                filter: {
                    'details.parents.length': 0,
                },
            },
            {
                name: $t('%17x'),
                value: 'secondParent',
                filter: {
                    'details.parents.length': 1,
                },
            },
            {
                name: $t('%17y'),
                value: 'emergencyContacts',
                filter: {
                    'details.emergencyContacts.length': 0,
                },
            },
        ],
    }));

    if (recordCategoriesFilterBuilders.length > 0) {
        const groupFilter = new GroupUIFilterBuilder({
            name: $t('%8i'),
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
                    name: $t('%1CF'),
                    key: 'organizationId',
                    allowCreation: false,
                    wrapper: FilterWrapperMarker,
                }),
            );

            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t('%7Z'),
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
                    name: $t('%1Of'),
                    key: 'startDate',
                }),
            );

            all.push(
                new DateFilterBuilder({
                    name: $t('%1P8'),
                    key: 'endDate',
                }),
            );

            all.push(
                new NumberFilterBuilder({
                    name: $t('%1IP'),
                    key: 'price',
                    type: NumberFilterFormat.Currency,
                }),
            );

            all.push(
                new NumberFilterBuilder({
                    name: $t('%1Nm'),
                    key: 'priceWithoutDiscount',
                    type: NumberFilterFormat.Currency,
                }),
            );

            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t('%BO'),
                    options: [
                        new MultipleChoiceUIFilterOption($t('%BO'), true),
                        new MultipleChoiceUIFilterOption($t('%1OR'), false),
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
                    name: $t('%1IH'),
                    options: [
                        new MultipleChoiceUIFilterOption($t(`%by`), true),
                        new MultipleChoiceUIFilterOption($t(`%bz`), false),
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
                    name: $t('%Bb'),
                    description: $t('%Bc'),
                    options: [
                        new MultipleChoiceUIFilterOption($t('%Bb'), true),
                        new MultipleChoiceUIFilterOption($t('%Bd'), false),
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
                    name: $t('%BP'),
                    description: $t('%BQ'),
                    options: [
                        new MultipleChoiceUIFilterOption($t('%BR'), true),
                        new MultipleChoiceUIFilterOption($t('%BS'), false),
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
                    name: $t('%BT'),
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
        new GroupUIFilterBuilder({
                name: $t('%1EI'),
                allowCreation: false,
                builders: [
                    new StringFilterBuilder({
                            name: $t('%1ON'),
                            key: 'id',
                            allowCreation: false,
                            wrapper: {
                                group: FilterWrapperMarker
                            },
                    })
                ],
                wrapper: {
                    registrations: {
                        $elemMatch: FilterWrapperMarker
                    }
                },
        }),
        new MultipleChoiceFilterBuilder({
            name: $t(`%17z`),
            options: [
                new MultipleChoiceUIFilterOption($t('%17w'), 'birthDay'),
                new MultipleChoiceUIFilterOption($t('%Cn'), 'address'),
                new MultipleChoiceUIFilterOption($t('%wD'), 'phone'),
                new MultipleChoiceUIFilterOption($t('%1FK'), 'emailAddress'),
                new MultipleChoiceUIFilterOption($t('%XH'), 'parents'),
                new MultipleChoiceUIFilterOption($t('%17x'), 'secondParent'),
                new MultipleChoiceUIFilterOption($t('%17y'), 'emergencyContacts'),
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

export function getMemberBaseFilters(recordConfiguration?: OrganizationRecordsConfiguration, options: {groupNameFilters?: boolean} = {groupNameFilters: true}) {
    const all: UIFilterBuilders = [];

    const nameFilters: UIFilterBuilders = [
        new StringFilterBuilder({
            name: $t('%1MS'),
            key: 'name',
        }),
        new StringFilterBuilder({
            name: $t('%1MT'),
            key: 'firstName',
        }),
        new StringFilterBuilder({
            name: $t('%1MU'),
            key: 'lastName',
        })
    ];

    if (options.groupNameFilters) {
        all.push(new GroupUIFilterBuilder({
            name: $t('%1Os'),
            builders: nameFilters
        }));
    } else {
        all.push(...nameFilters);
    }

    if (!recordConfiguration || recordConfiguration.birthDay) {
        all.push(new DateFilterBuilder({
            name: $t(`%17w`),
            key: 'birthDay',
        }));

        all.push(new NumberFilterBuilder({
            name: $t(`%9S`),
            key: 'age',
        }));
    }

    if (!recordConfiguration || recordConfiguration.gender) {
        all.push(new MultipleChoiceFilterBuilder({
            name: $t(`%1d`),
            options: [
                new MultipleChoiceUIFilterOption($t(`%XM`), Gender.Female),
                new MultipleChoiceUIFilterOption($t(`%XK`), Gender.Male),
                new MultipleChoiceUIFilterOption($t(`%1JG`), Gender.Other),
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

        all.push(new GroupUIFilterBuilder({
                name: $t('%1EI'),
                allowCreation: false,
                builders: [
                    new StringFilterBuilder({
                            name: $t('%1ON'),
                            key: 'id',
                            allowCreation: false,
                            wrapper: {
                                group: FilterWrapperMarker
                            },
                    })
                ],
                wrapper: {
                    registrations: {
                        $elemMatch: FilterWrapperMarker
                    }
                },
        }));

        all.push(new MultipleChoiceFilterBuilder({
            name: $t(`%17z`),
            options: [
                new MultipleChoiceUIFilterOption($t('%17w'), 'birthDay'),
                new MultipleChoiceUIFilterOption($t('%Cn'), 'address'),
                new MultipleChoiceUIFilterOption($t('%wD'), 'phone'),
                new MultipleChoiceUIFilterOption($t('%1FK'), 'emailAddress'),
                new MultipleChoiceUIFilterOption($t('%XH'), 'parents'),
                new MultipleChoiceUIFilterOption($t('%17x'), 'secondParent'),
                new MultipleChoiceUIFilterOption($t('%17y'), 'emergencyContacts'),
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
