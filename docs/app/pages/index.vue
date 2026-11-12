<template>
    <div>
        <header class="docs-home-hero">
            <h1>{{ title }}</h1>
            <p>{{ description }}</p>
            <button type="button" class="docs-home-search" @click="open = true">
                <span class="icon search" aria-hidden="true" />
                <span>Zoek naar informatie over...</span>
            </button>
        </header>

        <div class="docs-category-grid">
            <section v-for="section in sections" :id="`categorie-${section.path.split('/').filter(Boolean).join('-')}`" :key="section.path" class="docs-category">
                <h2>{{ section.title }}</h2>
                <div :id="`artikels-${section.path}`">
                    <ul>
                        <li v-for="article in articlesFor(section)" :key="article.path">
                            <NuxtLink :to="article.path">
                                {{ article.title }}
                            </NuxtLink>
                        </li>
                    </ul>
                </div>
                <button
                    v-if="hasMore(section)"
                    type="button"
                    class="docs-category-toggle"
                    :aria-expanded="isExpanded(section)"
                    :aria-controls="`artikels-${section.path}`"
                    @click="toggle(section)"
                >
                    {{ isExpanded(section) ? 'Verberg' : 'Toon alles' }}
                    <span class="icon" :class="isExpanded(section) ? 'arrow-up-small' : 'arrow-right-small'" aria-hidden="true" />
                </button>
            </section>
        </div>
        <SiteSupport />
    </div>
</template>
<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content';

// Defining this page makes Docus skip its own markdown-driven landing (see
// `landingPageExists` in the docus layer), so the landing is built from the
// content navigation at render time and can never drift from the actual docs.

/** Articles listed per section before the rest collapses behind "Toon alle". */
const VISIBLE_ARTICLES = 8;

const title = 'Documentatie';
const description = 'Heb je een vraag of wil je weten hoe iets werkt? Dan vind je alle nodige informatie hier. Lees na hoe je bepaalde functies optimaal gebruikt.';
const { open } = useContentSearch();

useSeo({ title, description, type: 'website' });

// Docus' app.vue already queries the docs navigation and provides it, so the
// landing lists exactly what the sidebar does.
const navigation = inject<Ref<ContentNavigationItem[]>>('navigation', ref([]));

const sections = computed(() => (navigation.value ?? []).filter(section => section.children?.length));

const expanded = ref<string[]>([]);

function isExpanded(section: ContentNavigationItem): boolean {
    return expanded.value.includes(section.path);
}

function toggle(section: ContentNavigationItem): void {
    expanded.value = isExpanded(section)
        ? expanded.value.filter(path => path !== section.path)
        : [...expanded.value, section.path];
}

function articlesFor(section: ContentNavigationItem): ContentNavigationItem[] {
    const articles = section.children ?? [];
    return isExpanded(section) ? articles : articles.slice(0, VISIBLE_ARTICLES);
}

function hasMore(section: ContentNavigationItem): boolean {
    return (section.children?.length ?? 0) > VISIBLE_ARTICLES;
}
</script>
