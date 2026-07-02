import { useAppContext } from '#context/appContext.ts';
import { NumberFilterFormat } from '#filters/NumberFilterFormat.ts';
import { useFinancialSupportSettings } from '#groups/hooks/useFinancialSupportSettings.ts';
import { useAuth } from '#hooks/useAuth.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { useUser } from '#hooks/useUser.ts';
import { FilterWrapperMarker, getGroupStatusName, getGroupTypeName, GroupStatus, GroupType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { DateFilterBuilder } from '../DateUIFilter';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { NumberFilterBuilder } from '../NumberUIFilter';
import { StringFilterBuilder } from '../StringUIFilter';
import type { UIFilter, UIFilterBuilder } from '../UIFilter';
import { createMemberWithRegistrationsBlobFilterBuilders, useAdvancedPlatformMembershipUIFilterBuilders } from './members';
import { useGetOrganizationUIFilterBuilders } from './organizations';
import { useAdvancedRegistrationsUIFilterBuilders } from './registrations';

export function useAdvancedRegistrationWithMemberUIFilterBuilders({ multipleGroups }: { multipleGroups: boolean }) {
    const $platform = usePlatform();
    const isPlatform = STAMHOOFD.userMode === 'platform';
    const $user = useUser();
    const auth = useAuth();
    const app = useAppContext();

    const { loading, getRegistrationFilters } = useAdvancedRegistrationsUIFilterBuilders();
    const { loading: loadingMembershipFilters, filterBuilders: membershipFilters } = useAdvancedPlatformMembershipUIFilterBuilders();
    const { getOrganizationUIFilterBuilders } = useGetOrganizationUIFilterBuilders();
    const financialSupportSettings = useFinancialSupportSettings();
    const organization = useOrganization();

    const filterBuilders = computed(() => {
        const all: UIFilterBuilder<UIFilter>[] = [];

        all.push(new DateFilterBuilder({
            name: $t('%zg'),
            key: 'registeredAt',
        }));

        if (app === 'admin') {
            all.push(new MultipleChoiceFilterBuilder({
                name: $t('%7Z'),
                options: ($platform.value.periods ?? []).map((period) => {
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
            }));
        } else {
            all.push(new NumberFilterBuilder({
                key: 'registrationCachedBalance.toPay',
                description: $t('Nog te betalen voor deze inschrijving'),
                name: $t(`Te betalen`),
                type: NumberFilterFormat.Currency,
            }));
        }

        const originalFilters = createMemberWithRegistrationsBlobFilterBuilders({
            organization,
            $user,
            $platform,
            financialSupportSettings,
            auth,
            getRegistrationFilters,
            membershipFilters,
        });

        originalFilters.unshift(
            new GroupUIFilterBuilder({
                builders: originalFilters,
            }),
        );

        all.push(
            new GroupUIFilterBuilder({
                name: $t('%16d'),
                description: $t('%16e'),
                builders: originalFilters,
                wrapper: {
                    member: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }));

        if (organization.value === null) {
            all.push(
                new GroupUIFilterBuilder({
                    name: $t('%1PI'),
                    description: $t('%1IK'),
                    builders: getOrganizationUIFilterBuilders(),
                    wrapper: {
                        organization: {
                            $elemMatch: FilterWrapperMarker,
                        },
                    },
                }),
            );
        }

        if (organization.value === null || multipleGroups) {
            const allTags = organization.value ? organization.value.meta.tags : [];

            const groupFilters: UIFilterBuilder[] = [
                new StringFilterBuilder({
                    name: $t(`%1Os`),
                    key: 'name',
                }),
                new MultipleChoiceFilterBuilder({
                    name: $t(`%1A`),
                    options: Object.values(GroupStatus)
                        // filter out deprecated status
                        .filter(status => status !== GroupStatus.Archived)
                        .map((status) => {
                            return new MultipleChoiceUIFilterOption(Formatter.capitalizeFirstLetter(getGroupStatusName(status)), status);
                        }),
                    wrapper: {
                        status: {
                            $in: FilterWrapperMarker,
                        },
                    },
                }),
                new MultipleChoiceFilterBuilder({
                    name: $t('%1LP'),
                    options: Object.values(GroupType)
                        .map((type) => {
                            return new MultipleChoiceUIFilterOption(Formatter.capitalizeFirstLetter(getGroupTypeName(type)), type);
                        }),
                    wrapper: {
                        type: {
                            $in: FilterWrapperMarker,
                        },
                    },
                }),
            ];

            if (isPlatform) {
                groupFilters.push(new MultipleChoiceFilterBuilder({
                    name: $t(`%wI`),
                    options: [
                        ...$platform.value.config.defaultAgeGroups.filter(defaultAgeGroup => organization.value !== null ? defaultAgeGroup.isEnabledForTags(allTags) : true).map(g => new MultipleChoiceUIFilterOption(g.name, g.id)),
                        new MultipleChoiceUIFilterOption($t(`%1FW`), null),
                    ],
                    wrapper: {
                        defaultAgeGroupId: {
                            $in: FilterWrapperMarker,
                        },
                    },
                }));
            }

            groupFilters.unshift(new GroupUIFilterBuilder({
                builders: groupFilters,
            }));

            all.push(
                new GroupUIFilterBuilder({
                    name: $t('%1IL'),
                    builders: groupFilters,
                    wrapper: {
                        group: {
                            $elemMatch: FilterWrapperMarker,
                        },
                    },
                }),
            );
        }

        all.unshift(
            new GroupUIFilterBuilder({
                builders: all,
            }));

        return all;
    });

    return {
        loading: computed(() => loading.value || loadingMembershipFilters.value),
        filterBuilders,
    };
}
