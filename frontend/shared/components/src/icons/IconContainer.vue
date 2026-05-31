<template>
    <figure class="style-image-with-icon">
        <slot>
            <!-- fallback content -->
            <figure v-if="icon" :class="{pad: false && !!$slots.aside}">
                <span class="icon small" :class="icon" />
            </figure>
        </slot>

        <aside v-if="$slots.aside">
            <slot name="aside" />
        </aside>
        <aside v-else-if="asideIcon">
            <span :class="'icon tiny ' + asideIcon" />
        </aside>
    </figure>
</template>

<script lang="ts" setup>
withDefaults(
    defineProps<{
        icon?: string;
        asideIcon?: string;
    }>(), {
        icon: '',
        asideIcon: '',
    },
);
</script>

<style lang="scss" scoped>

:slotted(.image-component) img {
    object-fit: cover;
}
</style>
