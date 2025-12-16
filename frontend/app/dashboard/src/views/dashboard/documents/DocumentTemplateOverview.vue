<template>
    <div class="st-view background">
        <STNavigationBar :title="template.settings.name" />

        <main class="center">
            <h1 class="style-navigation-title">
                {{ template.settings.name }}
            </h1>

            <p v-if="isDraft" class="warning-box">
                {{ $t('eda9c1b1-f601-492a-b13e-cf88c5249a7b') }}
            </p>
            <p v-else class="success-box">
                {{ $t('26089c85-ad50-4c71-9013-4fadc243c12e') }}
            </p>

            <p v-if="!isDraft && template.updatesEnabled" class="warning-box">
                {{ $t('2c3cdda4-5e44-4c2b-bdc9-bb4c554e2894') }}
            </p>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Documents)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/agreement.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('a01ee6b1-f27f-4ad2-a87c-28bce4dedfbd') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('7b0f4117-9e6f-4c1b-b56e-c154b5defce3') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="isDraft || template.updatesEnabled" :selectable="true" class="left-center" @click="$navigate(Routes.Settings)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/edit-data.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('bab38c80-8ab6-4cb7-80c3-1f607057e45d') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('eb865045-d332-47f7-bb52-0eaa58785d67') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="!isDraft && xmlExportDescription" :selectable="true" class="left-center" @click="exportXml">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/code-export.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('6ba23b70-c6d5-46d2-815e-44955ce48eaf') }}
                    </h2>
                    <p class="style-description">
                        {{ xmlExportDescription }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <hr><h2>{{ $t('e9d4d5fb-ec7f-4a42-acc8-8f52a9bd4e7a') }}</h2>
            <p>{{ $t('fa988b87-6665-43e4-a177-77031826e9a8') }}</p>

            <Checkbox :model-value="template.updatesEnabled" :disabled="settingUpdatesEnabled" @update:model-value="toggleUpdatesEnabled">
                {{ $t('ecbe0afb-6a6c-4b67-8b11-3a75a182c344') }}
            </Checkbox>

            <hr><h2>{{ $t('dc052084-eea5-407e-8775-237bf550895a') }}</h2>

            <STList>
                <STListItem v-if="isDraft" :selectable="true" @click="publishTemplate()">
                    <h2 class="style-title-list">
                        {{ $t('38427cc3-27c9-4463-acdf-a2d073a8cdb7') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('bd4b350e-d06a-44aa-a2d6-a5ae140373ca') }}
                    </p>
                    <template #right>
                        <button type="button" class="button secundary green hide-smartphone">
                            <span class="icon success" />
                            <span>{{ $t('bd4ad024-9855-4623-9ef4-db5162466f53') }}</span>
                        </button>                    <button type="button" class="button icon success only-smartphone" />
                    </template>
                </STListItem>

                <STListItem v-if="!isDraft" :selectable="true" @click="draftTemplate()">
                    <h2 class="style-title-list">
                        {{ $t('28486bd5-7acc-4a49-84cf-8fbc2b2ba8b9') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('523d8098-13ec-4ef5-9851-c1bf768efdd6') }}
                    </p>
                    <template #right>
                        <button type="button" class="button secundary hide-smartphone">
                            <span class="icon edit" />
                            <span>{{ $t('782a7bd5-552f-46a3-b0e3-c18a71eb0ddc') }}</span>
                        </button>                    <button type="button" class="button icon edit only-smartphone" />
                    </template>
                </STListItem>

                <STListItem v-if="isDraft" :selectable="true" @click="deleteTemplate()">
                    <h2 class="style-title-list">
                        {{ $t('34869ab8-e70a-4d28-8805-b6afed8aacf2') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('9db9e26b-a180-48f1-b19e-c4f468dda563') }}
                    </p>
                    <template #right>
                        <button type="button" class="button secundary danger hide-smartphone">
                            <span class="icon trash" />
                            <span>{{ $t('1bb244c4-6ffb-4969-91e6-ea70f16ac5a4') }}</span>
                        </button>                    <button type="button" class="button icon trash only-smartphone" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, defineRoutes, NavigationController, useNavigate, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, FillRecordCategoryView, NavigationActions, STList, STListItem, STNavigationBar, Toast, useContext } from '@stamhoofd/components';
import { DocumentSettings, DocumentStatus, DocumentTemplatePrivate, PatchAnswers } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ComponentOptions, computed, ref } from 'vue';

import { AppManager, useRequestOwner } from '@stamhoofd/networking';
import DocumentsView from './DocumentsView.vue';
import EditDocumentTemplateView from './EditDocumentTemplateView.vue';

const props = defineProps<{
    fiscalDocumentYears: Set<number>;
    template: DocumentTemplatePrivate;
}>();

const present = usePresent();
const pop = usePop();
const requestOwner = useRequestOwner();
const context = useContext();
const deleting = ref(false);
const publishing = ref(false);
const $navigate = useNavigate();

enum Routes {
    Documents = 'documenten',
    Settings = 'instellingen',
}

defineRoutes([
    {
        url: Routes.Documents,
        component: DocumentsView as ComponentOptions,
        paramsToProps() {
            return {
                template: props.template,
            };
        },
    },
    {
        url: Routes.Settings,
        present: 'popup',
        component: EditDocumentTemplateView as ComponentOptions,
        paramsToProps() {
            return {
                isNew: false,
                fiscalDocumentYears: props.fiscalDocumentYears,
                document: props.template,
            };
        },
    },
]);

const isDraft = computed(() => props.template.status === DocumentStatus.Draft);

