import { FilterWrapperMarker, getGroupStatusName, getGroupTypeName, GroupStatus, GroupType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { useAppContext } from '../../context';
import { useFinancialSupportSettings } from '../../groups';
import { useAuth, useOrganization, usePlatform, useUser } from '../../hooks';
import { DateFilterBuilder } from '../DateUIFilter';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { NumberFilterBuilder, NumberFilterFormat } from '../NumberUIFilter';
import { StringFilterBuilder } from '../StringUIFilter';
import { UIFilter, UIFilterBuilder } from '../UIFilter';
import { createMemberWithRegistrationsBlobFilterBuilders, useAdvancedPlatformMembershipUIFilterBuilders } from './members';
import { useGetOrganizationUIFilterBuilders } from './organizations';
import { useAdvancedRegistrationsUIFilterBuilders } from './registrations';

export function useAdvancedRegistrationWithMemberUIFilterBuilders({ multipleGroups }: { multipleGroups: boolean }) {
    const $platform = usePlatform();
    const $user = useUser();
    const auth = useAuth();
    const app = useAppContext();

    const { loading, filterBuilders: registrationFilters } = useAdvancedRegistrationsUIFilterBuilders();
    const { loading: loadingMembershipFilters, filterBuilders: membershipFilters } = useAdvancedPlatformMembershipUIFilterBuilders();
    const { getOrganizationUIFilterBuilders } = useGetOrganizationUIFilterBuilders();
    const financialSupportSettings = useFinancialSupportSettings();
    const organization = useOrganization();

    const filterBuilders = computed(() => {
        const all: UIFilterBuilder<UIFilter>[] = [];

        all.push(new DateFilterBuilder({
            name: $t('8895f354-658f-48bd-9d5d-2e0203ca2a36'),
            key: 'registeredAt',
        }));

        if (app === 'admin') {
            all.push(new MultipleChoiceFilterBuilder({
                name: $t('322dd34f-a4ec-4065-be53-040725915e20'),
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
        }
        else {
            all.push(new NumberFilterBuilder({
                key: 'memberCachedBalance.amountOpen',
                name: $t(`28c2bc66-231f-44f3-9249-c1981b871a1f`),
                type: NumberFilterFormat.Currency,
            }));
        }

        const originalFilters = createMemberWithRegistrationsBlobFilterBuilders({
            organization,
            $user,
            $platform,
            financialSupportSettings,
            auth,
            registrationFilters,
            membershipFilters,
        });

        originalFilters.unshift(
            new GroupUIFilterBuilder({
                builders: originalFilters,
            }),
        );

        all.push(
            new GroupUIFilterBuilder({
                name: $t('6c7534a5-53c7-4343-b9e0-5277fe640496'),
                description: $t('4251f966-99ca-4ad8-ba39-9848aa67ecea'),
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
                    name: $t('2f325358-6e2f-418c-9fea-31a14abbc17a'),
                    description: $t('ba255ee3-2907-4f3a-aa16-60cd997fcf15'),
                    builders: getOrganizationUIFilterBuilders(auth.user),
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
                    name: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
                    key: 'name',
                }),
                new MultipleChoiceFilterBuilder({
                    name: $t(`6b4b9fb3-ca24-43cd-9f7b-a5f597b943d8`),
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
                    name: $t('23671282-34da-4da9-8afd-503811621055'),
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
                new MultipleChoiceFilterBuilder({
                    name: $t(`0ef2bbb3-0b3c-411a-8901-a454cff1f839`),
                    options: [
                        ...$platform.value.config.defaultAgeGroups.filter(defaultAgeGroup => organization.value !== null ? defaultAgeGroup.isEnabledForTags(allTags) : true).map(g => new MultipleChoiceUIFilterOption(g.name, g.id)),
                        new MultipleChoiceUIFilterOption($t(`3ef9e622-426f-4913-89a0-0ce08f4542d4`), null),
                    ],
                    wrapper: {
                        defaultAgeGroupId: {
                            $in: FilterWrapperMarker,
                        },
                    },
                }),

            ];

            groupFilters.unshift(new GroupUIFilterBuilder({
                builders: groupFilters,
            }));

            all.push(
                new GroupUIFilterBuilder({
                    name: $t('877284d7-31b4-4857-a963-405b4139adc2'),
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
