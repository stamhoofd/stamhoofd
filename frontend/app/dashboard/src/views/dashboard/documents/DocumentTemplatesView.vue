<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar :title="$t(`2f140e22-4940-453f-8f49-871a69f0776e`)">
            <template #right>
                <button type="button" class="button text navigation" @click="addDocument()">
                    <span class="icon add" />
                    <span>{{ $t('Nieuw') }}</span>
                </button>
            </template>
        </STNavigationBar>

        <main class="center">
            <h1>
                {{ $t(`2f140e22-4940-453f-8f49-871a69f0776e`) }}
            </h1>

            <p v-if="disableActivities" class="error-box">
                {{ $t('bb17dafc-4305-4213-90c9-2bb2701d777f') }}
            </p>

            <p class="style-description">
                {{ $t('72810aaa-d33f-414f-bab1-6c33aca18823') }}
            </p>
            <div class="input-with-buttons">
                <div>
                    <form class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                        <input v-model="searchQuery" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`01e2b860-7045-4a0c-84ca-2303346d14b2`)">
                    </form>
                </div>
                <div>
                    <button type="button" class="button text" @click="editFilter">
                        <span class="icon filter" />
                        <span class="hide-small">{{ $t('de5706ec-7edc-4e62-b3f7-d6e414720480') }}</span>
                        <span v-if="!isEmptyFilter(fetcher.baseFilter)" class="icon dot primary" />
                    </button>
                </div>
            </div>
            <ScrollableSegmentedControl v-model="selectedTab" :items="tabItems" :labels="yearLabels" />
            <div v-for="(group, index) of groupedTemplates" :key="group.title" class="container">
                <hr v-if="index > 0"><h2 v-if="shouldShowTitles">
                    {{ Formatter.capitalizeFirstLetter(group.title) }}
                </h2>
                <STList>
                    <STListItem v-for="template of group.templates" :key="template.id" :selectable="true" class="right-stack" @click="openTemplate(template)">
                        <h2 class="style-title-list">
                            {{ template.settings.name }}
                        </h2>
                        <p class="style-description-small">
                            {{ $t('b6391640-1e01-47f9-913d-360fb0903b75') }} {{ Formatter.date(template.createdAt) }}
                        </p>
                        <template #right>
                            <span v-if="template.status === 'Draft'" class="style-tag">{{ $t('a4b33491-0ace-4b39-aba6-79371659fd51') }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </div>

            <InfiniteObjectFetcherEnd :fetcher="fetcher" :empty-message="$t(`Geen documenten gevonden`)" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, defineRoutes, NavigationController, useNavigate, usePresent } from '@simonbackx/vue-app-navigation';
import { InfiniteObjectFetcherEnd, ScrollableSegmentedControl, STList, STListItem, STNavigationBar, Toast, UIFilter, UIFilterEditor, useDocumentTemplatesObjectFetcher, useGlobalEventListener, useInfiniteObjectFetcher, usePositionableSheet, useRequiredOrganization } from '@stamhoofd/components';
import { DocumentTemplatePrivate, isEmptyFilter, StamhoofdFilter } from '@stamhoofd/structures';
import { FiscalDocumentHelper, Formatter } from '@stamhoofd/utility';

import { getDocumentTemplateUIFilterBuilders } from '@stamhoofd/components/src/filters/filter-builders/document-templates';
import { ComponentOptions, computed, ref, Ref, watch, watchEffect } from 'vue';
import DocumentTemplateOverview from './DocumentTemplateOverview.vue';
import EditDocumentTemplateView from './EditDocumentTemplateView.vue';
import { fiscal } from './definitions/fiscal';

type ObjectType = DocumentTemplatePrivate;

enum Routes {
    DocumentTemplate = 'DocumentTemplate',
}

enum TabItem {
    Recent = 'Recent',
    Archive = 'Archive',
}

const fiscalDocumentHelper = new FiscalDocumentHelper();
const firstYearToShow = fiscalDocumentHelper.defaultCalendarYear;

const organization = useRequiredOrganization();
const present = usePresent();
const navigate = useNavigate();
const { presentPositionableSheet } = usePositionableSheet();

defineRoutes([
    {
        name: Routes.DocumentTemplate,
        url: '@slug',
        component: DocumentTemplateOverview as ComponentOptions,
        params: {
            slug: String,
        },
        paramsToProps: async (params: { slug: string }) => {
            // todo
            const loadedTemplates = templates.value;

            const template = loadedTemplates.find(t => Formatter.slug(t.settings.name) === params.slug);
            if (!template) {
                Toast.error('Document niet gevonden').show();
                throw new Error('Document not found');
            }

            return {
                template,
                fiscalDocumentYears: fiscalDocumentYears.value,
            };
        },

        propsToParams(props) {
            if (!('template' in props) || typeof props.template !== 'object' || props.template === null || !(props.template instanceof DocumentTemplatePrivate)) {
                throw new Error('Missing event');
            }
            const template = props.template;

            return {
                params: {
                    slug: Formatter.slug(template.settings.name),
                },
            };
        },
    },
]);

