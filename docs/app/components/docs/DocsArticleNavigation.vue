<template>
    <aside class="docs-article-navigation" aria-label="Artikelnavigatie">
        <UContentToc
            v-if="page.body?.toc?.links?.length"
            v-model:open="open"
            title="Op deze pagina"
            :links="page.body.toc.links"
            :highlight="false"
            :ui="{
                root: 'docs-toc',
                container: 'docs-toc-container',
                content: 'docs-toc-content',
                trigger: 'docs-toc-trigger',
                title: 'docs-toc-title',
                list: 'docs-toc-list',
                listWithChildren: 'docs-toc-list docs-toc-child-list',
                item: 'docs-toc-item',
                itemWithChildren: 'docs-toc-item',
                link: 'docs-toc-link',
                linkText: 'docs-toc-link-text',
            }"
            @move="onMove"
        >
            <template #trailing="{ open: expanded }">
                <span class="icon docs-toc-chevron" :class="expanded ? 'arrow-up-small' : 'arrow-down-small'" aria-hidden="true" />
            </template>
        </UContentToc>
        <nav v-if="categories.length" class="docs-article-categories" aria-labelledby="docs-categories-title">
            <h2 id="docs-categories-title">Alle categorieën</h2>
            <ul>
                <li v-for="category in categories" :key="category.path">
                    <NuxtLink :to="`/#categorie-${category.path.split('/').filter(Boolean).join('-')}`">{{ category.title }}</NuxtLink>
                </li>
            </ul>
        </nav>
    </aside>
</template>

<script setup lang="ts">
import type { Collections, ContentNavigationItem } from '@nuxt/content';

defineProps<{ page: Collections['docs'] }>();

const open = ref(false);
const navigation = inject<Ref<ContentNavigationItem[]>>('navigation', ref([]));
const categories = computed(() => (navigation.value ?? []).filter(section => section.children?.length));

async function onMove(id: string): Promise<void> {
    if (!open.value) {
        return;
    }

    open.value = false;
    await nextTick();
    document.getElementById(id)?.scrollIntoView({ behavior: 'instant', block: 'start' });
}
</script>
