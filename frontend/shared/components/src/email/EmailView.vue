<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <EditorView v-if="!(creatingEmail || !email || !patchedEmail)" ref="editorView" class="mail-view" :loading="sending" :save-text="$t('d1e7abf8-20ac-49e5-8e0c-cc7fab78fc6b')" :replacements="replacements" :title="$t(`3338f8ad-c4d7-4d09-9254-70bc3f0449a9`)" @save="send">
            <h1 class="style-navigation-title">
                {{ $t('59367bfa-a918-4475-8d90-d9e3d6c71ad8') }}
            </h1>

            <STErrorsDefault :error-box="errors.errorBox" />

            <!-- Buttons -->
            <template #buttons>
                <label v-tooltip="$t('d76495d1-251b-4cf1-9ca1-7e7ac33a046f')" class="button icon attachment">
                    <input type="file" multiple="true" style="display: none;" accept=".pdf, .docx, .xlsx, .png, .jpeg, .jpg, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf, image/jpeg, image/png, image/gif" @change="(e: any) => changedFile(e)"><span v-if="$isMobile && files.length > 0" class="style-bubble">{{ files.length }}</span>
                </label>

                <hr v-if="canOpenTemplates"><button v-if="canOpenTemplates" v-tooltip="$t('20bacd85-5b82-4396-bbd5-b6d88e7d90e4')" class="button icon email-template" type="button" @click="openTemplates" />
            </template>

            <!-- List -->
            <template #list>
                <STListItem class="no-padding right-stack">
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
                        <span v-if="patchedEmail.recipientCount !== null" class="style-description-small">{{ formatInteger(patchedEmail.recipientCount) }}</span>
                        <span v-else class="style-placeholder-skeleton" />
                    </template>
                </STListItem>
                <STListItem class="no-padding" element-name="label">
                    <div class="list-input-box">
                        <span>{{ $t('709a5ff3-8d79-447b-906d-2c3cdabb41cf') }}:</span>
                        <input id="mail-subject" v-model="subject" class="list-input" type="text" :placeholder="$t(`13b42902-e159-4e6a-8562-e87c9c691c8b`)">
                    </div>
                </STListItem>
                <STListItem v-if="emails.length > 0" class="no-padding" element-name="label">
                    <div class="list-input-box">
                        <span>{{ $t('01b5d104-748c-4801-a369-4eab05809fcf') }}:</span>

                        <div class="input-icon-container right icon arrow-down-small gray">
                            <select v-model="selectedEmailAddress" class="list-input">
                                <option v-for="e in emails" :key="e.id" :value="e">
                                    {{ e.name ? (e.name+" <"+e.email+">") : e.email }}
                                </option>
                            </select>
                        </div>
                    </div>

                    <template v-if="auth.hasFullAccess()" #right>
                        <button class="button text" type="button" @click="manageEmails">
                            <span class="icon settings" />
                        </button>
                    </template>
                </STListItem>
            </template>

            <!-- Editor footer -->
            <template #footer>
                <!-- E-mail attachments -->
                <STList v-if="patchedEmail.attachments.length > 0">
                    <STListItem v-for="attachment in patchedEmail.attachments" :key="attachment.id" class="file-list-item">
                        <template #left>
                            <span :class="'icon '+getFileIcon(attachment)" />
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
            <template v-if="emails.length === 0">
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
    </loadingviewtransition>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, Decoder, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { useRequestOwner } from '@stamhoofd/networking';
import { Email, EmailAttachment, EmailPreview, EmailRecipientFilter, EmailRecipientSubfilter, EmailStatus, EmailTemplate, OrganizationEmail } from '@stamhoofd/structures';
import { Formatter, throttle } from '@stamhoofd/utility';
import { Ref, computed, nextTick, onMounted, ref, watch } from 'vue';
import { EditEmailTemplatesView } from '.';
import EditorView from '../editor/EditorView.vue';
import { EmailStyler } from '../editor/EmailStyler';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useAuth, useContext, useInterval, useIsMobile, useOrganization, usePlatform } from '../hooks';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { Toast } from '../overlays/Toast';
import EmailSettingsView from './EmailSettingsView.vue';

