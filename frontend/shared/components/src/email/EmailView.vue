<template>
    <LoadingView v-if="creatingEmail || !email" />
    <EditorView v-else ref="editorView" class="mail-view" :loading="sending" title="Nieuwe e-mail" save-text="Versturen" :smart-variables="smartVariables" :smart-buttons="smartButtons" @save="send">
        <h1 class="style-navigation-title">
            Nieuwe e-mail
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <!-- Buttons -->
        <template #buttons>
            <label v-tooltip="'Bijlage toevoegen'" class="button icon attachment">
                <input type="file" multiple="true" style="display: none;" accept=".pdf, .docx, .xlsx, .png, .jpeg, .jpg, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf, image/jpeg, image/png, image/gif" @change="changedFile">
                <span v-if="$isMobile && files.length > 0" class="style-bubble">{{ files.length }}</span>
            </label>

            <hr v-if="canOpenTemplates">
            <button v-if="canOpenTemplates" v-tooltip="'Templates'" class="button icon lightning" type="button" @click="openTemplates" />
        </template>

        <!-- List -->
        <template #list>
            <STListItem class="no-padding right-stack">
                <div class="list-input-box">
                    <span>Aan:</span>

                    <button class="list-input dropdown" type="button" @click="showToMenu">
                        <span>{{ toDescription }}</span>
                        <span class="icon arrow-down-small gray" />
                    </button>
                </div>
                <template #right>
                    <span v-if="email.recipientCount !== null" class="style-description-small">{{ formatInteger(email.recipientCount) }}</span>
                    <span v-else class="style-placeholder-skeleton" />
                </template>
            </STListItem>
            <STListItem class="no-padding" element-name="label">
                <div class="list-input-box">
                    <span>Onderwerp:</span>
                    <input id="mail-subject" v-model="subject" class="list-input" type="text" placeholder="Typ hier het onderwerp van je e-mail">
                </div>
            </STListItem>
            <STListItem v-if="emails.length > 0" class="no-padding" element-name="label">
                <div class="list-input-box">
                    <span>Van:</span>

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
            <STList v-if="files.length > 0">
                <STListItem v-for="(file, index) in files" :key="index" class="file-list-item">
                    <template #left>
                        <span :class="'icon '+getFileIcon(file)" />
                    </template>
                    <h3 class="style-title-list" v-text="file.name" />
                    <p class="style-description-small">
                        {{ file.size }}
                    </p>

                    <template #right>
                        <button class="button icon gray trash" type="button" @click.stop="deleteAttachment(index)" />
                    </template>
                </STListItem>
            </STList>
        </template>

        <!-- Warnings and errors -->
        <template v-if="emails.length == 0">
            <p v-if="auth.hasFullAccess()" class="warning-box selectable with-button" @click="manageEmails">
                Stel eerst jouw e-mailadressen in
                <span class="button text inherit-color">
                    <span class="icon settings" />
                    <span>Wijzigen</span>
                </span>
            </p>
            <p v-else class="warning-box">
                Een hoofdbeheerder van jouw vereniging moet eerst e-mailadressen instellen voor je een e-mail kan versturen.
            </p>
        </template>
    </EditorView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, Decoder, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { useRequestOwner } from '@stamhoofd/networking';
import { Email, EmailPreview, EmailRecipientFilter, EmailRecipientSubfilter, EmailStatus, EmailTemplate, OrganizationEmail, Version } from '@stamhoofd/structures';
import { Formatter, throttle } from '@stamhoofd/utility';
import { Ref, computed, nextTick, onMounted, ref, watch } from 'vue';
import EditorView from '../editor/EditorView.vue';
import { EmailStyler } from '../editor/EmailStyler';
import { useErrors } from '../errors/useErrors';
import { useAuth, useContext, useInterval, useIsMobile, useOrganization, usePlatform } from '../hooks';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { Toast } from '../overlays/Toast';
import { EditEmailTemplatesView } from '.';
import { CenteredMessage } from '../overlays/CenteredMessage';
import EmailSettingsView from './EmailSettingsView.vue';

const props = withDefaults(defineProps<{
    defaultSubject?: string,
    recipientFilterOptions: {
        name: string,
        value: EmailRecipientSubfilter[]
    }[][]
}>(), {
    defaultSubject: "",
});

class TmpFile {
    name: string;
    file: File;
    size: string;

    constructor(name: string, file: File) {
        this.name = name
        this.file = file
        this.size = Formatter.fileSize(file.size)
    }
}

const creatingEmail = ref(true);
const smartVariables = computed(() => email.value ? email.value.smartVariables : []);
const smartButtons = computed(() => email.value ? email.value.smartButtons : []);
const errors = useErrors();
const files = ref([]) as Ref<TmpFile[]>
const auth = useAuth()
const $isMobile = useIsMobile()
const email = ref(null) as Ref<EmailPreview | null>;
const context = useContext();
const owner = useRequestOwner();
const selectedRecipientOptions = ref(props.recipientFilterOptions.map(() => 0));
const groupByEmail = ref(false);
const editorView = ref(null) as Ref<EditorView | null>;
const editor = computed(() => editorView.value?.editor);
const pop = usePop();
const present = usePresent();
const organization = useOrganization();
const platform = usePlatform();

