<template>
    <figure class="style-image-with-icon">
        <slot>
            <!-- fallback content -->
            <figure v-if="icon">
                <span class="icon" :class="icon" />
            </figure>
        </slot>

        <aside v-if="$slots.aside">
            <slot name="aside" />
        </aside>
    </figure>
</template>

<script lang="ts" setup>
defineProps<{ icon?: string }>();
</script>
