import { NumberFilterFormat } from '#filters/NumberFilterFormat.ts';
import { RelationFilterBuilder } from '#filters/RelationUIFilter.ts';
import { useRegistrationPeriodsRelationFetcher } from '#filters/relation-fetchers/useRegistrationPeriodsRelationFetcher.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { FilterWrapperMarker } from '@stamhoofd/structures';
import { ref } from 'vue';
import { DateFilterBuilder } from '../DateUIFilter';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { NumberFilterBuilder } from '../NumberUIFilter';
import type { UIFilterBuilders } from '../UIFilter';
import { getMemberBaseFilters } from './members';
import { useGetOrganizationUIFilterBuilders } from './organizations';

export function useGetPlatformMembershipsUIFilterBuilders() {
    const platform = usePlatform();
    const loading = ref(true);
    const organizationFilterBuilders = useGetOrganizationUIFilterBuilders({ onlyBaseFilters: true });
    const registrationPeriodsRelationFetcher = useRegistrationPeriodsRelationFetcher();

    const getWebshopUIFilterBuilders = (): UIFilterBuilders => {
        const builders: UIFilterBuilders = [
        ];

        if (STAMHOOFD.userMode === 'platform') {
            builders.push(
                new RelationFilterBuilder({
                    name: $t('%7Z'),
                    key: 'periodId',
                    relationFetcher: registrationPeriodsRelationFetcher,
                    viewProperties: {
                        searchEnabled: false,
                    },
                }),
            );
        }

        if (platform.value.config.membershipTypes.length > 1) {
            builders.push(new MultipleChoiceFilterBuilder({
                name: $t('%1LP'),
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
                name: $t('%1Of'),
                key: 'startDate',
            }),
            new DateFilterBuilder({
                name: $t('%1P8'),
                key: 'endDate',
            }),
            new DateFilterBuilder({
                name: $t('%1J7'),
                key: 'expiredDate',
            }),
            new DateFilterBuilder({
                name: $t('%1Jc'),
                key: 'createdAt',
            }),
            new DateFilterBuilder({
                name: $t('%1OU'),
                key: 'trialUntil',
            }),
            new NumberFilterBuilder({
                key: 'price',
                name: $t('%1IP'),
                type: NumberFilterFormat.Currency,
            }),

            new NumberFilterBuilder({
                key: 'freeAmount',
                name: $t('%1Oo'),
            }),
            // member
            new GroupUIFilterBuilder({
                name: $t('%1Oi'),
                builders: getMemberBaseFilters(platform.value.config.recordsConfiguration, { groupNameFilters: false }),
                wrapper: {
                    member: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }),
            // group
            new GroupUIFilterBuilder({
                name: $t('%1Ok'),
                description: $t('%1PD'),
                builders: organizationFilterBuilders.getOrganizationUIFilterBuilders(),
                wrapper: {
                    organization: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }),
        ]);

        // Put a GroupUIFilterBuilder first so it can parse any filter structure,
        // including the defaultFilter which uses $or for the status.
        // ModernTableView uses filterBuilders[0].fromFilter(defaultFilter) to restore state.
        builders.unshift(new GroupUIFilterBuilder({ builders }));

        return builders;
    };

    return { loading, getWebshopUIFilterBuilders };
}
