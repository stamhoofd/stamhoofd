<template>
    <LoadingViewTransition>
        <div v-if="!loading" id="documents-view" class="st-view background">
            <STNavigationBar :title="$t(`Documenten`)"/>

            <main class="center">
                <h1 class="style-navigation-title">
                    {{ $t('eeb261d4-2a8d-46f3-ae06-f294fa1721a6') }}
                </h1>

                <p v-if="disableActivities" class="error-box">
                    {{ $t('d124789b-9938-4908-b761-03e2c099d554') }}
                </p>

                <p class="style-description">
                    {{ $t('f1b88265-be98-486d-bfc1-1aa59ddfceb4') }}
                </p>

                <p v-if="!enabled" class="info-box">
                    {{ $t('deef1768-d96e-4fa2-baee-1e2b7b209646') }}
                </p>

                <STList>
                    <STListItem v-for="template of templates" :key="template.id" :selectable="true" class="right-stack" @click="openTemplate(template)">
                        <h2 class="style-title-list">
                            {{ template.settings.name }}
                        </h2>
                        <p class="style-description-small">
                            {{ $t('25981b4f-4483-47f9-8c3a-ac5e7bdc1a69') }} {{ formatDate(template.createdAt) }}
                        </p>

                        <template #right>
                            <span v-if="template.status === 'Draft'" class="style-tag">{{ $t('56df9ce7-5a68-4c6c-b389-267625628782') }}</span>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>
                </STList>

                <p v-if="enabled" class="style-button-bar">
                    <button type="button" class="button text" @click="addDocument">
                        <span class="icon add"/>
                        <span class="text">{{ $t('39a008a7-3ac7-4b2e-9026-9e2865643b71') }}</span>
                    </button>
                </p>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, defineRoutes, useNavigate, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { LoadingViewTransition, STList, STListItem, STNavigationBar, Toast, useContext, useFeatureFlag, useRequiredOrganization } from '@stamhoofd/components';
import { DocumentTemplatePrivate } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { useTranslate } from '@stamhoofd/frontend-i18n';
import { useRequestOwner } from '@stamhoofd/networking';
import { ComponentOptions, computed, onActivated, onMounted, ref, Ref } from 'vue';
import DocumentTemplateOverview from './DocumentTemplateOverview.vue';
import EditDocumentTemplateView from './EditDocumentTemplateView.vue';

const templates: Ref<DocumentTemplatePrivate[]> = ref([]);
const loading = ref(true);
const organization = useRequiredOrganization();
const requestOwner = useRequestOwner();
const context = useContext();
const present = usePresent();
const $t = useTranslate();
const enabled = useFeatureFlag()('documents');

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
    await $navigate(Routes.DocumentTemplate, { properties: { template } });
}
</script>