const props = withDefaults(defineProps<{
    defaultSubject?: string;
    recipientFilterOptions: (RecipientChooseOneOption | RecipientMultipleChoiceOption)[];
    emailId?: string | null;
}>(), {
    defaultSubject: '',
    emailId: null,
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

class TmpFile {
    name: string;
    file: File;
    size: string;

    constructor(name: string, file: File) {
        this.name = name;
        this.file = file;
        this.size = Formatter.fileSize(file.size);
    }
}

const creatingEmail = ref(true);
const organization = useOrganization();
const platform = usePlatform();
const replacements = computed(() => {
    return email.value ? (email.value.exampleRecipient?.getReplacements(organization.value, platform.value) ?? []) : [];
});
const errors = useErrors();
const files = ref([]) as Ref<TmpFile[]>;
const auth = useAuth();
const $isMobile = useIsMobile();
const email = ref(null) as Ref<EmailPreview | null>;
const context = useContext();
const owner = useRequestOwner();

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

const emails = computed(() => {
    if (organization.value) {
        return organization.value.privateMeta?.emails ?? [];
    }
    return platform.value?.privateConfig?.emails ?? [];
});

const patch = ref(null) as Ref<AutoEncoderPatchType<Email> | null>;
const savingPatch = ref(null) as Ref<AutoEncoderPatchType<Email> | null>;
const sending = ref(false);

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
    addPatch({ recipientFilter: recipientFilter.value });
}, { deep: true });

const subject = computed({
    get: () => patchedEmail.value?.subject || '',
    set: (subject) => {
        addPatch({ subject });
    },
});

const fromAddress = computed({
    get: () => patchedEmail.value?.fromAddress ?? null,
    set: (fromAddress) => {
        addPatch({ fromAddress });
    },
});

const fromName = computed({
    get: () => patchedEmail.value?.fromName ?? null,
    set: (fromName) => {
        addPatch({ fromName });
    },
});

const selectedEmailAddress = computed({
    get: () => emails.value.find(e => e.email === fromAddress.value && e.name === fromName.value) ?? emails.value.find(e => e.email === fromAddress.value) ?? emails.value.find(e => e.name && e.name === fromName.value) ?? null,
    set: (email: OrganizationEmail | null) => {
        addPatch({
            fromAddress: email?.email ?? null,
            fromName: email?.name ?? null,
        });
    },
});

watch(patch, (newValue, oldValue) => {
    if (newValue === null) {
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
    createEmail().catch(console.error);
});

useInterval(async () => {
    if (!email.value || email.value.recipientCount !== null) {
        return;
    }
    await updateEmail();
}, 1000);

async function createEmail() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/email',
            body: Email.create({
                recipientFilter: recipientFilter.value,
                fromAddress: emails.value.length > 0 ? (emails.value.find(e => e.id === props.emailId) ?? emails.value.find(e => e.default) ?? emails.value[0]).email : null,
                fromName: emails.value.length > 0 ? (emails.value.find(e => e.id === props.emailId) ?? emails.value.find(e => e.default) ?? emails.value[0]).name : null,
                status: EmailStatus.Draft,
                subject: props.defaultSubject,
            }),
            decoder: EmailPreview as Decoder<EmailPreview>,
            owner,
            shouldRetry: false,
        });

        email.value = response.data;
        creatingEmail.value = false;
        groupByEmail.value = response.data.recipientFilter.groupByEmail;

        if (response.data.subject) {
            subject.value = response.data.subject;
        }

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

const doThrottledPatch = throttle(patchEmail, 1000);

async function patchEmail() {
    if (!email.value) {
        return;
    }

    if (savingPatch.value || !patch.value) {
        return;
    }
    if (sending.value) {
        return;
    }

    const _savingPatch = patch.value;
    savingPatch.value = _savingPatch;
    patch.value = null;

    try {
        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/email/' + email.value.id,
            body: _savingPatch,
            decoder: EmailPreview as Decoder<EmailPreview>,
            owner,
            shouldRetry: false,
        });

        email.value = response.data;

        savingPatch.value = null;

        // changed meanwhile
        if (patch.value) {
            // do again
            patchEmail().catch(console.error);
        }
    }
    catch (e) {
        console.error(e);
        Toast.fromError(e).setHide(20000).show();
    }
    savingPatch.value = null;
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

        email.value = response.data;
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

