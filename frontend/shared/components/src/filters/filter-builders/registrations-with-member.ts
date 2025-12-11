import { FilterWrapperMarker } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAppContext } from '../../context';
import { useFinancialSupportSettings } from '../../groups';
import { useAuth, useOrganization, usePlatform, useUser } from '../../hooks';
import { DateFilterBuilder } from '../DateUIFilter';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { NumberFilterBuilder, NumberFilterFormat } from '../NumberUIFilter';
import { UIFilter, UIFilterBuilder } from '../UIFilter';
import { createMemberWithRegistrationsBlobFilterBuilders, useAdvancedPlatformMembershipUIFilterBuilders } from './members';
import { useAdvancedRegistrationsUIFilterBuilders } from './registrations';

export function useAdvancedRegistrationWithMemberUIFilterBuilders() {
    const $platform = usePlatform();
    const $user = useUser();
    const auth = useAuth();
    const app = useAppContext();

    const { loading, filterBuilders: registrationFilters } = useAdvancedRegistrationsUIFilterBuilders();
    const { loading: loadingMembershipFilters, filterBuilders: membershipFilters } = useAdvancedPlatformMembershipUIFilterBuilders();
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

            all.push(new MultipleChoiceFilterBuilder({
                name: $t('6705ae0e-8239-4bc0-895d-10128cb5c6c4'),
                options: [...$platform.value.config.defaultAgeGroups.map((group) => {
                    return new MultipleChoiceUIFilterOption(group.name, group.id);
                }), new MultipleChoiceUIFilterOption($t('3ef9e622-426f-4913-89a0-0ce08f4542d4'), null)],
                wrapper: {
                    group: {
                        defaultAgeGroupId: {
                            $in: FilterWrapperMarker,
                        },
                    },
                },
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