const searchQuery = ref('');
const selectedTab = ref(firstYearToShow) as Ref<number | null>;
const objectFetcher = useDocumentTemplatesObjectFetcher({
    get requiredFilter() {
        return getRequiredFilter();
    },
});

const fetcher = useInfiniteObjectFetcher<ObjectType>(objectFetcher);
const templates: Ref<DocumentTemplatePrivate[]> = computed(() => fetcher.objects);
const groupedTemplates = computed(() => groupTemplates(templates.value));
const shouldShowTitles = computed(() => groupedTemplates.value.length > 1
    // always show title in archive tab
    || (typeof selectedTab.value !== 'number' && selectedTab.value === TabItem.Archive),
);

const tabItems = [firstYearToShow, firstYearToShow - 1, TabItem.Archive];

const yearLabels = tabItems.map((y) => {
    switch (y) {
        case TabItem.Recent: return $t('Recent');
        case TabItem.Archive: return $t('Archief');
        default: return $t(`Kalenderjaar {year}`, { year: y.toString() });
    }
},
);

const filterBuilders = getDocumentTemplateUIFilterBuilders();
const selectedUIFilter = ref(null) as Ref<null | UIFilter>;

const fiscalDocumentYears = computed(() => new Set(templates.value.filter(t => t.privateSettings.templateDefinition.type === fiscal.type).map(t => t.year)));

watchEffect(() => {
    fetcher.setSearchQuery(searchQuery.value);
    const filter = selectedUIFilter.value ? selectedUIFilter.value.build() : null;
    fetcher.setFilter(filter);
});

function blurFocus() {
    (document.activeElement as HTMLElement)?.blur();
}

const disableActivities = computed(() => organization.value.meta.packages.disableActivities);

function addDocument() {
    if (organization.value.meta.packages.disableActivities) {
        new Toast($t('f0ff8a76-a986-440c-b966-a5579e0844f4'), 'error red').show();
        return;
    }

    present({
        components: [
            new ComponentWithProperties(EditDocumentTemplateView, {
                isNew: true,
                fiscalDocumentYears: fiscalDocumentYears.value,
                document: DocumentTemplatePrivate.create({
                    year: firstYearToShow,
                }),
                callback: (template: DocumentTemplatePrivate) => {
                    fetcher.reset();
                    openTemplate(template).catch(console.error);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

async function openTemplate(template: DocumentTemplatePrivate) {
    await navigate(Routes.DocumentTemplate, { properties: { template, fiscalDocumentYears: fiscalDocumentYears.value } });
}

async function editFilter(event: MouseEvent) {
    if (!filterBuilders) {
        return;
    }
    const filter = selectedUIFilter.value ?? filterBuilders[0].create();
    if (!selectedUIFilter.value) {
        selectedUIFilter.value = filter;
    }

    await presentPositionableSheet(event, {
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(UIFilterEditor, {
                    filter,
                }),
            }),
        ],
    });
}

function getRequiredFilter(): StamhoofdFilter | null {
    if (selectedTab.value !== null) {
        const filters: StamhoofdFilter = {};
        if (typeof selectedTab.value === 'number') {
            if (selectedTab.value === firstYearToShow) {
                // Also include documents for higher years to prevent documents for future years from not showing up.
                filters['year'] = {
                    $gte: selectedTab.value,
                };
            }
            else {
                filters['year'] = { $eq: selectedTab.value };
            }
        }
        else {
            switch (selectedTab.value) {
                case TabItem.Archive:
                    // archive documents are documents older than 2 years
                    filters['year'] = {
                        $lt: firstYearToShow - 1,
                    };
            }
        }
        return filters;
    }

    return null;
}

type GroupedTemplates = { title: string; templates: DocumentTemplatePrivate[] };

function groupTemplates(templates: DocumentTemplatePrivate[]): GroupedTemplates[] {
    const map = new Map<number, DocumentTemplatePrivate[]>();
    for (const template of templates) {
        const key = template.year;
        const list = map.get(key) ?? [];
        list.push(template);
        map.set(key, list);
    }

    return Array.from(map.entries())
        .sort(([a], [b]) => b - a)
        .map(([year, templates]) => ({ title: $t(`Kalenderjaar {year}`, { year: year.toString() }), templates }));
}

useGlobalEventListener('document-template-deleted', async () => {
    fetcher.reset();
});

watch(selectedTab, () => {
    fetcher.reset();
});

</script>
