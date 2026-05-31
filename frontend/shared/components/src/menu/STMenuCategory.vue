<template>
    <div class="block">
        <button v-if="id ?? title" class="hover-box st-menu-item title button" type="button" :class="{ selected }" @click="$emit('open', $event)">
            <span>{{ title }}</span>
            <button v-if="id" type="button" class="icon button triangle-down rot tiny" :class="{rot90: collapsed.isCollapsed(id)}" @click.stop="collapsed.toggle(id)" />
        </button>

        <div v-if="!id || !collapsed.isCollapsed(id)" class="items">
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
        id?: string | null;
        title?: string | null;

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
        id: null,
        title: null,
        selected: false,
    },
);
defineEmits<{
    open: [value: MouseEvent];
}>();
const collapsed = useCollapsed(props.type);

</script>

<style lang="scss">
/*@use "@stamhoofd/scss/base/variables" as *;
@use "@stamhoofd/scss/base/text-styles" as *;*/

</style>
