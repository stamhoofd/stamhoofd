<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <EditorView v-if="!(creatingEmail || !email || !patchedEmail)" ref="editorView" save-icon-mobile="send" class="mail-view" :loading="sending || (!willSend && !!savingPatch)" :save-text="willSend ? $t('d1e7abf8-20ac-49e5-8e0c-cc7fab78fc6b') : $t('Opslaan')" :replacements="replacements" :title="title" @save="send">
            <h1 class="style-navigation-title with-icons">
                <span>{{ title }}</span>
                <ProgressRing :radius="7" :stroke="2" :loading="true" :opacity="showLoading ? 1 : 0" />
            </h1>

            <STErrorsDefault :error-box="errors.errorBox" />

            <!-- Buttons -->
            <template #buttons>
                <UploadFileButton
                    :is-private="true"
                    :max-size="9.5 * 1024 * 1024"
                    accept=".pdf, .docx, .xlsx, .png, .jpeg, .jpg, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf, image/jpeg, image/png, image/gif"
                    @change="appendAttachment($event)"
                >
                    <span v-tooltip="$t('d76495d1-251b-4cf1-9ca1-7e7ac33a046f')" class="button icon attachment">
                        <span v-if="$isMobile && patchedEmail.attachments.length > 0" class="bubble">{{ patchedEmail.attachments.length }}</span>
                    </span>
                </UploadFileButton>

                <hr v-if="canOpenTemplates"><button v-if="canOpenTemplates" v-tooltip="$t('20bacd85-5b82-4396-bbd5-b6d88e7d90e4')" class="button icon email-template" type="button" @click="openTemplates" />
            </template>

            <!-- List -->
            <template #list>
                <STListItem v-if="!props.editEmail" class="no-padding right-stack">
                    <div class="list-input-box">
                        <span>{{ $t('17a71942-a3d7-4d19-97bb-307cabffc1d6') }}:</span>

                        <div v-if="onlyOption" class="list-input">
                            {{ toDescription }}
                        </div>
                        <button v-else class="list-input dropdown" type="button" @click="showToMenu">
                            <span>{{ toDescription }}</span>
                            <span class="icon arrow-down-small gray" />
                        </button>
                    </div>
                    <template #right>
                        <span v-if="patchedEmail.emailRecipientsCount === null && patchedEmail.recipientsErrors" v-tooltip="$t('Er ging iets mis bij het aanmaken van de ontvangers: ') + ' ' + patchedEmail.recipientsErrors.getHuman()" class="icon error red" />
                        <span v-else-if="patchedEmail.emailRecipientsCount !== null" class="style-description-small">{{ formatInteger(patchedEmail.emailRecipientsCount) }}</span>
                        <span v-else class="style-placeholder-skeleton" />
                    </template>
                </STListItem>
                <STListItem class="no-padding" element-name="label">
                    <div class="list-input-box">
                        <span>{{ $t('709a5ff3-8d79-447b-906d-2c3cdabb41cf') }}:</span>
                        <input id="mail-subject" v-model="subject" class="list-input" type="text" :placeholder="$t(`13b42902-e159-4e6a-8562-e87c9c691c8b`)">
                    </div>
                </STListItem>
                <STListItem v-if="senders.length > 0" class="no-padding" element-name="label">
                    <div class="list-input-box">
                        <span>{{ $t('01b5d104-748c-4801-a369-4eab05809fcf') }}:</span>

                        <div class="input-icon-container right icon arrow-down-small gray" :class="{'no-padding': !auth.hasFullAccess()}">
                            <select v-model="senderId" class="list-input">
                                <option :value="null" disabled>{{ $t('Maak een keuze') }}</option>
                                <option v-for="e in senders" :key="e.id" :value="e.id">
                                    {{ e.name ? (e.name+" <"+e.email+">") : e.email }}
                                </option>
                            </select>
                        </div>
                    </div>

                    <template v-if="auth.hasFullAccess()" #right>
                        <button class="button icon settings" type="button" @click="manageEmails" />
                    </template>
                </STListItem>
            </template>

            <!-- Editor footer -->
            <template #footer>
                <!-- E-mail attachments -->
                <STList v-if="patchedEmail.attachments.length > 0">
                    <STListItem v-for="attachment in patchedEmail.attachments" :key="attachment.id" class="file-list-item">
                        <template #left>
                            <span :class="'icon '+attachment.icon" />
                        </template>
                        <h3 class="style-title-list" v-text="attachment.filename" />
                        <p class="style-description-small">
                            {{ Formatter.fileSize(attachment.bytes) }}
                        </p>

                        <template #right>
                            <button class="button icon gray trash" type="button" @click.stop="deleteAttachment(attachment)" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <!-- Warnings and errors -->
            <template v-if="senders.length === 0">
                <p v-if="auth.hasFullAccess()" class="warning-box selectable with-button" @click="manageEmails">
                    {{ $t('ae013398-3667-40ff-ad66-c0cd0050f35c') }}
                    <span class="button text inherit-color">
                        <span class="icon settings" />
                        <span>{{ $t('9ee80b2b-1edd-4ae0-9d18-374b3c1f864a') }}</span>
                    </span>
                </p>
                <p v-else class="warning-box">
                    {{ $t('9ec8b45b-3321-4c1a-90bb-74e22c3e7f09') }}
                </p>
            </template>
        </editorview>
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, Decoder, encodeObject, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { useRequestOwner } from '@stamhoofd/networking';
import { AccessRight, Email, EmailAttachment, EmailPreview, EmailRecipientFilter, EmailRecipientSubfilter, EmailStatus, EmailTemplate, File, PermissionsResourceType } from '@stamhoofd/structures';
import { Formatter, throttle } from '@stamhoofd/utility';
import { computed, nextTick, onMounted, Ref, ref, watch } from 'vue';
import { EditEmailTemplatesView } from '.';
import { usePatchEmail } from '../communication/hooks/usePatchEmail';
import { LoadingViewTransition } from '../containers';
import EditorView from '../editor/EditorView.vue';
import { EmailStyler } from '../editor/EmailStyler';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { GlobalEventBus } from '../EventBus';
import { useAuth, useContext, useFeatureFlag, useHoldValueForMinimumDuration, useInterval, useIsMobile, useOrganization, usePlatform } from '../hooks';
import UploadFileButton from '../inputs/UploadFileButton.vue';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { Toast } from '../overlays/Toast';
import EmailSettingsView from './EmailSettingsView.vue';
import ProgressRing from '../icons/ProgressRing.vue';

