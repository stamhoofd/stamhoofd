<template>
    <form class="st-view">
        <main>
            <STList class="illustration-list">
                <ModuleListItem v-for="module of allModules" :key="module" :selectable="true" :module="module" @click="selectItem(module)">
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </ModuleListItem>
            </STList>
        </main>
    </form>
</template>

<script lang="ts" setup>
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { ModuleType } from './classes/ModuleType';
import ModuleListItem from './ModuleListItem.vue';

const allModules = [
    ModuleType.Tickets,
    ModuleType.Members,
    ModuleType.Webshops,
];
const dismiss = useDismiss();
const props = defineProps<{
    selected: ModuleType;
    onSelect: (module: ModuleType) => void;
}>();

async function selectItem(item: ModuleType) {
    props.onSelect(item);
    await dismiss();
}
</script>
