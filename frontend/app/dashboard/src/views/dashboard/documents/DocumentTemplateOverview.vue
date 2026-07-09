<template>
    <div class="st-view background">
        <STNavigationBar :title="template.settings.name" />

        <main class="center">
            <h1 class="style-navigation-title">
                {{ template.settings.name }}
            </h1>
            <p v-if="template.privateSettings.templateDefinition.type === 'fiscal'">
                <I18nComponent :t="$t('%1Kp')">
                    <template #button="{content}">
                        <a class="inline-link" :href="LocalizedDomains.getDocs('fiscaal-attest-kinderopvang')" target="_blank">
                            {{ content }}
                        </a>
                    </template>
                </I18nComponent>
            </p>

            <p v-if="isLocked" class="info-box">
                {{ $t('%1Uc') }}
            </p>

            <p v-if="isDraft" class="warning-box">
                {{ $t('%KX') }}
            </p>
            <p v-else class="success-box">
                {{ $t('%KY') }}
            </p>

            <p v-if="!isLocked && !isDraft && template.updatesEnabled" class="warning-box">
                {{ $t('%KZ') }}
            </p>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Documents)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/agreement.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%tw') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%Ka') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="(isDraft || template.updatesEnabled) && !isLocked" :selectable="true" class="left-center" @click="$navigate(Routes.Settings)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/edit-data.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%xU') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%Kb') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="canAlterUpdates && !isLocked">
                <hr>
                <h2>{{ $t('%Kc') }}</h2>
                <p>{{ $t('%4C') }}</p>

                <Checkbox :model-value="template.updatesEnabled" :disabled="settingUpdatesEnabled" @update:model-value="toggleUpdatesEnabled">
                    {{ $t('%Kd') }}
                </Checkbox>
            </template>

            <ActionButtonsBox :title="$t('%16X')" :actions="documentTemplateActions" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, PatchableArray, PatchMap } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, defineRoutes, NavigationController, useNavigate, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import { GlobalEventBus } from '@stamhoofd/components/EventBus.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import ActionButtonsBox from '@stamhoofd/components/payments/components/ActionButtonsBox.vue';
import type { ActionButton } from '@stamhoofd/components/payments/components/ActionButtonsBox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';

import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import type { PatchAnswers, RecordAnswer } from '@stamhoofd/structures';
import { DocumentPrivateSettings, DocumentSettings, DocumentStatus, DocumentTemplateGroup, DocumentTemplatePrivate, RecordCheckboxAnswer, RecordType } from '@stamhoofd/structures';
import { FiscalDocumentYearHelper, Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';

import I18nComponent from '@stamhoofd/frontend-i18n/I18nComponent';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n/LocalizedDomains';
import { AppManager } from '@stamhoofd/networking/AppManager';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';

import { fiscal } from './definitions/fiscal';
import { participation } from './definitions/participation.ts';

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
        component: async () => (await import('./DocumentsView.vue')).default,
        defaultProperties() {
            return {
                template: props.template,
            };
        },
    },
    {
        url: Routes.Settings,
        present: 'popup',
        component: async () => (await import('./EditDocumentTemplateView.vue')).default,
        defaultProperties() {
            return {
                isNew: false,
                document: props.template,
            };
        },
    },
]);

const isDraft = computed(() => props.template.status === DocumentStatus.Draft);
const isLocked = computed(() => props.template.isLocked);

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
const fiscalDocumentYearHelper = new FiscalDocumentYearHelper();

const canAlterUpdates = computed(() => {
    if (isDraft.value) {
        return true;
    }
    if (props.template.updatesEnabled) {
        return true;
    }

    if (props.template.privateSettings.templateDefinition.type === 'fiscal') {
        if (fiscalDocumentYearHelper.canDownloadFiscalDocumentXML(props.template.year)) {
            // Still possible to make changes before publishing to belcotax
            return true;
        }
    } else {
        return true;
    }
    return false;
});

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
    } catch (e) {
        Toast.fromError(e).show();
    }
}