const props = withDefaults(defineProps<{
    defaultSubject?: string;
    recipientFilterOptions: (RecipientChooseOneOption | RecipientMultipleChoiceOption)[];
    defaultSenderId?: string | null;
    editEmail?: EmailPreview | null;
}>(), {
    defaultSubject: '',
    defaultSenderId: null,
    editEmail: null,
});

export type RecipientChooseOneOption = {
    type: 'ChooseOne';
    name?: string;
    options: {
        id: string;
        name: string;
        value: EmailRecipientSubfilter[];
    }[];
    defaultSelection?: string;
};

export type RecipientMultipleChoiceOption = {
    type: 'MultipleChoice';
    name?: string;
    options: {
        name: string;
        id: string;
    }[];
    defaultSelection?: string[];
    build: (selectedIds: string[]) => EmailRecipientSubfilter[];
};

const willSend = computed(() => {
    return (!props.editEmail || props.editEmail.status === EmailStatus.Draft);
});
const title = computed(() => props.editEmail ? (willSend.value ? $t('Bericht versturen') : $t('Bericht bewerken')) : $t('59367bfa-a918-4475-8d90-d9e3d6c71ad8'));
const creatingEmail = ref(true);
const organization = useOrganization();
const platform = usePlatform();
const replacements = computed(() => {
    return email.value ? (email.value.exampleRecipient?.getReplacements(organization.value, platform.value) ?? []) : [];
});
const errors = useErrors();
const auth = useAuth();
const $isMobile = useIsMobile();
const email = ref(null) as Ref<EmailPreview | null>;
const context = useContext();
const owner = useRequestOwner();
const patch = ref(null) as Ref<AutoEncoderPatchType<Email> | null>;
const savingPatch = ref(null) as Ref<AutoEncoderPatchType<Email> | null>;
const sending = ref(false);
const showLoading = useHoldValueForMinimumDuration(computed(() => {
    return (willSend.value && !!savingPatch.value);
}), 1_000);

