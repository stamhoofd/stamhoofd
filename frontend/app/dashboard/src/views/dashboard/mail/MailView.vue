<template>
    <div class="st-view mail-view">
        <STNavigationBar title="Mail versturen">
            <template #right>
                <button class="button icon close gray" @click="dismiss" />
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            <span class="icon-spacer">Mail versturen</span>
        </STNavigationTitle>

        <main>
            <template v-if="emails.length == 0">
                <p v-if="fullAccess" class="warning-box">
                    Stel eerst jouw e-mailadressen in: <button class="button text" @click="manageEmails">
                        <span class="icon settings" />
                        <span>Wijzigen</span>
                    </button>
                </p>
                <p v-else class="warning-box">
                    Een administrator van jouw vereniging moet eerst de e-mailadressen instellen voor je een e-mail kan versturen.
                </p>
            </template>

            <div class="split-inputs">
                <STInputBox title="Onderwerp" error-fields="subject" :error-box="errorBox">
                    <input id="mail-subject" v-model="subject" class="input" type="text" placeholder="Typ hier het onderwerp van je e-mail">
                </STInputBox>
                <STInputBox v-if="emails.length > 0" title="Versturen vanaf">
                    <button v-if="fullAccess" slot="right" class="button text" @click="manageEmails">
                        <span class="icon settings" />
                        <span>Wijzigen</span>
                    </button>
                    <select v-model="emailId" class="input">
                        <option v-for="email in emails" :key="email.id" :value="email.id">
                            {{ email.name ? (email.name+" <"+email.email+">") : email.email }}
                        </option>
                    </select>
                </STInputBox>
            </div>

            <STInputBox id="message-title" title="Bericht" error-fields="message" :error-box="errorBox" class="max">
                <label slot="right" class="button text">
                    <span class="icon add" />
                    <span>Bijlage</span>
                    <input type="file" multiple="multiple" style="display: none;" accept=".pdf, .docx, .xlsx, .png, .jpeg, .jpg, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf, image/jpeg, image/png, image/gif" @change="changedFile">
                </label>
            </STInputBox>
            <MailEditor ref="editor" :has-first-name="hasFirstName" />

            <p v-if="fileWarning" class="warning-box">
                We raden af om Word of Excel bestanden door te sturen omdat veel mensen hun e-mails lezen op hun smartphone en die bestanden vaak niet (correct) kunnen openen. Zet de bestanden om in een PDF en stuur die door.
            </p>

            <STList v-if="files.length > 0" title="Bijlages">
                <STListItem v-for="(file, index) of files" :key="index" class="file-list-item right-description right-stack">
                    <span slot="left" class="icon file" />
                    {{ file.name }}

                    <template #right>
                        <span>{{ file.size }}</span>
                        <span><button class="button icon gray trash" @click.stop="deleteAttachment(index)" /></span>
                    </template>
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <template #left>
                {{
                    recipients.length
                        ? recipients.length > 1
                            ? recipients.length + " ontvangers"
                            : "Eén ontvanger"
                        : "Geen ontvangers"
                }}
            </template>
            <template #right>
                <LoadingButton :loading="sending">
                    <button class="button primary" :disabled="recipients.length == 0 || emails.length == 0" @click="send">
                        Versturen
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, LoadingButton, STInputBox, STList, STListItem, STNavigationTitle, Toast } from "@stamhoofd/components";
import { STToolbar } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { SegmentedControl } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { EmailAttachment,EmailRequest, Group, MemberWithRegistrations, Recipient, Replacement } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../classes/OrganizationManager';
import EmailSettingsView from '../settings/EmailSettingsView.vue';

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

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        SegmentedControl,
        STToolbar,
        STInputBox,
        LoadingButton,
        STList,
        STListItem,
        MailEditor: () => import(/* webpackChunkName: "MailEditor" */ './MailEditor.vue'),
    },
})
export default class MailView extends Mixins(NavigationMixin) {
    @Prop({ default: () => []})
    members!: MemberWithRegistrations[];