async function publishTemplate() {
    if (publishing.value) {
        return;
    }

    if (!(await CenteredMessage.confirm('Ben je zeker dat je alle documenten wilt publiceren?', 'Publiceren', 'Je kan de documenten hierna niet meer bewerken, en ze zijn zichtbaar voor alle leden.'))) {
        return;
    }
    await changeStatus(DocumentStatus.Published);
}

async function draftTemplate() {
    if (publishing.value) {
        return;
    }

    if (!(await CenteredMessage.confirm('Ben je zeker dat je alle documenten weer wilt verbergen?', 'Verbergen', 'Leden zullen de documenten opeens niet meer kunnen bekijken.'))) {
        return;
    }
    await changeStatus(DocumentStatus.Draft);
}

const settingUpdatesEnabled = ref(false);

async function patchTemplate(patch: AutoEncoderPatchType<DocumentTemplatePrivate>) {
    const arr: PatchableArrayAutoEncoder<DocumentTemplatePrivate> = new PatchableArray() as PatchableArrayAutoEncoder<DocumentTemplatePrivate>;
    patch.id = props.template.id;
    arr.addPatch(patch);

    try {
        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/organization/document-templates',
            body: arr,
            decoder: new ArrayDecoder(DocumentTemplatePrivate as Decoder<DocumentTemplatePrivate>),
            shouldRetry: false,
            timeout: 5 * 60 * 1000,
            owner: requestOwner,
        });
        const documentTemplates = response.data;
        const template = documentTemplates.find(t => t.id === props.template.id);
        if (template) {
            props.template.deepSet(template);
        }
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}

async function toggleUpdatesEnabled() {
    if (settingUpdatesEnabled.value) {
        return;
    }
    const updatesEnabled = !props.template.updatesEnabled;
    if (!(await CenteredMessage.confirm(updatesEnabled ? 'Automatische wijzigingen aanzetten?' : 'Automatische wijzigingen uitzetten?', updatesEnabled ? 'Aanzetten' : 'Uitzetten', updatesEnabled ? 'Alle documenten zullen meteen worden bijgewerkt.' : 'Alle documenten zullen niet langer aangepast worden.'))) {
        return;
    }

    settingUpdatesEnabled.value = true;

    await patchTemplate(DocumentTemplatePrivate.patch({
        updatesEnabled,
    }));
    settingUpdatesEnabled.value = false;
}

async function changeStatus(status: DocumentStatus) {
    publishing.value = true;

    await patchTemplate(DocumentTemplatePrivate.patch({
        status,
    }));

    publishing.value = false;
}

async function deleteTemplate() {
    if (deleting.value) {
        return;
    }

    if (!(await CenteredMessage.confirm('Ben je zeker dat je alle documenten wilt verwijderen?', 'Verwijderen', 'Verwijder nooit officiële documenten!'))) {
        return;
    }
    deleting.value = true;

    const patch: PatchableArrayAutoEncoder<DocumentTemplatePrivate> = new PatchableArray() as PatchableArrayAutoEncoder<DocumentTemplatePrivate>;
    patch.addDelete(props.template.id);

    try {
        await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/organization/document-templates',
            body: patch,
            decoder: new ArrayDecoder(DocumentTemplatePrivate as Decoder<DocumentTemplatePrivate>),
            shouldRetry: false,
            timeout: 60 * 1000,
            owner: requestOwner,
        });
        pop({ force: true })?.catch(console.error);
    }
    catch (e) {
        Toast.fromError(e).show();
    }
    deleting.value = false;
}

function exportXml() {
    // Start firing questions
    const c = gotoRecordCategory(0);
    if (c) {
        return present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: c,
                }),
            ],
            modalDisplayStyle: 'sheet',
        });
    }
}

async function generateXML(): Promise<Blob> {
    const response = await context.value.authenticatedServer.request({
        method: 'GET',
        path: '/organization/document-templates/' + encodeURIComponent(props.template.id) + '/xml',
        shouldRetry: true,
        timeout: 5 * 60 * 1000,
        owner: requestOwner,
        responseType: 'blob',
    });

    return response.data as Blob;
}

async function downloadXml() {
    try {
        const blob = await generateXML();
        AppManager.shared.downloadFile(blob, Formatter.fileSlug(props.template.settings.name) + '.xml');
    }
    catch (e: any) {
        if (!Request.isAbortError(e as Error)) {
            Toast.fromError(e).show();
        }
        else {
            new Toast('Downloaden geannuleerd', 'info').show();
        }
    }
}

function gotoRecordCategory(index: number) {
    if (index >= props.template.privateSettings.templateDefinition.exportFieldCategories.length) {
        const pendingToast = new Toast('Aanmaken...', 'spinner').setProgress(0).setHide(null).show();
        downloadXml().catch(console.error).finally(() => {
            pendingToast.hide();
        });
        return;
    }

    const category = props.template.privateSettings.templateDefinition.exportFieldCategories[index];
    return new ComponentWithProperties(FillRecordCategoryView, {
        category,
        value: props.template,
        forceMarkReviewed: true,

        saveHandler: async (fieldAnswers: PatchAnswers, component: NavigationActions) => {
            await patchTemplate(DocumentTemplatePrivate.patch({
                settings: DocumentSettings.patch({
                    fieldAnswers,
                }),
            }));

            const c = gotoRecordCategory(index + 1);
            if (!c) {
                component.dismiss({ force: true }).catch(console.error);
                return;
            }
            component.show(c).catch(console.error);
        },
    });
}

const xmlExportDescription = computed(() => props.template.privateSettings.templateDefinition.xmlExportDescription);
</script>