const selectedRecipientOptions = ref(props.recipientFilterOptions.map((o) => {
    if (o.defaultSelection) {
        if (o.type === 'ChooseOne') {
            return [o.defaultSelection];
        }
        return o.defaultSelection;
    }
    return [o.options[0].id];
}));

const groupByEmail = ref(false);
const editorView = ref(null) as Ref<typeof EditorView | null>;
const editor = computed(() => editorView.value?.editor);
const pop = usePop();
const present = usePresent();

const allSenders = computed(() => {
    if (organization.value) {
        return organization.value.privateMeta?.emails ?? [];
    }
    return platform.value?.privateConfig?.emails ?? [];
});

const senders = computed(() => {
    return allSenders.value.filter((e) => {
        return auth.hasResourceAccessRight(PermissionsResourceType.Senders, e.id, AccessRight.SendMessages);
    });
});

const patchedEmail = computed(() => {
    if (savingPatch.value) {
        return patch.value ? email.value?.patch(savingPatch.value).patch(patch.value) : email.value?.patch(savingPatch.value);
    }
    if (patch.value) {
        return email.value?.patch(patch.value);
    }
    return email.value;
});

function addPatch(newPatch: PartialWithoutMethods<AutoEncoderPatchType<Email>>) {
    patch.value = patch.value ? patch.value.patch(Email.patch(newPatch)) : Email.patch(newPatch);
}

const recipientFilter = computed(() => {
    const filter = EmailRecipientFilter.create({});

    for (let i = 0; i < props.recipientFilterOptions.length; i++) {
        const option = props.recipientFilterOptions[i];
        const selectedIds = selectedRecipientOptions.value[i];

        if (option.type === 'ChooseOne') {
            const selectedOption = option.options.find(o => o.id === selectedIds[0]);
            if (selectedOption) {
                filter.filters.push(
                    ...selectedOption.value,
                );
            }
            continue;
        }

        const buildFilter = option.build(selectedIds);
        filter.filters.push(
            ...buildFilter,
        );
    }

    filter.groupByEmail = groupByEmail.value;
    return filter;
});

const onlyOption = computed(() => {
    if (props.recipientFilterOptions.length === 1 && props.recipientFilterOptions[0].options.length === 1) {
        return props.recipientFilterOptions[0].options[0];
    }
    return null;
});

const toDescription = computed(() => {
    if (onlyOption.value) {
        return onlyOption.value.name;
    }

    return props.recipientFilterOptions.flatMap((option, i) => {
        const selectedIds = selectedRecipientOptions.value[i];

        if (option.type === 'ChooseOne') {
            const selectedOption = option.options.find(o => o.id === selectedIds[0]);
            if (selectedOption) {
                return [selectedOption.name];
            }
            return [];
        }

        return selectedIds.map((id) => {
            const selectedOption = option.options.find(o => o.id === id);
            if (selectedOption) {
                return selectedOption.name;
            }
            return '';
        });
    }).join(', ');
});

watch([selectedRecipientOptions, groupByEmail], () => {
    if (props.editEmail) {
        // Only when creating a new email
        return;
    }
    addPatch({ recipientFilter: recipientFilter.value });
}, { deep: true });

const sendersLength = computed(() => senders.value.length);
watch([sendersLength], () => {
    if (!senderId.value && senders.value.length > 0) {
        senderId.value = senders.value.find(s => s.default)?.id ?? senders.value[0].id;
    }
    if (senderId.value) {
        const exists = senders.value.find(s => s.id === senderId.value);
        if (!exists) {
            senderId.value = senders.value.find(s => s.default)?.id ?? senders.value[0].id;
        }
    }
}, { deep: false });