    @Prop({ default: () => []})
    otherRecipients: { firstName?: string; lastName?: string; email: string }[]

    sending = false

    @Prop({ default: null })
    defaultSubject!: string | null

    @Prop({ default: null })
    group!: Group | null

    // Make session (organization) reactive
    reactiveSession = SessionManager.currentSession

    emailId: string | null = (!!this.group?.privateSettings?.defaultEmailId && !!this.emails.find(e => e.id === this.group?.privateSettings?.defaultEmailId)?.id ? this.group?.privateSettings?.defaultEmailId : null) ?? this.emails.find(e => e.default)?.id ?? this.emails[0]?.id ?? null
    subject = this.defaultSubject ?? ""

    errorBox: ErrorBox | null = null

    files: TmpFile[] = []

    deleteAttachment(index) {
        this.files.splice(index, 1)
    }

    get fullAccess() {
        return SessionManager.currentSession!.user!.permissions!.hasFullAccess()
    }

    get fileWarning() {
        for (const file of this.files) {
            if (file.file.name.endsWith(".docx") || file.file.name.endsWith(".xlsx") || file.file.name.endsWith(".doc") || file.file.name.endsWith(".xls")) {
                return true
            }
        }
        return false;
    }

    activated() {
        // Update email id if created
        if (!this.emailId) {
            this.emailId = (!!this.group?.privateSettings?.defaultEmailId && !!this.emails.find(e => e.id === this.group?.privateSettings?.defaultEmailId)?.id ? this.group?.privateSettings?.defaultEmailId : null) ?? this.emails.find(e => e.default)?.id ?? this.emails[0]?.id ?? null
        }
    }

    changedFile(event) {
        if (!event.target.files || event.target.files.length == 0) {
            return;
        }

        for (const file of event.target.files as FileList) {
            this.files.push(new TmpFile(file.name, file))
        }
        
        // Clear selection
        event.target.value = null;
    }

    get organization() {
        return OrganizationManager.organization
    }

    get hasFirstName() {
        return !this.recipients.find(r => r.firstName == null)
    }

    get recipients(): Recipient[] {
        const recipients: Map<string, Recipient> = new Map()

        for (const member of this.members) {
            if (!member.details) {
                continue
            }

            for (const parent of member.details.parents) {
                if (!parent.email) {
                    continue;
                }

                if (recipients.has(parent.email) && recipients.get(parent.email)!.firstName) {
                    continue
                }

                recipients.set(parent.email, Recipient.create({
                    firstName: parent.firstName,
                    email: parent.email,
                    replacements: [
                        Replacement.create({
                            token: "firstName",
                            value: parent.firstName
                        })
                    ]
                }))
            }

            for (const user of member.users) {
                if (!user.email) {
                    continue;
                }

                if (recipients.has(user.email)) {
                    continue
                }

                recipients.set(user.email, Recipient.create({
                    firstName: user.firstName,
                    email: user.email,
                    replacements: [
                        Replacement.create({
                            token: "firstName",
                            value: user.firstName ?? ""
                        })
                    ]
                }))
            }

            if (!member.details.email) {
                continue;
            }

            if (recipients.has(member.details.email)  && recipients.get(member.details.email)!.firstName) {
                continue
            }

            recipients.set(member.details.email, Recipient.create({
                firstName: member.details.firstName,
                email: member.details.email,
                replacements: [
                    Replacement.create({
                        token: "firstName",
                        value: member.details.firstName
                    })
                ]
            }))
        }

        for (const recipient of this.otherRecipients) {
            if (recipients.has(recipient.email) && recipients.get(recipient.email)!.firstName) {
                continue
            }

            recipients.set(recipient.email, Recipient.create({
                firstName: recipient.firstName,
                email: recipient.email,
                replacements: [
                    Replacement.create({
                        token: "firstName",
                        value: recipient.firstName ?? ""
                    })
                ]
            }))
        }

        return Array.from(recipients.values())
    }

