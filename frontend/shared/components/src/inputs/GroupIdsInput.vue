<template>
    <LoadingBoxTransition>
        <STList>
            <STListItem v-for="group of groups" :key="group.id" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox :model-value="getGroupValue(group)" @update:model-value="setGroupValue(group, $event)" />
                </template>
                <h3 class="style-title-list">
                    {{ group.settings.name }}
                </h3>
                <p v-if="group.dateRange" class="style-description-small">
                    {{ group.dateRange }}
                </p>
            </STListItem>

            <STListItem :selectable="true" element-name="label" @click="selectGroup">
                <template #left>
                    <span class="icon gray add small" />
                </template>
                <h3 class="style-title-list">
                    {{ addButtonText ?? $t('%SN') }}
                </h3>
            </STListItem>
        </STList>
    </LoadingBoxTransition>
</template>

<script setup lang="ts">
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import LoadingBoxTransition from '#containers/LoadingBoxTransition.vue';
import { useGroupsObjectFetcher } from '#fetchers/useGroupsObjectsFetcher.ts';
import { Toast } from '#overlays/Toast.ts';
import type { NavigationActions } from '#types/NavigationActions.ts';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import type { Group } from '@stamhoofd/structures';
import { LimitedFilteredRequest } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { onMounted, ref } from 'vue';

const props = withDefaults(
    defineProps<{
        nullable?: boolean;
        defaultPeriodId?: string | null;
        title?: string;
        addButtonText?: string | null;
    }>(), {
        nullable: false,
        defaultPeriodId: null,
        title: () => $t(`%wP`),
        addButtonText: null,
    },
);
const model = defineModel<string[] | null>({ required: true });
const fetcher = useGroupsObjectFetcher();
const groups = ref<null | Group[]>(null) as Ref<null | Group[]>;

onMounted(() => {
    loadGroups().catch(console.error);
});

async function loadGroups() {
    if (model.value === null || model.value.length === 0) {
        groups.value = [];
        return;
    }

    try {
        const result = await fetcher.fetch(new LimitedFilteredRequest({
            filter: {
                id: {
                    $in: model.value,
                },
            },
            limit: model.value.length,
        }));

        groups.value = result.results;
    } catch (e) {
        if (Request.isAbortError(e)) {
            return;
        }
        Toast.fromError(e).show();
    }
}

const present = usePresent();
async function selectGroup() {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('./ChooseGroupsView.vue'), {
                    addGroup: async (group: Group, actions: NavigationActions) => {
                        if (groups.value) {
                            groups.value.push(group);
                        } else {
                            groups.value = [group];
                        }
                        setGroupValue(group, true);
                        await actions.dismiss();
                    },
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

function getGroupValue(group: Group) {
    return !!model.value?.find(id => id === group.id);
}

function setGroupValue(group: Group, value: boolean) {
    if (model.value === null) {
        return;
    }
    if (value) {
        model.value = [...model.value.filter(id => id !== group.id), group.id];
    } else {
        model.value = model.value.filter(id => id !== group.id);
    }
}
</script>