const subject = computed({
    get: () => patchedEmail.value?.subject || '',
    set: (subject) => {
        addPatch({ subject });
    },
});

const senderId = computed({
    get: () => email.value?.senderId ?? null,
    set: (id) => {
        addPatch({ senderId: id });
    },
});

watch(patch, (newValue, oldValue) => {
    if (newValue === null) {
        return;
    }
    if (props.editEmail && props.editEmail.status !== EmailStatus.Draft) {
        // Only auto save when creating a new email or editing a draft
        return;
    }
    doThrottledPatch();
}, {});

watch(editor, (e) => {
    if (!e) {
        return;
    }
    const handler = () => {
        // save json
        addPatch({ json: e.getJSON() });
    };
    e.on('update', handler);

    return () => {
        e.off('update', handler);
    };
}, { deep: false });

onMounted(() => {
    // Create the email
    createEmail().catch((e) => {
        errors.errorBox = new ErrorBox(e);
    });
});

useInterval(async () => {
    if (!email.value || email.value.emailRecipientsCount !== null) {
        return;
    }
    await updateEmail();
}, 2_000);

let initialEmail: EmailPreview | null = null;

async function createEmail() {
    if (props.editEmail) {
        initialEmail = props.editEmail.clone();
        email.value = props.editEmail;
        creatingEmail.value = false;
        groupByEmail.value = props.editEmail.recipientFilter.groupByEmail;

        await nextTick();

        if (props.editEmail.json) {
            editor.value?.commands.setContent(props.editEmail.json);
        }
        return;
    }

    try {
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/email',
            body: Email.create({
                recipientFilter: recipientFilter.value,
                senderId: (props.defaultSenderId ? senders.value.find(s => s.id === props.defaultSenderId)?.id : null) ?? senders.value.find(s => s.default)?.id ?? (senders.value.length > 0 ? senders.value[0].id : null),
                status: EmailStatus.Draft,
                subject: props.defaultSubject,
            }),
            decoder: EmailPreview as Decoder<EmailPreview>,
            owner,
            shouldRetry: false,
        });

        initialEmail = response.data.clone();
        email.value = response.data;
        creatingEmail.value = false;
        groupByEmail.value = response.data.recipientFilter.groupByEmail;

        await nextTick();

        if (response.data.json) {
            editor.value?.commands.setContent(response.data.json);
        }
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
        return;
    }
}

const doThrottledPatch = throttle(() => patchEmail(true), 1000);
const { patchEmail: doPatchEmail } = usePatchEmail();

async function patchEmail(async = false) {
    if (!email.value) {
        return;
    }

    if (savingPatch.value || !patch.value) {
        return;
    }
    if (sending.value) {
        return;
    }

    let _savingPatch = patch.value;

    try {
        const { text, html } = await getHTML();
        _savingPatch = _savingPatch.patch({
            text,
            html,
        });
    }
    catch (e) {
        console.error('failed to set text and html', e);
    }

    savingPatch.value = _savingPatch;
    patch.value = null;

    try {
        await doPatchEmail(email.value, _savingPatch);
        savingPatch.value = null;

        // changed meanwhile
        if (patch.value && async) {
            // do again
            patchEmail().catch(console.error);
        }
    }
    catch (e) {
        console.error(e);
        Toast.fromError(e).setHide(20000).show();
        if (!async) {
            // Keep patch
            if (patch.value) {
                patch.value = _savingPatch.patch(patch.value);
            }
            else {
                patch.value = _savingPatch;
            }
            throw e;
        }
    }
    finally {
        savingPatch.value = null;
    }
}

const updating = ref(false);
async function updateEmail() {
    if (!email.value) {
        return;
    }

    if (sending.value || updating.value) {
        return;
    }

    if (savingPatch.value) {
        return;
    }
    updating.value = true;

    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/email/' + email.value.id,
            decoder: EmailPreview as Decoder<EmailPreview>,
            owner,
            shouldRetry: true,
        });

        email.value.deepSet(response.data);
    }
    catch (e) {
        console.error(e);
        Toast.fromError(e).setHide(2000).show();
    }

    updating.value = false;
}

