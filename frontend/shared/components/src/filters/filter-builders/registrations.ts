import { usePlatformManager } from '@stamhoofd/networking/PlatformManager';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { FilterWrapperMarker } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { usePlatform, useUser } from '../../hooks';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { StringFilterBuilder } from '../StringUIFilter';
import type { UIFilterBuilder } from '../UIFilter';

export function useAdvancedRegistrationsUIFilterBuilders() {
    const $platform = usePlatform();
    const $user = useUser();

    const manager = usePlatformManager();
    const owner = useRequestOwner();
    const loading = ref(true);

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
                new StringFilterBuilder({
                    name: $t('%7C'),
                    key: 'uri',
                    allowCreation: hasPlatformPermissions,
                    wrapper: {
                        organization: FilterWrapperMarker,
                    },
                }),
            );

            all.push(
                new StringFilterBuilder({
                    name: $t('%CX'),
                    key: 'name',
                    allowCreation: hasPlatformPermissions,
                    wrapper: {
                        organization: FilterWrapperMarker,
                    },
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

            all.push(
                new StringFilterBuilder({
                    name: $t('%7a'),
                    key: 'name',
                    wrapper: {
                        group: FilterWrapperMarker,
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