async function send() {
    if (sending.value) {
        return;
    }

    if (savingPatch.value) {
        Toast.info($t(`a6d49891-5af9-4dee-8dba-57ad854fb955`)).show();
        return;
    }

    if (!email.value) {
        return;
    }

    const recipientCount = email.value.recipientCount;
    let confirmText = $t(`8ea1d574-6388-4033-bb4e-f2e031d2da3b`);

    if (recipientCount) {
        confirmText = recipientCount === 1 ? `Ben je zeker dat je de e-mail naar 1 ontvanger wilt versturen?` : `Ben je zeker dat je de e-mail naar ${email.value.recipientCount} ontvangers wilt versturen?`;
    }

    const isConfirm = await CenteredMessage.confirm(confirmText, $t(`e0c68f8b-ccb1-4622-8570-08abc7f5705a`));

    if (!isConfirm) return;

    sending.value = true;

    try {
        const { text, html } = await getHTML();
        const resopnse = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/email/' + email.value.id,
            body: Email.patch({
                ...patch.value,
                status: EmailStatus.Sending,
                subject: subject.value,
                text,
                html,
                json: editor.value?.getJSON(),
            }),
            decoder: EmailPreview as Decoder<EmailPreview>,
            owner,
            shouldRetry: false,
        });

        Toast.success($t(`0adee17a-6cb5-4b32-a2a9-c6f44cbb3e7d`)).show();
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
        /* [
            new ContextMenuItem({
                name: groupByEmail.value ? "Eén e-mail per e-mailadres" : "Aparte e-mails per lid (aanbevolen)",
                childMenu: new ContextMenu([
                    [
                        new ContextMenuItem({
                            name: "Aparte e-mails per lid (aanbevolen)",
                            description: 'Als hetzelfde e-mailadres bij meerdere leden hoort, krijgt dat e-mailadres één e-mail per lid',
                            selected: !groupByEmail.value,
                            action: () => {
                                groupByEmail.value = false
                            }
                        }),
                        new ContextMenuItem({
                            name: "Eén e-mail per e-mailadres",
                            description: 'Dubbele e-mailadressen ontvangen maar één e-mail, maar daardoor zijn bepaalde slimme tekstvervangingen niet beschikbaar (zoals de naam van het lid).',
                            selected: groupByEmail.value,
                            action: () => {
                                groupByEmail.value = true
                            }
                        }),
                    ]
                ])
            })
        ] */
    ]);

    menu.show({ button: event.currentTarget as HTMLElement }).catch(console.error);
}

function getFileIcon(file: EmailAttachment) {
    if (file.filename.endsWith('.png') || file.filename.endsWith('.jpg') || file.filename.endsWith('.jpeg') || file.filename.endsWith('.gif')) {
        return 'file-image';
    }
    if (file.filename.endsWith('.pdf')) {
        return 'file-pdf color-pdf';
    }
    if (file.filename.endsWith('.xlsx') || file.filename.endsWith('.xls')) {
        return 'file-excel color-excel';
    }
    if (file.filename.endsWith('.docx') || file.filename.endsWith('.doc')) {
        return 'file-word color-word';
    }
    return 'file';
}

function deleteAttachment(attachment: EmailAttachment) {
    const arr = new PatchableArray() as PatchableArrayAutoEncoder<EmailAttachment>;
    arr.addDelete(attachment.id);
    addPatch({ attachments: arr });
}

async function toBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // Remove data:*;base64,
            const str = reader.result as string;
            const index = str.indexOf('base64,');
            if (index !== -1) {
                resolve(str.slice(index + 7));
            }
            else {
                reject('Invalid base64');
            }
        };
        reader.onerror = (e) => {
            reject(e);
        };

        reader.readAsDataURL(file);
    });
}

async function changedFile(event: InputEvent & { target: HTMLInputElement & { files: FileList } }) {
    if (!event.target.files || event.target.files.length === 0) {
        return;
    }

    const arr = new PatchableArray() as PatchableArrayAutoEncoder<EmailAttachment>;

    for (const file of event.target.files as FileList) {
        if (file.size > 10 * 1024 * 1024) {
            const error = $t(`93533097-46c1-4f88-a582-1634d57ac2c0`);
            Toast.error(error).setHide(20 * 1000).show();
            continue;
        }

        // const f = new TmpFile(file.name, file)
        // files.value.push(f)

        // Add attachment
        arr.addPut(EmailAttachment.create({
            filename: file.name,
            contentType: file.type,
            content: await toBase64(file),
        }));

        if (file.name.endsWith('.docx') || file.name.endsWith('.xlsx') || file.name.endsWith('.doc') || file.name.endsWith('.xls')) {
            const error = $t(`70436d52-5a86-4231-89d5-2adf8bfd628f`);
            Toast.warning(error).setHide(30 * 1000).show();
        }
    }

    // Clear selection
    (event.target as any).value = null;

    // Add patch
    addPatch({ attachments: arr });
}

const canOpenTemplates = computed(() => {
    return !!email.value?.getTemplateType();
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
</script>
