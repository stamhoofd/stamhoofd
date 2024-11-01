<template>
    <div class="st-view background">
        <STNavigationBar :title="template.settings.name" />

        <main>
            <h1 class="style-navigation-title">
                {{ template.settings.name }}
            </h1>

            <p v-if="isDraft" class="warning-box">
                Dit document is nog een kladversie. Nu kan je alles nog wijzigen, maar ze is nog niet zichtbaar voor leden. Publiceer het document via de knop onderaan nadat je alles hebt nagekeken.
            </p>
            <p v-else class="success-box">
                Dit document is zichtbaar in het ledenportaal.
            </p>

            <p v-if="!isDraft && template.updatesEnabled" class="warning-box">
                We raden aan om automatische wijzigingen uit te schakelen zodra alle documenten volledig zijn (of als leden voldoende kans hebben gehad om ontbrekende gegevens aan te vullen). Anders riskeer je dat documenten nog worden gewijzigd of verwijderd als leden worden uitgeschreven.
            </p>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="openDocuments">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/agreement.svg">
                    </template>
                    <h2 class="style-title-list">
                        Documenten
                    </h2>
                    <p class="style-description">
                        Bekijk en bewerk de aangemaakte documenten.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="isDraft || template.updatesEnabled" :selectable="true" class="left-center" @click="editSettings">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/edit-data.svg">
                    </template>
                    <h2 class="style-title-list">
                        Instellingen
                    </h2>
                    <p class="style-description">
                        Wijzig de invulvelden en de instellingen van het document.
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
                        Exporteren naar XML
                    </h2>
                    <p class="style-description">
                        {{ xmlExportDescription }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <hr>
            <h2>Automatische wijzigingen</h2>
            <p>{{ $t('fa988b87-6665-43e4-a177-77031826e9a8') }}</p>

            <Checkbox :model-value="template.updatesEnabled" :disabled="settingUpdatesEnabled" @update:model-value="toggleUpdatesEnabled">
                Documenten automatisch wijzigen
            </Checkbox>

            <hr>
            <h2>Acties</h2>

            <STList>
                <STListItem v-if="isDraft" :selectable="true" @click="publishTemplate()">
                    <h2 class="style-title-list">
                        Document publiceren
                    </h2>
                    <p class="style-description">
                        Maak alle documenten toegankelijk voor alle leden.
                    </p>
                    <template #right>
                        <button type="button" class="button secundary green hide-smartphone">
                            <span class="icon success" />
                            <span>Publiceer</span>
                        </button>                    <button type="button" class="button icon success only-smartphone" />
                    </template>
                </STListItem>

                <STListItem v-if="!isDraft" :selectable="true" @click="draftTemplate()">
                    <h2 class="style-title-list">
                        Terug naar klad
                    </h2>
                    <p class="style-description">
                        Maak dit document terug onzichtbaar voor alle leden.
                    </p>
                    <template #right>
                        <button type="button" class="button secundary hide-smartphone">
                            <span class="icon edit" />
                            <span>Naar klad</span>
                        </button>                    <button type="button" class="button icon edit only-smartphone" />
                    </template>
                </STListItem>

                <STListItem v-if="isDraft" :selectable="true" @click="deleteTemplate()">
                    <h2 class="style-title-list">
                        Document verwijderen
                    </h2>
                    <p class="style-description">
                        Verwijder alle documenten definitief.
                    </p>
                    <template #right>
                        <button type="button" class="button secundary danger hide-smartphone">
                            <span class="icon trash" />
                            <span>Verwijder</span>
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
import { ComponentWithProperties, NavigationController, usePop, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, FillRecordCategoryView, NavigationActions, STList, STListItem, STNavigationBar, Toast, useContext } from '@stamhoofd/components';
import { DocumentSettings, DocumentStatus, DocumentTemplatePrivate, RecordAnswer } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';

import { useRequestOwner } from '@stamhoofd/networking';
import DocumentsView from './DocumentsView.vue';
import EditDocumentTemplateView from './EditDocumentTemplateView.vue';

const props = defineProps<{
    template: DocumentTemplatePrivate;
}>();

const show = useShow();
const present = usePresent();
const pop = usePop();
const requestOwner = useRequestOwner();
const context = useContext();
const deleting = ref(false);
const publishing = ref(false);

function openDocuments() {
    show({
        components: [
            new ComponentWithProperties(DocumentsView, {
                template: props.template,
            }),
        ],
    }).catch(console.error);
}

function editSettings() {
    present({
        components: [
            new ComponentWithProperties(EditDocumentTemplateView, {
                isNew: false,
                document: props.template,
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

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
        const buffer = await generateXML();
        const saveAs = (await import(/* webpackChunkName: "file-saver" */ 'file-saver')).default.saveAs;
        saveAs(buffer, Formatter.fileSlug(props.template.settings.name) + '.xml');
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
        answers: props.template.settings.fieldAnswers,
        hasNextStep: index < props.template.privateSettings.templateDefinition.exportFieldCategories.length - 1,
        filterValue: props.template,
        patchHandler: () => {

        },

        saveHandler: async (fieldAnswers: RecordAnswer[], component: NavigationActions) => {
            await patchTemplate(DocumentTemplatePrivate.patch({
                settings: DocumentSettings.patch({
                    fieldAnswers: fieldAnswers as any,
                }),
            }));

            const c = gotoRecordCategory(index + 1);
            if (!c) {
                component.dismiss({ force: true }).catch(console.error);
                return;
            }
            component.show(c).catch(console.error);
        },

        filterValueForAnswers: (_fieldAnswers: RecordAnswer[]) => {
            return props.template;
        },
    });
}

const xmlExportDescription = computed(() => props.template.privateSettings.templateDefinition.xmlExportDescription);
</script>
