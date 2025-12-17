<template>
    <LoadingViewTransition>
        <div v-if="!loading" id="documents-view" class="st-view background">
            <STNavigationBar :title="$t(`2f140e22-4940-453f-8f49-871a69f0776e`)" />

            <main class="center">
                <h1 class="style-navigation-title">
                    {{ $t('a01ee6b1-f27f-4ad2-a87c-28bce4dedfbd') }}
                </h1>

                <p v-if="disableActivities" class="error-box">
                    {{ $t('bb17dafc-4305-4213-90c9-2bb2701d777f') }}
                </p>

                <p class="style-description">
                    {{ $t('72810aaa-d33f-414f-bab1-6c33aca18823') }}
                </p>

                <STList>
                    <STListItem v-for="template of templates" :key="template.id" :selectable="true" class="right-stack" @click="openTemplate(template)">
                        <h2 class="style-title-list">
                            {{ template.settings.name }}
                        </h2>
                        <p class="style-description-small">
                            {{ $t('b6391640-1e01-47f9-913d-360fb0903b75') }} {{ formatDate(template.createdAt) }}
                        </p>

                        <template #right>
                            <span v-if="template.status === 'Draft'" class="style-tag">{{ $t('a4b33491-0ace-4b39-aba6-79371659fd51') }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <p class="style-button-bar">
                    <button type="button" class="button text" @click="addDocument">
                        <span class="icon add" />
                        <span class="text">{{ $t('6e1522d7-e084-4ec1-a4dc-47b93a88f4c8') }}</span>
                    </button>
                </p>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, defineRoutes, useNavigate, usePresent } from '@simonbackx/vue-app-navigation';
import { LoadingViewTransition, STList, STListItem, STNavigationBar, Toast, useContext, useRequiredOrganization } from '@stamhoofd/components';
import { DocumentTemplatePrivate } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { useRequestOwner } from '@stamhoofd/networking';
import { ComponentOptions, computed, onActivated, onMounted, ref, Ref } from 'vue';
import DocumentTemplateOverview from './DocumentTemplateOverview.vue';
import EditDocumentTemplateView from './EditDocumentTemplateView.vue';
import { fiscal } from './definitions/fiscal';

const templates: Ref<DocumentTemplatePrivate[]> = ref([]);
const fiscalDocumentYears = computed(() => new Set(templates.value.filter(t => t.privateSettings.templateDefinition.type === fiscal.type).map(t => t.year)));

const loading = ref(true);
const organization = useRequiredOrganization();
const requestOwner = useRequestOwner();
const context = useContext();
const present = usePresent();

onMounted(() => {
    loadTemplates().catch(console.error);
});

onActivated(() => {
    loadTemplates().catch(console.error);
});

enum Routes {
    DocumentTemplate = 'DocumentTemplate',
}
const $navigate = useNavigate();
defineRoutes([
    {
        name: Routes.DocumentTemplate,
        url: '@slug',
        component: DocumentTemplateOverview as ComponentOptions,
        params: {
            slug: String,
        },
        paramsToProps: async (params: { slug: string }) => {
            const loadedTemplates = templates.value.length ? templates.value : await loadTemplates();
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

function formatDate(date: Date) {
    return Formatter.date(date);
}

async function loadTemplates() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/organization/document-templates',
            decoder: new ArrayDecoder(DocumentTemplatePrivate as Decoder<DocumentTemplatePrivate>),
            shouldRetry: false,
            owner: requestOwner,
        });
        templates.value = response.data;

        loading.value = false;
        return response.data;
    }
    catch (e) {
        console.error(e);
        Toast.fromError(e).show();
    }
    loading.value = false;
    return [];
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
                document: DocumentTemplatePrivate.create({}),
                callback: (template: DocumentTemplatePrivate) => {
                    templates.value.push(template);
                    openTemplate(template).catch(console.error);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

async function openTemplate(template: DocumentTemplatePrivate) {
    await $navigate(Routes.DocumentTemplate, { properties: { template, fiscalDocumentYears: fiscalDocumentYears.value } });
}
</script>