async function manageEmails() {
    await present({
        components: [
            new ComponentWithProperties(EmailSettingsView, {}),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function getHTML() {
    const e = editor.value;
    if (!e) {
        // When editor is not yet loaded: slow internet -> need to know html on dismiss confirmation
        return {
            text: '',
            html: '',
            JSON: {},
        };
    }

    const base: string = e.getHTML();
    return {
        ...await EmailStyler.format(base, subject.value),
        json: e.getJSON(),
    };
}

const communicationFeature = useFeatureFlag()('communication');

async function send() {
    if (sending.value) {
        return;
    }

    if (!willSend.value) {
        // Just save the patch
        try {
            await patchEmail(false);
            await pop({ force: true });
        }
        catch (e) {
            errors.errorBox = new ErrorBox(e);
        }
        return;
    }

    if (savingPatch.value) {
        Toast.info($t(`a6d49891-5af9-4dee-8dba-57ad854fb955`)).show();
        return;
    }

    if (!email.value) {
        return;
    }

    const emailRecipientsCount = email.value.emailRecipientsCount;
    let confirmText = $t(`8ea1d574-6388-4033-bb4e-f2e031d2da3b`);

    if (emailRecipientsCount) {
        confirmText = emailRecipientsCount === 1 ? `Ben je zeker dat je de e-mail naar 1 ontvanger wilt versturen?` : `Ben je zeker dat je de e-mail naar ${email.value.emailRecipientsCount} ontvangers wilt versturen?`;
    }

    const isConfirm = await CenteredMessage.confirm(confirmText, $t(`e0c68f8b-ccb1-4622-8570-08abc7f5705a`));

    if (!isConfirm) return;

    sending.value = true;

    try {
        const { text, html } = await getHTML();
        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/email/' + email.value.id,
            body: Email.patch({
                ...patch.value,
                status: EmailStatus.Sending,
                text,
                html,
                json: editor.value?.getJSON(),
            }),
            decoder: EmailPreview as Decoder<EmailPreview>,
            owner,
            shouldRetry: false,
        });

        email.value.deepSet(response.data);
        Toast.success($t(`0adee17a-6cb5-4b32-a2a9-c6f44cbb3e7d`)).show();

        if (communicationFeature) {
            await GlobalEventBus.sendEvent('selectTabById', 'communication');
        }
        await pop({ force: true });
    }
    catch (e) {
        console.error(e);
        Toast.fromError(e).show();
    }
    sending.value = false;
}

function getContextMenuForOption(option: RecipientChooseOneOption | RecipientMultipleChoiceOption, index: number): ContextMenuItem[] {
    const selectedIds = selectedRecipientOptions.value[index];

    if (option.type === 'ChooseOne') {
        return option.options.map((o) => {
            return new ContextMenuItem({
                name: o.name,
                selected: selectedIds[0] === o.id,
                action: () => {
                    selectedRecipientOptions.value[index] = [o.id];
                },
            });
        });
    }

    return [
        ...option.options.map((o) => {
            return new ContextMenuItem({
                name: o.name,
                selected: selectedIds.includes(o.id),
                action: () => {
                    if (selectedIds.includes(o.id)) {
                        selectedRecipientOptions.value[index] = selectedIds.filter(id => id !== o.id);
                    }
                    else {
                        selectedRecipientOptions.value[index] = [...selectedIds, o.id];
                    }
                },
            });
        }),
    ];
}

async function showToMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        props.recipientFilterOptions.flatMap((option, j) => {
            if (option.type === 'MultipleChoice') {
                if (option.name) {
                    return [new ContextMenuItem({
                        name: option.name,
                        childMenu: new ContextMenu([
                            getContextMenuForOption(option, j),
                        ]),
                    })];
                }
                return getContextMenuForOption(option, j);
            }
            const selectedIds = selectedRecipientOptions.value[j];
            const selectedOption = option.options.find(o => o.id === selectedIds[0]);

            return [new ContextMenuItem({
                name: option.name ?? selectedOption?.name ?? $t(`d8b6c55e-72c5-4cde-bdd9-cee3b5bae6ae`),
                childMenu: new ContextMenu([
                    getContextMenuForOption(option, j),
                ]),
            })];
        }),
    ]);

    menu.show({ button: event.currentTarget as HTMLElement }).catch(console.error);
}

