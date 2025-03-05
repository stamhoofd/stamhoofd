<template>
    <div class="st-view background">
        <STNavigationBar :title="template.settings.name"/>

        <main class="center">
            <h1 class="style-navigation-title">
                {{ template.settings.name }}
            </h1>

            <p v-if="isDraft" class="warning-box">
                {{ $t('ee7a8d10-6b48-42cb-97e8-c09d0c2c5445') }}
            </p>
            <p v-else class="success-box">
                {{ $t('8730a6f2-700b-494f-9801-dc0bb7032ace') }}
            </p>

            <p v-if="!isDraft && template.updatesEnabled" class="warning-box">
                {{ $t('aa613697-1ba0-4fbb-81c9-b633790b8f2f') }}
            </p>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Documents)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/agreement.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('eeb261d4-2a8d-46f3-ae06-f294fa1721a6') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('f9b12e96-5c6e-49ea-a474-99095f53e966') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem v-if="isDraft || template.updatesEnabled" :selectable="true" class="left-center" @click="$navigate(Routes.Settings)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/edit-data.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('a370eff9-c1c1-450c-8bdb-dcee89bd2f70') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('e38ef093-3d1f-46b7-a0f7-c5e521c9f4e5') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem v-if="!isDraft && xmlExportDescription" :selectable="true" class="left-center" @click="exportXml">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/code-export.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('8a2208ba-8b8e-49db-a756-8dda7024fc87') }}
                    </h2>
                    <p class="style-description">
                        {{ xmlExportDescription }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>
            </STList>

            <hr><h2>{{ $t('9667016f-ad1e-40a9-be8b-04da38a978bf') }}</h2>
            <p>{{ $t('fa988b87-6665-43e4-a177-77031826e9a8') }}</p>

            <Checkbox :model-value="template.updatesEnabled" :disabled="settingUpdatesEnabled" @update:model-value="toggleUpdatesEnabled">
                {{ $t('59ee23cf-45c6-4b39-bc4d-fb5f3db2404a') }}
            </Checkbox>

            <hr><h2>{{ $t('8424a02d-2147-40d1-9db2-ddece074a650') }}</h2>

            <STList>
                <STListItem v-if="isDraft" :selectable="true" @click="publishTemplate()">
                    <h2 class="style-title-list">
                        {{ $t('f5ed312e-aba3-428b-a089-4bedfd3fd90e') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('d59e876b-c93c-40df-9287-dd98e50f0f65') }}
                    </p>
                    <template #right>
                        <button type="button" class="button secundary green hide-smartphone">
                            <span class="icon success"/>
                            <span>{{ $t('ab450424-e7ae-475e-ad2d-7474dcb229ca') }}</span>
                        </button>                    <button type="button" class="button icon success only-smartphone"/>
                    </template>
                </STListItem>

                <STListItem v-if="!isDraft" :selectable="true" @click="draftTemplate()">
                    <h2 class="style-title-list">
                        {{ $t('6886a956-0d5f-4db6-a32a-eef161fea7cd') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('c6886f3b-d077-462e-b023-9529edc4d697') }}
                    </p>
                    <template #right>
                        <button type="button" class="button secundary hide-smartphone">
                            <span class="icon edit"/>
                            <span>{{ $t('9af68f0e-b029-43b4-b6d8-d1b948b9df4b') }}</span>
                        </button>                    <button type="button" class="button icon edit only-smartphone"/>
                    </template>
                </STListItem>

                <STListItem v-if="isDraft" :selectable="true" @click="deleteTemplate()">
                    <h2 class="style-title-list">
                        {{ $t('da76f0ff-6f2b-4d7f-a278-9b7628bd4d22') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('c6022fae-ea49-4019-8099-e904ddabe617') }}
                    </p>
                    <template #right>
                        <button type="button" class="button secundary danger hide-smartphone">
                            <span class="icon trash"/>
                            <span>{{ $t('56601c31-fe62-4109-8677-7dc1398554f5') }}</span>
                        </button>                    <button type="button" class="button icon trash only-smartphone"/>
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, defineRoutes, NavigationController, useNavigate, usePop, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, FillRecordCategoryView, NavigationActions, STList, STListItem, STNavigationBar, Toast, useContext } from '@stamhoofd/components';
import { DocumentSettings, DocumentStatus, DocumentTemplatePrivate, PatchAnswers } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ComponentOptions, computed, ref } from 'vue';

import { AppManager, useRequestOwner } from '@stamhoofd/networking';
import DocumentsView from './DocumentsView.vue';
import EditDocumentTemplateView from './EditDocumentTemplateView.vue';

const props = defineProps<{
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