const emails = computed(() => {
    if (organization.value) {
        return organization.value.privateMeta?.emails ?? []
    }
    return platform.value?.privateConfig?.emails ?? []
})

const patch = ref(null) as Ref<AutoEncoderPatchType<Email>|null>;
const savingPatch = ref(null) as Ref<AutoEncoderPatchType<Email>|null>;
const sending = ref(false);

const patchedEmail = computed(() => {
    if (savingPatch.value) {
        return patch.value ? email.value?.patch(savingPatch.value).patch(patch.value) : email.value?.patch(savingPatch.value)
    }
    if (patch.value) {
        return email.value?.patch(patch.value)
    }
    return email.value
})

function addPatch(newPatch: PartialWithoutMethods<AutoEncoderPatchType<Email>>) {
    patch.value = patch.value ? patch.value.patch(Email.patch(newPatch)) : Email.patch(newPatch)
}

const recipientFilter = computed(() => {
    const filter = EmailRecipientFilter.create({})
    for (let i = 0; i < props.recipientFilterOptions.length; i++) {
        filter.filters.push(
            ...props.recipientFilterOptions[i][selectedRecipientOptions.value[i]].value
        )
    }
    filter.groupByEmail = groupByEmail.value
    return filter;
});

const toDescription = computed(() => {
    return props.recipientFilterOptions.map((options, i) => {
        return options[selectedRecipientOptions.value[i]].name
    }).join(", ")
})

watch([selectedRecipientOptions, groupByEmail], () => {
    addPatch({recipientFilter: recipientFilter.value})
}, {deep: true})

const subject = computed({
    get: () => patchedEmail.value?.subject || "",
    set: (subject) => {
        addPatch({subject})
    }
})

const fromAddress = computed({
    get: () => patchedEmail.value?.fromAddress ?? null,
    set: (fromAddress) => {
        addPatch({fromAddress})
    }
})

const fromName = computed({
    get: () => patchedEmail.value?.fromName ?? null,
    set: (fromName) => {
        addPatch({fromName})
    }
})

const selectedEmailAddress = computed({
    get: () => emails.value.find(e => e.email === fromAddress.value && e.name === fromName.value) ?? emails.value.find(e => e.email === fromAddress.value) ?? emails.value.find(e => e.name && e.name === fromName.value) ?? null,
    set: (email: OrganizationEmail|null) => {
        addPatch({
            fromAddress: email?.email ?? null,
            fromName: email?.name ?? null
        })
    }
})


watch(patch, (newValue, oldValue) => {
    if (newValue === null) {
        return;
    }
    doThrottledPatch()
}, {})

watch(editor, (e) => {
    if (!e) {
        return;
    }
    const handler = () => {
        // save json
        addPatch({json: e.getJSON()})
    }
    e.on('update', handler);

    return () => {
        e.off('update', handler);
    }
}, {deep: false});

onMounted(() => {
    // Create the email
    createEmail().catch(console.error)
})

useInterval(async () => {
    if (!email.value || email.value.recipientCount !== null) {
        return;
    }
    await updateEmail()
}, 1000)

async function createEmail() {
    const response = await context.value.authenticatedServer.request({
        method: 'POST',
        path: '/email',
        body: Email.create({
            recipientFilter: recipientFilter.value,
            fromAddress: emails.value.length > 0 ? (emails.value.find(e => e.default) ?? emails.value[0]).email : null,
            fromName: emails.value.length > 0 ? (emails.value.find(e => e.default) ?? emails.value[0]).name : null,
            status: EmailStatus.Draft,
            subject: props.defaultSubject
        }),
        decoder: EmailPreview as Decoder<EmailPreview>,
        owner,
        shouldRetry: false
    })

    email.value = response.data
    creatingEmail.value = false
    groupByEmail.value = response.data.recipientFilter.groupByEmail

    if (response.data.subject) {
        subject.value = response.data.subject
    }

    await nextTick();

    if (response.data.json) {
        editor.value?.commands.setContent(response.data.json)
    }
}

const doThrottledPatch = throttle(patchEmail, 1000);

async function patchEmail() {
    if (!email.value) {
        return
    }

    if (savingPatch.value || !patch.value) {
        return
    }
    if (sending.value) {
        return;
    }

    const _savingPatch = patch.value
    savingPatch.value = _savingPatch
    patch.value = null

    try {
        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/email/' + email.value.id,
            body: _savingPatch,
            decoder: EmailPreview as Decoder<EmailPreview>,
            owner,
            shouldRetry: false
        })

        email.value = response.data

        savingPatch.value = null

        // changed meanwhile
        if (patch.value) {
            // do again
            patchEmail().catch(console.error)
        }
    } catch (e) {
        console.error(e);
        //patch.value = patch.value ? _savingPatch.patch(patch.value) : _savingPatch
    }
    savingPatch.value = null
}

