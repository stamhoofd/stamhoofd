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
            name: $t('ae9274f4-87fd-4221-bd81-3ff8b609eb4b'),
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
                name: $t(`beb45452-dee7-4a7f-956c-e6db06aac20f`),
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
                    name: $t('7d0a5e21-6573-4e84-89f8-5af81d2d3c8a'),
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
                    name: $t(`e4b54218-b4ff-4c29-a29e-8bf9a9aef0c5`),
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
                    name: $t('4fda497f-b2d8-43ef-b08c-a3e4e0b472b4'),
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
                    name: $t(`494ad9b9-c644-4b71-bd38-d6845706231f`),
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
