import { usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import { FilterWrapperMarker } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { usePlatform, useUser } from '../../hooks';
import { GroupUIFilterBuilder } from '../GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from '../MultipleChoiceUIFilter';
import { StringFilterBuilder } from '../StringUIFilter';
import { UIFilterBuilder } from '../UIFilter';

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
                    name: $t('9c92d16b-947d-4a06-bed4-054d8223d5cb'),
                    key: 'organizationId',
                    allowCreation: false,
                    wrapper: FilterWrapperMarker,
                }),
            );

            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t('322dd34f-a4ec-4065-be53-040725915e20'),
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
                    name: $t('05723781-9357-41b2-9fb8-cb4f80dde7f9'),
                    key: 'uri',
                    allowCreation: hasPlatformPermissions,
                    wrapper: {
                        organization: FilterWrapperMarker,
                    },
                }),
            );

            all.push(
                new StringFilterBuilder({
                    name: $t('47754708-6f27-4afd-b9fe-600a209cb980'),
                    key: 'name',
                    allowCreation: hasPlatformPermissions,
                    wrapper: {
                        organization: FilterWrapperMarker,
                    },
                }),
            );

            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t('ec2de613-f06f-4d9a-888a-40f98b6b3727'),
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
                    name: $t('6705ae0e-8239-4bc0-895d-10128cb5c6c4'),
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
                    name: $t('446b88a9-50f5-4c2b-a9e8-742f12034863'),
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
