<template>
    <div ref="el" class="infinite-object-fetcher-end">
        <template v-if="!fetcher.hasMoreObjects && fetcher.objects.length === 0">
            <slot name="empty">
                <p class="info-box">
                    {{ emptyMessage }}
                </p>
            </slot>
        </template>

        <div v-if="fetcher.hasMoreObjects" class="spinner-container center">
            <Spinner />
        </div>
    </div>
</template>

<script setup lang="ts" generic="ObjectType extends {id: string}">
import { onMounted, onUnmounted, ref } from 'vue';
import Spinner from '../Spinner.vue';
import type { InfiniteObjectFetcher } from '#tables/classes/InfiniteObjectFetcher.ts';

const props = withDefaults(defineProps<{
    fetcher: InfiniteObjectFetcher<ObjectType>;
    emptyMessage?: string;
}>(), {
    emptyMessage: $t('%1XB'),
});

const el = ref<HTMLElement | null>(null);

// Keep track whether the ref stays in view
const observer = new IntersectionObserver((entries) => {
    props.fetcher.setReachedEnd(entries[0].isIntersecting);
}, {
    root: null,
    rootMargin: '0px',
    threshold: 0.1,
});

onMounted(() => {
    observer.observe(el.value!);
});

onUnmounted(() => {
    props.fetcher.setReachedEnd(false);
    observer.disconnect();
});
</script>

<style lang="scss">
.infinite-object-fetcher-end {
    // Reduced animation glitches
    min-height: 60px;

    &:empty {
        min-height: 0;
    }
}

.infinite-object-fetcher-end > .spinner-container {
    margin-top: 20px;
}

</style>