    get emails() {
        return this.organization.privateMeta?.emails ?? []
    }

    manageEmails() {
        this.show(new ComponentWithProperties(EmailSettingsView, {}))
    }

    async send() {
        if (this.sending || !this.emailId) {
            return;
        }

        if (this.subject.length < 2) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "",
                message: "Vul zeker een onderwerp in, anders is de kans groot dat jouw e-mail als spam wordt gezien",
                field: "subject"
            }))
            return;
        }

        try {
            const styles = "p {margin: 0; padding: 0;}; strong {font-weight: bold;} em {font-style: italic;}; h1 {font-size: 30px; font-weight: bold; margin: 0; padding: 0}; h2 {font-size: 20px; font-weight: bold; margin: 0; padding: 0}; h3 {font-size: 16px; font-weight: bold; margin: 0; padding: 0}; ol, ul {list-style-position: inside;}";
            let html = (this.$refs.editor as any).editor!.getHTML();

            const element = document.createElement("div")
            element.innerHTML = html

            const elements = element.querySelectorAll("span.replace-placeholder[data-replace-type='firstName']")
            for (const el of elements) {
                el.parentElement!.replaceChild(document.createTextNode("{{"+el.getAttribute("data-replace-type")+"}}"), el)
            }

            // add force add padding and margin inline
            const blocks = element.querySelectorAll("h1,h2,h3,p")
            for (const el of blocks) {
                (el as any).style.cssText = "margin: 0; padding: 0;"
            }

            // add empty paragraph <br>'s
            const emptyP = element.querySelectorAll("p:empty")
            for (const el of emptyP) {
                el.appendChild(document.createElement("br"))
            }

            const cssDiv = document.createElement('style');
            cssDiv.innerText = styles;

            html = "<style type=\"text/css\">"+cssDiv.innerHTML+"</style>"+element.innerHTML
            const text = element.textContent

            if (!text || text.length < 20) {
                this.errorBox = new ErrorBox(new SimpleError({
                    code: "",
                    message: "Vul een voldoende groot bericht in, anders is de kans groot dat jouw e-mail als spam wordt gezien",
                    field: "message"
                }))
                return;
            }

            this.errorBox = null
            this.sending = true;
          
          const toBase64 = file => new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsArrayBuffer(file)
                reader.onload = () => resolve(new Buffer(reader.result as ArrayBuffer).toString("base64"));
                reader.onerror = error => reject(error);
            });

            const attachments: EmailAttachment[] = []

            for (const file of this.files) {
                attachments.push(EmailAttachment.create({
                    filename: file.file.name,
                    content: await toBase64(file.file),
                    contentType: file.file.type
                }))
            }

            const emailRequest = EmailRequest.create({
                emailId: this.emailId,
                recipients: this.recipients,
                subject: this.subject,
                html,
                attachments
            })

            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/email",
                body: emailRequest,
            })
            this.dismiss({ force: true })
            new Toast("Jouw e-mail is verstuurd", "success").show()
        } catch (e) {
            console.error(e)
        }
        this.sending = false
    }

    shouldNavigateAway() {
        if (confirm("Ben je zeker dat je dit venster wilt sluiten?")) {
            return true;
        }
        return false;
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.mail-view {
    > main {
        display: flex;
        flex-grow: 1;
        flex-direction: column;

        #message-title {
            padding-bottom: 0;
        }

        & > .editor {
            flex-grow: 1;
            display: flex;
            flex-direction: column;

            justify-content: stretch;
            align-items: stretch;
            min-height: 200px;

            & > .editor-content {
                flex-grow: 1;
                display: flex;
                flex-direction: column;

                & > .ProseMirror {
                    flex-grow: 1;
                }
            }
        }

        .file-list-item {
            .middle {
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }
        }
    }
}
</style>