async function updateEmail() {
    if (!email.value) {
        return
    }
    const response = await context.value.authenticatedServer.request({
        method: 'GET',
        path: '/email/' + email.value.id,
        decoder: EmailPreview as Decoder<EmailPreview>,
        owner,
        shouldRetry: false
    })

    email.value = response.data
}

async function manageEmails() {
    await present({
        components: [
            new ComponentWithProperties(EmailSettingsView, {})
        ],
        modalDisplayStyle: 'popup'
    })
}

async function getHTML() {
    const e = editor.value
    if (!e) {
        // When editor is not yet loaded: slow internet -> need to know html on dismiss confirmation
        return {
            text: "",
            html: "",
            JSON: {}
        }
    }

    const base: string = e.getHTML();
    return {
        ...await EmailStyler.format(base, subject.value),
        json: e.getJSON()
    }
}

async function send() {
    if (sending.value) {
        return;
    }

    if (savingPatch.value) {
        Toast.info('Even geduld, de wijzigingen zijn nog aan het opslaan. Probeer straks opnieuw.').show();
        return;
    }

    if (!email.value) {
        return
    }

    sending.value = true

    try {
        const {text, html} = await getHTML()
        await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/email/' + email.value.id,
            body: Email.patch({
                ...patch.value,
                status: EmailStatus.Sending,
                subject: subject.value,
                text,
                html,
                json: editor.value?.getJSON()
            }),
            decoder: EmailPreview as Decoder<EmailPreview>,
            owner,
            shouldRetry: false
        })

        Toast.success('De e-mail is verzonden. Het kan even duren voor alle e-mails zijn verstuurd.').show()
        await pop({force: true})
    } catch (e) {
        console.error(e);
        Toast.fromError(e).show()
    }
    sending.value = false
}

async function showToMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        props.recipientFilterOptions.map((options, j) => {
            const selectedOption = options[selectedRecipientOptions.value[j]]
            return new ContextMenuItem({
                name: selectedOption.name,
                childMenu: new ContextMenu([
                    options.map((option, i) => {
                        return new ContextMenuItem({
                            name: option.name,
                            selected: i === selectedRecipientOptions.value[j],
                            action: () => {
                                selectedRecipientOptions.value[j] = i
                            },
                        })
                    })
                ])
            })
        }),
        [
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
        ]
    ])

    menu.show({ button: event.currentTarget }).catch(console.error)
}

function getFileIcon(file: TmpFile) {
    if (file.file.name.endsWith(".png") || file.file.name.endsWith(".jpg") || file.file.name.endsWith(".jpeg") || file.file.name.endsWith(".gif")) {
        return "file-image"
    }
    if (file.file.name.endsWith(".pdf")) {
        return "file-pdf color-pdf"
    }
    if (file.file.name.endsWith(".xlsx") || file.file.name.endsWith(".xls")) {
        return "file-excel color-excel"
    }
    if (file.file.name.endsWith(".docx") || file.file.name.endsWith(".doc")) {
        return "file-word color-word"
    }
    return "file"
}

function deleteAttachment(index: number) {
    files.value.splice(index, 1)
}

function changedFile(event: InputEvent & { target: HTMLInputElement & { files: FileList } }) {
    if (!event.target.files || event.target.files.length == 0) {
        return;
    }

    for (const file of event.target.files as FileList) {
        const f = new TmpFile(file.name, file)
        files.value.push(f)

        if (f.file.name.endsWith(".docx") || f.file.name.endsWith(".xlsx") || f.file.name.endsWith(".doc") || f.file.name.endsWith(".xls")) {
            const error = "We raden af om Word of Excel bestanden door te sturen omdat veel mensen hun e-mails lezen op hun smartphone en die bestanden vaak niet (correct) kunnen openen. Sommige mensen hebben ook geen licentie voor Word/Excel, want dat is niet gratis. Zet de bestanden om in een PDF en stuur die door."
            Toast.warning(error).setHide(30*1000).show()
        }
    }
    
    // Clear selection
    (event.target as any).value = null;
}

const canOpenTemplates = computed(() => {
    return !!email.value?.getTemplateType()
})
async function openTemplates() {
    const type = email.value?.getTemplateType()
    if (!type) {
        return;
    }

    const current = await getHTML()
    const hasExistingContent = (current).text.length > 2 || subject.value.length > 0

    await present({
        components: [
            new ComponentWithProperties(EditEmailTemplatesView, {
                types: [type],
                onSelect: async (template: EmailTemplate) => {
                    if (hasExistingContent) {
                        if (!await CenteredMessage.confirm('Ben je zeker dat je de huidige inhoud wilt overschrijven?', 'Overschrijven', 'De huidige inhoud van je e-mail gaat verloren')) {
                            return false;
                        }
                    }
                    // todo
                    // set json and subject
                    editor.value?.commands.setContent(template.json)
                    subject.value = template.subject

                    return true;
                },
                createOption: hasExistingContent ? EmailTemplate.create({
                    id: '',
                    ...current,
                    subject: subject.value,
                }) : null
            })
        ],
        modalDisplayStyle: 'popup'
    })

}
</script>
