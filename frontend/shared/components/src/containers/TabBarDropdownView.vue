<template>
    <nav class="st-view">
        <STNavigationBar v-if="!popup" :title="group.name" />

        <main ref="box">
            <h1 v-if="!popup">
                {{ group.name }}
            </h1>
            <STList>
                <STListItem v-for="(item, index) in group.items" :key="index" :selectable="true" element-name="button" class="left-center" :class="{ selected: item.isSelected(selectedItem) }" @click="selectTab(item)">
                    <template #left>
                        <span :class="'icon '+item.icon" />
                    </template>
                    <span>{{ item.name }}</span>
                    <template #right>
                        <span v-if="unref(item.badge)" class="style-bubble">{{ unref(item.badge) }}</span>
                        <span v-if="item.isGroup" class="icon arrow-down-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </nav>
</template>

<script setup lang="ts">
import { defineRoutes, useDismiss, useNavigate, usePopup, useShow } from '@simonbackx/vue-app-navigation';
import { Formatter } from '@stamhoofd/utility';
import { ComponentPublicInstance, computed, getCurrentInstance, ref, unref } from 'vue';

import { TabBarItem, TabBarItemGroup } from './TabBarItem';

const props = defineProps<{
    group: TabBarItemGroup,
    selectedItem: TabBarItem|null,
    selectItem: (item: TabBarItem) => void,
}>()
type TabBarItemWithComponent = TabBarItem & Required<Pick<TabBarItem, 'component'>>;
const flatTabs = computed<TabBarItemWithComponent[]>(() => props.group.items.flatMap(t => t.items as TabBarItemWithComponent[]).filter(t => !!t.component))

const dismiss = useDismiss()
const box = ref<HTMLElement|null>(null);
const popup = usePopup()
const $navigate = useNavigate()
const show = useShow()
const instance = getCurrentInstance()

defineRoutes(flatTabs.value.map(tab => {
    return {
        name: tab.name,
        url: Formatter.slug(tab.name),
        handler: async (options) => {
            if (options.checkRoutes) {
                tab.component.setCheckRoutes()
            }
            await show({
                ...(options as any),
                components: [tab.component]
            })
        }
    }
}))

const selectTab = async (item: TabBarItem) => {
    if (item.action) {
        await item.action.call(instance!.proxy as ComponentPublicInstance)
        return;
    }
    if (!unref(popup)) {
        await $navigate(item.name);
        return;
    }
    await dismiss({force: true})
    props.selectItem(item)
}
</script>
