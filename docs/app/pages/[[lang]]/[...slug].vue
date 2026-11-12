<template>
    <div v-if="page" class="docs-article-layout">
        <DocsArticleNavigation :page="page" />
        <article class="docs-article">
            <header class="docs-article-header">
                <NuxtLink to="/" class="docs-overview-link">
                    <span class="icon arrow-left" aria-hidden="true" />
                    Overzicht
                </NuxtLink>
                <h1>{{ page.title }}</h1>
                <div v-if="page.links?.length" class="docs-article-links">
                    <UButton v-for="(link, index) in page.links" :key="index" v-bind="link" />
                </div>
            </header>
            <ContentRenderer :value="page" class="docs-prose" />
        </article>
    </div>
</template>

<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content';
import { findPageHeadline } from '@nuxt/content/utils';

definePageMeta({ layout: 'docs' });

const route = useRoute();
const navigation = inject<Ref<ContentNavigationItem[]>>('navigation', ref([]));
const { data: page } = await useAsyncData(`docs-page-${route.path}`, () => queryCollection('docs').path(route.path).first());

if (!page.value) {
    throw createError({ statusCode: 404, statusMessage: 'Pagina niet gevonden', fatal: true });
}

const title = computed(() => page.value?.seo?.title || page.value?.title);
const description = computed(() => page.value?.seo?.description || page.value?.description);
const breadcrumbs = computed(() => findPageBreadcrumbs(navigation.value, page.value?.path || ''));

useSeo({
    title,
    description,
    type: 'article',
    modifiedAt: (page.value as unknown as Record<string, unknown>).modifiedAt as string | undefined,
    breadcrumbs,
});
defineOgImage('Docs', {
    headline: findPageHeadline(navigation.value, page.value.path),
    title: formatOgTitle(title.value),
    description: formatOgDescription(title.value, description.value),
});
</script>
