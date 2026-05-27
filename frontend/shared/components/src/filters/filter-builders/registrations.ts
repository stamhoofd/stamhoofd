import { usePlatformManager } from '@stamhoofd/networking/PlatformManager';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { FilterWrapperMarker, GroupType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { usePlatform, useUser } from '../../hooks';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { RelationFilterBuilder } from '../RelationUIFilter';
import type { UIFilterBuilder } from '../UIFilter';
import { useEventGroupsRelationFetcher, useMembershipGroupsRelationFetcher } from '../relation-fetchers/groups';
import { useOrganizationsRelationFetcher } from '../relation-fetchers/organizations';

export function useAdvancedRegistrationsUIFilterBuilders() {
    const $platform = usePlatform();
    const $user = useUser();
    const isPlatform = STAMHOOFD.userMode === 'platform';

    const manager = usePlatformManager();
    const owner = useRequestOwner();
    const loading = ref(true);

    const organizationRelationsFetcher = useOrganizationsRelationFetcher();
    const eventGroupsRelationsFetcher = useEventGroupsRelationFetcher();
    const membershipGroupsRelationFetcher = useMembershipGroupsRelationFetcher();

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

            const all: UIFilterBuilder[] = [];

            all.push(new RelationFilterBuilder({
                name: $t('%1PI'),
                key: 'organizationId',
                allowCreation: hasPlatformPermissions,
                wrapper: FilterWrapperMarker,
                relationFetcher: organizationRelationsFetcher
            }));

            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t('%7Z'),
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
                new MultipleChoiceFilterBuilder({
                    name: $t('%3G'),
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

            if (isPlatform && platform.config.defaultAgeGroups.length > 0) {
                all.push(
                    new MultipleChoiceFilterBuilder({
                        name: $t('%wI'),
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
            }

            all.push(new RelationFilterBuilder({
                name: $t('%14Z'),
                type: GroupType.Membership,
                key: 'groupId',
                allowCreation: true,
                wrapper: FilterWrapperMarker,
                relationFetcher: membershipGroupsRelationFetcher
            }));

            all.push(new RelationFilterBuilder({
                name: $t('Activiteit'),
                type: GroupType.EventRegistration,
                key: 'groupId',
                allowCreation: true,
                wrapper: FilterWrapperMarker,
                relationFetcher: eventGroupsRelationsFetcher
            }));

            all.unshift(
                new GroupUIFilterBuilder({
                    builders: all,
                }),
            );

            return all;
        }),
    };
}
