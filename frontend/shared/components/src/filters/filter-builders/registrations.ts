import { useAppContext } from '#context/appContext.ts';
import { useRegistrationPeriodsRelationFetcher } from '#filters/relation-fetchers/useRegistrationPeriodsRelationFetcher.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { useUser } from '#hooks/useUser.ts';
import { FilterWrapperMarker, GroupType } from '@stamhoofd/structures';
import type { ComputedRef } from 'vue';
import { computed, ref } from 'vue';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { RelationFilterBuilder } from '../RelationUIFilter';
import { StringFilterBuilder } from '../StringUIFilter';
import type { UIFilterBuilder } from '../UIFilter';
import { useEventGroupsRelationFetcher } from '../relation-fetchers/event-groups';
import { useGroupsRelationFetcher } from '../relation-fetchers/groups';
import { useOrganizationsRelationFetcher } from '../relation-fetchers/organizations';

export type RegistrationFilterBuilderFactoryOptions = { periodId?: string };
export type RegistrationFilterBuilderFactory = (options?: RegistrationFilterBuilderFactoryOptions) => ComputedRef<UIFilterBuilder[]>;

export function useAdvancedRegistrationsUIFilterBuilders() {
    const $platform = usePlatform();
    const $user = useUser();
    const isPlatform = STAMHOOFD.userMode === 'platform';
    const app = useAppContext();
    const loading = ref(true);

    const organizationRelationsFetcher = useOrganizationsRelationFetcher();

    const groupsRelationFetcher = useGroupsRelationFetcher();
    const eventGroupsRelationFetcher = useEventGroupsRelationFetcher();
    const registrationPeriodsRelationFetcher = useRegistrationPeriodsRelationFetcher();
    const organization = useOrganization();

    const getRegistrationFilters: RegistrationFilterBuilderFactory = ({ periodId }: RegistrationFilterBuilderFactoryOptions = {}) => computed(() => {
        const platform = $platform.value;
        const user = $user.value;
        const hasPlatformPermissions = (STAMHOOFD.userMode === 'platform' || app === 'admin') && (user?.permissions?.platform !== null);

        const all: UIFilterBuilder[] = [];

        all.push(new RelationFilterBuilder({
            name: $t('%1PI'),
            key: 'organizationId',
            allowCreation: hasPlatformPermissions,
            wrapper: FilterWrapperMarker,
            relationFetcher: organizationRelationsFetcher,
        }));

        if (!periodId && (organization.value || STAMHOOFD.userMode === 'platform')) {
            all.push(
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

        if (app === 'admin') {
            // do not allow filtering by async group relation if admin because not possible to distinguish between groups (organzation should be added for example)
            all.push(
                new StringFilterBuilder({
                    name: $t('%7a'),
                    key: 'name',
                    wrapper: {
                        group: FilterWrapperMarker,
                    },
                }),
            );
        } else {
            all.push(new RelationFilterBuilder({
                name: $t('%14Z'),
                type: GroupType.Membership,
                key: 'groupId',
                allowCreation: true,
                wrapper: FilterWrapperMarker,
                relationFetcher: groupsRelationFetcher({ periodId, type: GroupType.Membership }),
            }));

            all.push(new RelationFilterBuilder({
                name: $t('%1IQ'),
                type: GroupType.WaitingList,
                key: 'groupId',
                allowCreation: true,
                wrapper: FilterWrapperMarker,
                relationFetcher: groupsRelationFetcher({ periodId, type: GroupType.WaitingList }),
            }));
        }

        all.push(new RelationFilterBuilder({
            name: $t('%1IR'),
            type: GroupType.EventRegistration,
            key: 'groupId',
            allowCreation: true,
            wrapper: FilterWrapperMarker,
            relationFetcher: eventGroupsRelationFetcher({ periodId }),
        }));

        all.unshift(
            new GroupUIFilterBuilder({
                builders: all,
            }),
        );

        return all;
    });

    return {
        loading,
        getRegistrationFilters,
    };
}