async function toggleUpdatesEnabled() {
    if (settingUpdatesEnabled.value) {
        return;
    }
    const updatesEnabled = !props.template.updatesEnabled;

    if (props.template.privateSettings.templateDefinition.type === 'fiscal') {
        if (fiscalDocumentYearHelper.isAfterDeadline(props.template.year)) {
            Toast.error($t('%1LX')).show();
        }
    }

    if (!(await CenteredMessage.confirm(
        updatesEnabled ? $t('%1LY') : $t('%1LZ'),
        updatesEnabled ? $t('%1La') : $t('%1Lb'),
        updatesEnabled ? $t('%1Lc') : $t('%1Ld'),
        undefined,
        updatesEnabled ? true : false, // destructive to enable updates
    ))) {
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

        GlobalEventBus.sendEvent('document-template-deleted', props.template).catch(console.error);
        Toast.success($t('%1IW')).show();

        pop({ force: true })?.catch(console.error);
    } catch (e) {
        Toast.fromError(e).show();
    }
    deleting.value = false;
}
async function exportXml() {
    if (props.template.updatesEnabled) {
        Toast.error($t('%1Kr')).show();
        return;
    }

    // if fiscal document
    if (props.template.privateSettings.templateDefinition.type === fiscal.type) {
        const canDownload = fiscalDocumentYearHelper.canDownloadFiscalDocumentXML(props.template.year);
        if (!canDownload) {
            Toast.error($t('%1IX')).show();
            return;
        }

        const afterDeadline = fiscalDocumentYearHelper.isAfterDeadline(props.template.year);
        if (afterDeadline) {
            const stop = await CenteredMessage.show({
                title: $t('%1Le'),
                description: $t('%1Lf'),
                buttons: [
                    {
                        text: $t('%1Lg'),
                        value: false,
                        type: 'destructive',
                        availabilityDelay: 2_000,
                    }, {
                        text: $t('%1Lh'),
                        value: true,
                        type: 'secundary',
                    },
                ],
            });
            if (stop) {
                return;
            }
        }
    }

    // Start firing questions
    const c = gotoRecordCategory(0);
    if (c) {
        await present({
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
        await AppManager.shared.downloadFile(blob, Formatter.fileSlug(props.template.settings.name) + '.xml');
    } catch (e: any) {
        if (!Request.isAbortError(e as Error)) {
            Toast.fromError(e).show();
        } else {
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
    return AsyncComponent(() => import('@stamhoofd/components/records/FillRecordCategoryView.vue'), {
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

const documentTemplateActions = computed<ActionButton[]>(() => [
    {
        name: $t('%Zak'),
        description: $t('%Zaf'),
        icon: 'unlock',
        listItemClass: 'left-center',
        enabled: isLocked.value && props.template.privateSettings.templateDefinition.type === 'participation',
        action: migrateDocumentTemplateFromV1,
    },
    {
        name: $t('%1Kq'),
        description: xmlExportDescription.value ?? undefined,
        icon: 'government',
        asideIcon: 'download stroke small',
        listItemClass: 'left-center',
        enabled: !isDraft.value && !isLocked.value && !!xmlExportDescription.value,
        action: exportXml,
    },
    {
        name: $t('%Ke'),
        description: $t('%Kf'),
        icon: 'file-pdf',
        iconClass: 'success',
        asideIcon: 'success small',
        enabled: isDraft.value && !isLocked.value,
        action: publishTemplate,
    },
    {
        name: $t('%Kg'),
        description: $t('%Kh'),
        icon: 'file-pdf',
        asideIcon: 'undo stroke small',
        enabled: !isDraft.value && !isLocked.value,
        action: draftTemplate,
    },
    {
        name: $t('%Ki'),
        description: $t('%Kj'),
        icon: 'file-pdf',
        iconClass: 'error',
        asideIcon: 'trash stroke small',
        enabled: isDraft.value || isLocked.value,
        action: deleteTemplate,
    },
]);

async function migrateDocumentTemplateFromV1() {
    if (!await CenteredMessage.confirm({
        title: $t('%1Bz'),
        description: $t('%ZaG'),
        confirmText: $t('%16p'),
    })) {
        return;
    }

    const documentTemplate: DocumentTemplatePrivate = props.template;

    const linkedFields = new PatchMap<string, string[]>(documentTemplate.settings.linkedFields);

    for (const [linkedFieldId, recordIds] of documentTemplate.settings.linkedFields) {
        if (linkedFieldId === 'member.nationalRegistryNumber' && recordIds.length > 0) {
            linkedFields.set(linkedFieldId, ['member.nationalRegistryNumber', ...recordIds.filter(id => id !== 'member.nationalRegistryNumber')]);
        }
    }

    const { fieldAnswers, groups } = createDocumentTemplateGroupPatches(documentTemplate);

    const patch = DocumentTemplatePrivate.patch({
        id: documentTemplate.id,
        isLocked: false,
        settings: DocumentSettings.patch({
            linkedFields,
            fieldAnswers,
        }),
        privateSettings: DocumentPrivateSettings.patch({
            templateDefinition: participation,
            groups,
        }),
    });

    await present({
        components: [
            new ComponentWithProperties((await import('./EditDocumentTemplateView.vue')).default, {
                isNew: false,
                document: documentTemplate,
                initialPatch: patch,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

function createDocumentTemplateGroupPatches(documentTemplate: DocumentTemplatePrivate) {
    const fieldAnswersPatch = new PatchMap<string, RecordAnswer>(documentTemplate.settings.fieldAnswers);
    const groupsPatches = new PatchableArray() as PatchableArrayAutoEncoder<DocumentTemplateGroup>;

    const newCategory = participation.fieldCategories.find(c => c.id === 'visible-data');
    if (!newCategory) {
        throw new Error('Category with id visible-date not found on participation document template definition.');
    }

    for (const category of documentTemplate.privateSettings.templateDefinition.groupFieldCategories) {
        for (const record of category.records) {
            const newRecord = newCategory.records.find(r => r.id === record.id);
            if (!newRecord || newRecord.type !== RecordType.Checkbox) {
                continue;
            }

            let newSelected = false;

            for (const documentTemplateGroup of documentTemplate.privateSettings.groups) {
                const answer = documentTemplateGroup.fieldAnswers.get(record.id);
                if (!answer) {
                    continue;
                }

                const objectValue = answer.objectValue;
                if (typeof objectValue !== 'boolean') {
                    continue;
                }

                // set value to true if selected is true for some group
                if (objectValue) {
                    newSelected = true;
                }
            }

            const newAnswer = RecordCheckboxAnswer.create({
                settings: newRecord,
                selected: newSelected,
            });

            fieldAnswersPatch.set(newRecord.id, newAnswer);
        }
    }

    for (const documentTemplateGroup of documentTemplate.privateSettings.groups) {
        groupsPatches.addPatch(DocumentTemplateGroup.patch({
            id: documentTemplateGroup.id,
            // remove all field answers
            fieldAnswers: new Map() as PatchMap<string, RecordAnswer>,
        }));
    }

    const addFieldAnswerIfHasLinkedField = ({ linkedFieldId, recordId }: { linkedFieldId: string; recordId: string }) => {
        const linkedFields = documentTemplate.settings.linkedFields;

        const linkedField = linkedFields.get(linkedFieldId);
        if (!linkedField || !linkedField.length) {
            return;
        }

        const settings = newCategory.records.find(r => r.id === recordId);
        if (!settings) {
            return;
        }

        const fieldAnswer = RecordCheckboxAnswer.create({
            settings,
            selected: true,
        });

        fieldAnswersPatch.set(settings.id, fieldAnswer);
    };

    addFieldAnswerIfHasLinkedField({
        linkedFieldId: 'registration.price',
        recordId: 'enable[registration.price]',
    });

    addFieldAnswerIfHasLinkedField({
        linkedFieldId: 'member.birthDay',
        recordId: 'enable[member.birthDay]',
    });

    addFieldAnswerIfHasLinkedField({
        linkedFieldId: 'member.nationalRegistryNumber',
        recordId: 'enable[member.nationalRegisterNumber]',
    });

    addFieldAnswerIfHasLinkedField({
        linkedFieldId: 'member.email',
        recordId: 'enable[member.email]',
    });

    addFieldAnswerIfHasLinkedField({
        linkedFieldId: 'member.address',
        recordId: 'enable[member.address]',
    });

    return {
        fieldAnswers: fieldAnswersPatch,
        groups: groupsPatches,
    };
}
</script>
