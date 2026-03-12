<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar :title="$t(`%tw`)">
            <template #right>
                <button type="button" class="button text navigation" @click="addDocument()">
                    <span class="icon add" />
                    <span>{{ $t('%1IY') }}</span>
                </button>
            </template>
        </STNavigationBar>

        <main class="center">
            <h1>
                {{ $t(`%tw`) }}
            </h1>

            <p v-if="disableActivities" class="error-box">
                {{ $t('%Kl') }}
            </p>

            <p class="style-description">
                {{ $t('%Km') }}
            </p>
            <div class="input-with-buttons">
                <div>
                    <form class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                        <input v-model="searchQuery" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`%KC`)">
                    </form>
                </div>
                <div>
                    <button type="button" class="button text" @click="editFilter">
                        <span class="icon filter" />
                        <span class="hide-small">{{ $t('%2J') }}</span>
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
                            {{ $t('%1JJ') }} {{ Formatter.date(template.createdAt) }}
                        </p>
                        <template #right>
                            <span v-if="template.status === 'Draft'" class="style-tag">{{ $t('%Kn') }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </div>

            <InfiniteObjectFetcherEnd :fetcher="fetcher" :empty-message="$t(`%1Ia`)" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, defineRoutes, NavigationController, useNavigate, usePresent } from '@simonbackx/vue-app-navigation';
import InfiniteObjectFetcherEnd from '@stamhoofd/components/tables/InfiniteObjectFetcherEnd.vue';
import ScrollableSegmentedControl from '@stamhoofd/components/inputs/ScrollableSegmentedControl.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { UIFilter } from '@stamhoofd/components/filters/UIFilter.ts';
import UIFilterEditor from '@stamhoofd/components/filters/UIFilterEditor.vue';
import { useDocumentTemplatesObjectFetcher } from '@stamhoofd/components/fetchers/useDocumentTemplatesObjectFetcher.ts';
import { useGlobalEventListener } from '@stamhoofd/components/hooks/useGlobalEventListener.ts';
import { useInfiniteObjectFetcher } from '@stamhoofd/components/tables/classes/InfiniteObjectFetcher.ts';
import { usePositionableSheet } from '@stamhoofd/components/tables/usePositionableSheet.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { DocumentTemplatePrivate, isEmptyFilter, LimitedFilteredRequest, StamhoofdFilter } from '@stamhoofd/structures';
import { FiscalDocumentYearHelper, Formatter } from '@stamhoofd/utility';

import { getDocumentTemplateUIFilterBuilders } from '@stamhoofd/components/filters/filter-builders/document-templates.ts';
import { ComponentOptions, computed, ref, Ref, watch, watchEffect } from 'vue';
import DocumentTemplateOverview from './DocumentTemplateOverview.vue';
import EditDocumentTemplateView from './EditDocumentTemplateView.vue';

type ObjectType = DocumentTemplatePrivate;

enum Routes {
    DocumentTemplate = 'DocumentTemplate',
}

enum TabItem {
    Archive = 'Archive',
}

const fiscalDocumentYearHelper = new FiscalDocumentYearHelper();
const firstYearToShow = fiscalDocumentYearHelper.year;

const organization = useRequiredOrganization();
const present = usePresent();
const navigate = useNavigate();
const { presentPositionableSheet } = usePositionableSheet();

defineRoutes([
    {
        name: Routes.DocumentTemplate,
        url: '@id',
        component: DocumentTemplateOverview as ComponentOptions,
        params: {
            id: String,
        },
        paramsToProps: async (params: { id: string }) => {
            let template = templates.value.find(t => t.id === params.id);
            if (!template) {
                // Fetch template
                const templates = await fetcher.objectFetcher.fetch(
                    new LimitedFilteredRequest({
                        filter: {
                            id: params.id,
                        },
                        limit: 1,
                        sort: [],
                    }),
                );

                if (templates.results.length === 1) {
                    template = templates.results[0];
                }
                else {
                    Toast.error('Document niet gevonden').show();
                    throw new Error('Document not found');
                }
            }

            return {
                template,
            };
        },

        propsToParams(props) {
            if (!('template' in props) || typeof props.template !== 'object' || props.template === null || !(props.template instanceof DocumentTemplatePrivate)) {
                throw new Error('Missing document');
            }
            const template = props.template;

            return {
                params: {
                    id: template.id,
                },
            };
        },
    },
]);

const searchQuery = ref('');
const selectedTab = ref(firstYearToShow) as Ref<number | null | TabItem>;
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

function setTabItemFromYear(year: number) {
    function getTabItemFromYear(year: number) {
        if (year >= firstYearToShow) {
            return firstYearToShow;
        }

        const secondYearToShow = firstYearToShow - 1;
        if (year === secondYearToShow) {
            return secondYearToShow;
        }

        return TabItem.Archive;
    }

    selectedTab.value = getTabItemFromYear(year);
}

const yearLabels = tabItems.map((y) => {
    switch (y) {
        case TabItem.Archive: return $t('%1IZ');
        default: return $t(`%1Ib`, { year: y.toString() });
    }
},
);

const filterBuilders = getDocumentTemplateUIFilterBuilders();
const selectedUIFilter = ref(null) as Ref<null | UIFilter>;

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
        new Toast($t('%5a'), 'error red').show();
        return;
    }

    let year: number;

    if (typeof selectedTab.value === 'number') {
        year = selectedTab.value;
    }
    else {
        year = firstYearToShow;
    }

    present({
        components: [
            new ComponentWithProperties(EditDocumentTemplateView, {
                isNew: true,
                document: DocumentTemplatePrivate.create({
                    year,
                }),
                callback: (template: DocumentTemplatePrivate) => {
                    fetcher.reset();
                    setTabItemFromYear(template.year);
                    openTemplate(template).catch(console.error);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

async function openTemplate(template: DocumentTemplatePrivate) {
    await navigate(Routes.DocumentTemplate, { properties: { template } });
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
        .map(([year, templates]) => ({ title: $t(`%1Ib`, { year: year.toString() }), templates }));
}

useGlobalEventListener('document-template-deleted', async () => {
    fetcher.reset();
});

watch(selectedTab, () => {
    fetcher.reset();
});

</script>
