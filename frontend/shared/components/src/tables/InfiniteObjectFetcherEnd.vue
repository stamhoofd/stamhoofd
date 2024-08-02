<template>
    <div ref="el" class="infinite-object-fetcher-end">
        <p v-if="!fetcher.hasMoreObjects && fetcher.objects.length === 0" class="info-box">
            {{ emptyMessage || 'Geen resultaten' }}
        </p>

        <div v-if="fetcher.hasMoreObjects" class="spinner-container center">
            <Spinner />
        </div>
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
    props.fetcher.setReachedEnd(false)
    observer.disconnect();
});
</script>


<style lang="scss">
.infinite-object-fetcher-end > .spinner-container {
    margin-top: 20px;
}

</style>
