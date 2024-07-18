<template>
    <div ref="el">
        <p v-if="!fetcher.hasMoreObjects && fetcher.objects.length === 0" class="info-box">
            {{ emptyMessage || 'Geen resultaten' }}
        </p>

        <Spinner v-if="fetcher.hasMoreObjects" />
    </div>
</template>

<script setup lang="ts" generic="ObjectType extends {id: string}">
import { onMounted, onUnmounted, ref } from 'vue';
import Spinner from '../Spinner.vue';
import { InfiniteObjectFetcher } from './classes';


const props = defineProps<{
    fetcher: InfiniteObjectFetcher<ObjectType>,
    emptyMessage?: string,
}>()
const el = ref<HTMLElement | null>(null);

// Keep track whether the ref stays in view
const observer = new IntersectionObserver((entries) => {
    console.log('IntersectionObserver', entries[0].isIntersecting)
    props.fetcher.setReachedEnd(entries[0].isIntersecting)
}, {
    root: null,
    rootMargin: '0px',
    threshold: 0.1,
});

onMounted(() => {
    observer.observe(el.value!);
});

onUnmounted(() => {
    observer.disconnect();
});
</script>
