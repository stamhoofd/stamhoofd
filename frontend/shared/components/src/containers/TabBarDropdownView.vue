<template>
    <nav class="st-view">
        <main ref="box">
            <STList>
                <STListItem v-for="(item, index) in tabs" :key="index" :selectable="true" element-name="button" @click="selectTab(item)">
                    <div class="button text" :class="{ selected: selectedItem === item }">
                        <span :class="'icon '+item.icon" />
                        <span>{{ item.name }}</span>
                        <span v-if="unref(item.badge)" class="bubble">{{ unref(item.badge) }}</span>
                        <span v-if="item.isGroup" class="icon arrow-down-small gray"></span>
                    </div>
                </STListItem>
            </STList>
        </main>
    </nav>
</template>

<script setup lang="ts">
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { ref, unref } from 'vue';
import { TabBarItem } from './TabBarItem';

const props = defineProps<{
    tabs: (TabBarItem)[],
    selectedItem: TabBarItem|null,
    selectItem: (item: TabBarItem) => void,
}>()

const dismiss = useDismiss()
const box = ref<HTMLElement|null>(null);

const selectTab = (item: TabBarItem) => {
    dismiss({force: true})
    props.selectItem(item)
}

</script>