function deleteAttachment(attachment: EmailAttachment) {
    const arr = new PatchableArray() as PatchableArrayAutoEncoder<EmailAttachment>;
    arr.addDelete(attachment.id);
    addPatch({ attachments: arr });
}

async function appendAttachment(file: File) {
    // Add this file as an attachment
    if (file.size > 9.5 * 1024 * 1024) {
        const error = $t(`93533097-46c1-4f88-a582-1634d57ac2c0`);
        Toast.error(error).setHide(20 * 1000).show();
        return;
    }

    if (!file.isPrivate) {
        console.error('Unexpected public file in email attachments', file);
        return;
    }

    if (!file.name) {
        const error = $t(`4de518e0-b600-4aa9-912d-4cba86331427`);
        Toast.error(error).setHide(20 * 1000).show();
        return;
    }

    if (!file.contentType) {
        file.contentType = 'application/octet-stream';
    }

    // todo
    if (file.name.endsWith('.docx') || file.name.endsWith('.xlsx') || file.name.endsWith('.doc') || file.name.endsWith('.xls')) {
        const error = $t(`70436d52-5a86-4231-89d5-2adf8bfd628f`);
        Toast.warning(error).setHide(30 * 1000).show();
    }

    const arr = new PatchableArray() as PatchableArrayAutoEncoder<EmailAttachment>;
    arr.addPut(EmailAttachment.create({
        filename: file.name,
        contentType: file.contentType,
        file,
    }));

    // Add patch
    addPatch({ attachments: arr });
}

const canOpenTemplates = computed(() => {
    return !!email.value?.getTemplateType() && auth.canManageEmailTemplates();
});

async function openTemplates() {
    const type = email.value?.getTemplateType();
    if (!type) {
        return;
    }

    const current = await getHTML();
    const hasExistingContent = (current).text.length > 2 || subject.value.length > 0;

    await present({
        components: [
            new ComponentWithProperties(EditEmailTemplatesView, {
                types: [type],
                onSelect: async (template: EmailTemplate) => {
                    if (hasExistingContent) {
                        if (!(await CenteredMessage.confirm(
                            $t(`e7ff72f3-ca11-4a2d-b6f9-afeb344f5da6`),
                            $t(`6d679732-b845-4f36-8ed3-4024cd01f745`),
                            $t(`be3680ca-ee60-4d09-b2f4-346617949956`),
                        ))) {
                            return false;
                        }
                    }
                    // todo
                    // set json and subject
                    editor.value?.commands.setContent(template.json);
                    subject.value = template.subject;

                    return true;
                },
                createOption: hasExistingContent
                    ? EmailTemplate.create({
                            id: '',
                            ...current,
                            subject: subject.value,
                            type,
                        })
                    : null,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

const shouldNavigateAway = async () => {
    if (sending.value || savingPatch.value) {
        return false;
    }

    if (props.editEmail) {
        if (sending.value || savingPatch.value) {
            return false;
        }

        if (patch.value === null) {
            return true;
        }
    }

    if (patch.value === null) {
        if (!initialEmail) {
            return true;
        }
        // encode object is added for reliable sorting the keys to compare
        const json = JSON.stringify(encodeObject(editor.value?.getJSON() ?? {}, { version: 0 }));
        if (initialEmail.subject === subject.value && JSON.stringify(encodeObject(initialEmail.json, { version: 0 })) === json && initialEmail.attachments.length === patchedEmail.value?.attachments.length) {
            return true;
        }
        console.log('has changes because of json/subject', json, initialEmail.json);
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
