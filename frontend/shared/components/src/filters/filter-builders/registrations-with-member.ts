import { FilterWrapperMarker, StamhoofdFilter } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useFinancialSupportSettings } from '../../groups';
import { useAuth, useOrganization, usePlatform, useUser } from '../../hooks';
import { DateFilterBuilder } from '../DateUIFilter';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { NumberFilterBuilder, NumberFilterFormat } from '../NumberUIFilter';
import { UIFilter, UIFilterBuilder } from '../UIFilter';
import { createMemberWithRegistrationsBlobFilterBuilders, useAdvancedPlatformMembershipUIFilterBuilders } from './members';
import { useAdvancedRegistrationsUIFilterBuilders } from './registrations';

enum RegistrationStatus {
    Active,
    Inactive,
}

export function useAdvancedRegistrationWithMemberUIFilterBuilders() {
    const $platform = usePlatform();
    const $user = useUser();
    const auth = useAuth();

    const { loading, filterBuilders: registrationFilters } = useAdvancedRegistrationsUIFilterBuilders();
    const { loading: loadingMembershipFilters, filterBuilders: membershipFilters } = useAdvancedPlatformMembershipUIFilterBuilders();
    const financialSupportSettings = useFinancialSupportSettings();
    const organization = useOrganization();

    const filterBuilders = computed(() => {
        const all: UIFilterBuilder<UIFilter>[] = [];

        all.push(new DateFilterBuilder({
            name: $t('Inschrijvingsdatum'),
            key: 'registeredAt',
        }));

        all.push(new NumberFilterBuilder({
            name: $t('b4f47589-f6b4-4f9e-a83b-ad4cbb3de416'),
            key: 'price',
            type: NumberFilterFormat.Currency,
        }));

        all.push(new NumberFilterBuilder({
            name: $t('Betaald bedrag'),
            key: 'pricePaid',
            type: NumberFilterFormat.Currency,
        }));

        all.push(
            new MultipleChoiceFilterBuilder({
                name: $t(`Status`),
                options: ([[$t('Actief'), RegistrationStatus.Active], [$t('Verwijderd'), RegistrationStatus.Inactive]] as [string, RegistrationStatus][]).map(([name, value]) => {
                    return new MultipleChoiceUIFilterOption(name, value);
                }),
                wrapFilter: (f: StamhoofdFilter) => {
                    const choices = Array.isArray(f) ? f : [f];
                    if (choices.length === 0 || choices.length === 2) {
                        return null;
                    }

                    if (choices.includes(RegistrationStatus.Active)) {
                        return {
                            deactivatedAt: null,
                        };
                    }

                    return {
                        deactivatedAt: {
                            $neq: null,
                        },
                    };
                },
                unwrapFilter: (f: StamhoofdFilter): StamhoofdFilter | null => {
                    if (typeof f !== 'object') return null;

                    const deactivatedAt = f?.['deactivatedAt'];

                    if (deactivatedAt === undefined) {
                        return null;
                    }

                    if (deactivatedAt === null || deactivatedAt['$eq'] === null) {
                        return [RegistrationStatus.Active];
                    }

                    if (deactivatedAt['$ne'] === null) {
                        return [RegistrationStatus.Inactive];
                    }

                    return null;
                },
            }),
        );

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
                name: $t('lid'),
                description: $t('Filter op leden'),
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
