<template>
    <div class="block">
        <button class="hover-box menu-button button" type="button" :class="{ selected }" v-bind="$attrs" @click="$emit('open', $event)">
            <span :class="'icon small ' + (icon ? icon : (collapsed.isCollapsed(id) ? 'folder' : 'folder-open'))" />
            <span>{{ title }}</span>
            <button type="button" class="icon triangle-down rot tiny button" :class="{rot90: collapsed.isCollapsed(id)}" @click.stop="collapsed.toggle(id)" />

            <span class="right hover-show">
                <slot name="right" />
            </span>
        </button>

        <div v-if="!collapsed.isCollapsed(id)" class="items">
            <slot />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useCollapsed } from './useCollapsed';

defineOptions({
    inheritAttrs: false,
});

const props = withDefaults(
    // props
    defineProps<{
        id: string;
        title: string;
        icon?: string | null;

        /**
         * todo: not sure if we need to support this
         */
        selected?: boolean;

        /**
         * Defines saved collapse state
         */
        type: 'members' | 'webshop';
    }>(),
    {
        icon: null,
        selected: false,
    },
);
defineEmits<{
    open: [value: MouseEvent];
}>();
const collapsed = useCollapsed(props.type, true);

</script>

<style lang="scss">
/*@use "@stamhoofd/scss/base/variables" as *;
@use "@stamhoofd/scss/base/text-styles" as *;*/

</style>
