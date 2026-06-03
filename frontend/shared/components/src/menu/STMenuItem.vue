<template>
    <button class="st-menu-item button" type="button" :class="{ selected }" v-bind="$attrs" @click="$emit('click', $event)">
        <span class="left">
            <slot name="icon">
                <span :class="'icon small ' + icon" />
            </slot>
        </span>
        <span>{{ title }}</span>
        <span v-if="rightText" class="right">{{ rightText }}</span>
    </button>
</template>

<script setup lang="ts">

defineOptions({
    inheritAttrs: false,
});

const props = withDefaults(
    // props
    defineProps<{
        icon?: string;
        title?: string;
        rightText?: string | null;

        /**
         * todo: not sure if we need to support this
         */
        selected?: boolean;
    }>(),
    {
        icon: '',
        title: '',
        rightText: null,
    },
);

</script>

<style lang="scss">
/*@use "@stamhoofd/scss/base/variables" as *;
@use "@stamhoofd/scss/base/text-styles" as *;*/

</style>
