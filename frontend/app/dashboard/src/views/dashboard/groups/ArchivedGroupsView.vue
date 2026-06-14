<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main>
            <h1>
                {{ title }}
            </h1>

            <p>
                {{ $t('%L7') }}
            </p>

            <Spinner v-if="loadingGroups" />
            <STList v-else-if="groups.length">
                <STListItem v-for="group in groups" :key="group.id" :selectable="true" @click="openGroup(group)">
                    <template #left>
                        <GroupAvatar :group="group" />
                    </template>

                    <h2 class="style-title-list">
                        {{ group.settings.name }}
                    </h2>

                    <template #right>
                        <span v-if="group.settings.registeredMembers !== null" class="style-description-small">{{ group.settings.registeredMembers }}</span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
            <p v-else class="info-box">
                {{ $t('%KB') }}
            </p>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, useShow } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import GroupAvatar from '@stamhoofd/components/GroupAvatar.vue';
import Spinner from '@stamhoofd/components/Spinner.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import type { Group } from '@stamhoofd/structures';
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';



const organizationManager = useOrganizationManager();
const show = useShow();
const requestOwner = {};
const loadingGroups = ref(true);
const groups = shallowRef<Group[]>([]);
const title = 'Leden archief';

onMounted(() => load().catch(console.error));
onBeforeUnmount(() => Request.cancelAll(requestOwner));

async function load() {
    try {
        groups.value = await organizationManager.value.loadArchivedGroups({ owner: requestOwner });
    } catch (e) {
        Toast.fromError(e).show();
    }
    loadingGroups.value = false;
}

async function openGroup(group: Group) {
    await show({
        components: [
            AsyncComponent(() => import('./GroupOverview.vue'), {
                group,
            }),
        ],
    });
}
</script>
