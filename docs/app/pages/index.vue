<template>
    <div>
        <UPageHero :title="title" :description="description" :headline="headline" />

        <UPageSection>
            <UPageGrid>
                <UCard v-for="section in sections" :key="section.path">
                    <template #header>
                        <div class="flex items-center gap-2">
                            <UIcon v-if="section.icon" :name="String(section.icon)" class="size-5 shrink-0" />
                            <h2 class="font-semibold text-highlighted">
                                {{ section.title }}
                            </h2>
                        </div>
                    </template>

                    <ul class="space-y-3">
                        <li v-for="article in articlesFor(section)" :key="article.path">
                            <ULink :to="article.path" class="text-muted hover:text-primary">
                                {{ article.title }}
                            </ULink>
                        </li>
                    </ul>

                    <template v-if="hasMore(section)" #footer>
                        <UButton
                            variant="link"
                            color="primary"
                            class="p-0"
                            :trailing-icon="isExpanded(section) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-right'"
                            @click="toggle(section)"
                        >
                            {{ isExpanded(section) ? 'Verberg' : 'Toon alles' }}
                        </UButton>
                    </template>
                </UCard>
            </UPageGrid>
        </UPageSection>
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
const headline = 'Stamhoofd';

useSeoMeta({ title, description });

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
