import { usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import { FilterWrapperMarker } from '@stamhoofd/structures';
import { ref } from 'vue';
import { usePlatform } from '../../hooks';
import { DateFilterBuilder } from '../DateUIFilter';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { NumberFilterBuilder, NumberFilterFormat } from '../NumberUIFilter';
import type { UIFilterBuilders } from '../UIFilter';
import { getMemberBaseFilters } from './members';
import { useGetOrganizationUIFilterBuilders } from './organizations';

export function useGetPlatformMembershipsUIFilterBuilders() {
    const platform = usePlatform();
    const manager = usePlatformManager();
    const owner = useRequestOwner();
    const loading = ref(true);
    const organizationFilterBuilders = useGetOrganizationUIFilterBuilders({onlyBaseFilters: true});

    manager.value.loadPeriods(false, true, owner).then(() => {
        loading.value = false;
    }).catch((e) => {
        console.error('Failed to load periods in useAdvancedPlatformMembershipUIFilterBuilders', e);
    });

    const getWebshopUIFilterBuilders = (): UIFilterBuilders => {
        const builders: UIFilterBuilders = [
            new MultipleChoiceFilterBuilder({
                name: $t('%7Z'),
                options: (platform.value.periods ?? []).map((period) => {
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
            })
        ];

        if (platform.value.config.membershipTypes.length > 1) {
            builders.push(new MultipleChoiceFilterBuilder({
                name: $t('Type'),
                options: platform.value.config.membershipTypes.map((membershipType) => {
                    return new MultipleChoiceUIFilterOption(membershipType.name, membershipType.id);
                }),
                wrapper: {
                    membershipTypeId: {
                        $in: FilterWrapperMarker,
                    },
                },
            }));
        }

        builders.push(...[
             new DateFilterBuilder({
                name: $t('Startdatum'),
                key: 'startDate',
            }),
            new DateFilterBuilder({
                name: $t('Einddatum'),
                key: 'endDate',
            }),
            new DateFilterBuilder({
                name: $t('Vervaldatum'),
                key: 'expiredDate',
            }),
            new DateFilterBuilder({
                name: $t('Aanmaakdatum'),
                key: 'createdAt',
            }),
            new DateFilterBuilder({
                name: $t('Proefperiode tot'),
                key: 'trialUntil',
            }),
            new NumberFilterBuilder({
                key: 'price',
                name: $t('Prijs'),
                type: NumberFilterFormat.Currency
            }),

            new NumberFilterBuilder({
                key: 'freeAmount',
                name: $t('Dagen gratis'),
            }),
            // member
            new GroupUIFilterBuilder({
                name: $t('Aangesloten lid'),
                builders: getMemberBaseFilters(platform.value.config.recordsConfiguration, { groupNameFilters: false }),
                wrapper: {
                    member: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }),
            // group
             new GroupUIFilterBuilder({
                name: $t('Aangerekende vereniging'),
                description: $t('Vereniging waar de aansluiting aan aangrekend is'),
                builders: organizationFilterBuilders.getOrganizationUIFilterBuilders(),
                wrapper: {
                    organization: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }),
        ])

        // Put a GroupUIFilterBuilder first so it can parse any filter structure,
        // including the defaultFilter which uses $or for the status.
        // ModernTableView uses filterBuilders[0].fromFilter(defaultFilter) to restore state.
        builders.unshift(new GroupUIFilterBuilder({ builders }));

        return builders;
    };

    return { loading, getWebshopUIFilterBuilders };
}
