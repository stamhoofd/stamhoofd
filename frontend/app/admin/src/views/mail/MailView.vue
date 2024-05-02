<template>
    <EditorView :ref="editorView" :disabled="!emailId" class="mail-view" title="Nieuwe e-mail" save-text="Versturen" :smart-variables="smartVariables" :smart-buttons="smartButtons" :style="{'--editor-primary-color': primaryColor, '--editor-primary-color-contrast': primaryColorContrast}" @save="send">
        <h1 class="style-navigation-title">
            Nieuwe e-mail
        </h1>

        <STErrorsDefault :error-box="errorBox" />

        <!-- Buttons -->
        <template #buttons>
            <label v-tooltip="'Bijlage toevoegen'" class="button icon attachment">
                <input type="file" multiple="multiple" style="display: none;" accept=".pdf, .docx, .xlsx, .png, .jpeg, .jpg, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf, image/jpeg, image/png, image/gif" @change="changedFile">
                <span v-if="$isMobile && files.length > 0" class="style-bubble">{{ files.length }}</span>
            </label>
            <hr v-if="!$isMobile">
            <button v-if="!$isMobile" v-tooltip="'Voorbeeld tonen'" class="button icon eye" type="button" @click="openPreview" />
        </template>

        <!-- List -->
        <template #list>
            <STListItem class="no-padding right-stack">
                <div class="list-input-box">
                    <span>Aan:</span>
                    <span class="list-input">{{ recipients.length == 1 ? (recipients[0].firstName+" "+(recipients[0].lastName || '')) : recipients.length +" ontvangers" }}</span>
                </div>
                <template v-if="hasToWarnings" #right><button class="button icon warning yellow" type="button" @click="showToWarnings" /></template>
            </STListItem>
            <STListItem class="no-padding" element-name="label">
                <div class="list-input-box">
                    <span>Onderwerp:</span>
                    <input id="mail-subject" v-model="subject" class="list-input" type="text" placeholder="Typ hier het onderwerp" autocomplete="off">
                </div>
            </STListItem>
            <STListItem v-if="emails.length > 0" class="no-padding" element-name="label">
                <div class="list-input-box">
                    <span>Van:</span>

                    <div class="input-icon-container right icon arrow-down-small gray">
                        <select v-model="emailId" class="list-input">
                            <option v-for="email in emails" :key="email.email" :value="email.email">
                                {{ email.name ? (email.name+" <"+email.email+">") : email.email }}
                            </option>
                        </select>
                    </div>
                </div>
            </STListItem>
        </template>

        <!-- Editor footer -->
        <template #footer>
            <!-- E-mail attachments -->
            <STList v-if="files.length > 0">
                <STListItem v-for="(file, index) in files" :key="index" class="file-list-item">
                    <template #left><span :class="'icon '+getFileIcon(file)" /></template>
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
    </EditorView>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, Dropdown, EditorSmartButton, EditorSmartVariable, EditorView, EmailStyler, ErrorBox, STErrorsDefault, STInputBox, STList, STListItem, Toast, ToastButton, TooltipDirective } from "@stamhoofd/components";
import { AppManager, SessionManager } from '@stamhoofd/networking';
import { EmailAttachment, EmailInformation, EmailRequest, Recipient, Replacement } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import { AdminSession } from '../../classes/AdminSession';
import MissingFirstNameView from './MissingFirstNameView.vue';


class Email {
    email: string
    name: string

    constructor(email: string, name: string) {
        this.email = email
        this.name = name
    }
}

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
        EditorView,
        STInputBox,
        STList,
        STListItem,
        Checkbox,
        Dropdown,
        STErrorsDefault,
    },
    directives: {
        Tooltip: TooltipDirective
    }
})
export default class MailView extends Mixins(NavigationMixin) {
    @Prop({ default: () => []})
        otherRecipients: ({ firstName?: string; lastName?: string; email: string } | Recipient) []

    sending = false

    @Prop({ default: null })
        defaultSubject!: string | null

    // Make session (organization) reactive
    reactiveSession = this.$context

    emailId: string | null = this.emails[0].email
    subject = this.defaultSubject ?? ""

    errorBox: ErrorBox | null = null

    files: TmpFile[] = []

    checkingBounces = false
    emailInformation: EmailInformation[] = []

    editorView: EditorView | null = null

    get smartVariables() {
        const variables = [
            new EditorSmartVariable({
                id: "firstName", 
                name: "Voornaam", 
                example: "", 
                deleteMessage: "De voornaam van één of meerdere ontvangers ontbreekt in het systeem. De magische tekstvervanging voor de voornaam is daarom weggehaald."
            }),
            new EditorSmartVariable({
                id: "lastName", 
                name: "Achternaam", 
                example: "", 
                deleteMessage: "De achternaam van één of meerdere ontvangers ontbreekt in het systeem. De magische tekstvervanging voor de achteraam is daarom weggehaald."
            }),
            new EditorSmartVariable({
                id: "organization", 
                name: "Naam vereniging", 
                example: ""
            }),
            new EditorSmartVariable({
                id: "email", 
                name: "E-mailadres", 
                example: "", 
            })
        ]

        // Remove all smart variables that are not set in the recipients
        return variables.filter(variable => {
            for (const recipient of this.recipients) {
                const replacement = recipient.replacements.find(r => r.token === variable.id && (r.value.length > 0 || r.html !== undefined))
                if (!replacement) {
                    // Not found
                    console.log("Remove variable", variable.id, "because it is not set in recipient", recipient)
                    return false
                } else {
                    if (replacement.html && (variable.html === undefined || variable.html.length == 0)) {
                        variable.html = replacement.html
                    }
                    if (variable.html === undefined && variable.example.length == 0) {
                        variable.example = replacement.value
                    }
                }
            }
            return true
        })
    }

    get smartButtons() {
        const buttons: EditorSmartButton[] = []

        // Remove all smart variables that are not set in the recipients
        return buttons.filter(button => {
            if (button.id === "signInUrl") {
                // Already checked initially
                return true
            }
            for (const recipient of this.recipients) {
                const replacement = recipient.replacements.find(r => r.token === button.id && r.value.length > 0)
                if (!replacement) {
                    // Not found
                    return false
                }
            }
            return true
        })
    }

    get hasToWarnings() {
        return this.recipients.length == 0 || this.hardBounces.length > 0 || this.spamComplaints.length > 0
    }

    showToWarnings() {
        if (this.hardBounces.length > 0) {
            new Toast((this.hardBounces.length != 1 ? this.hardBounces.length+' e-mailadressen zijn' : 'Eén e-mailadres is')+" ongeldig. Deze worden uitgesloten.", "warning yellow")
                .setButton(new ToastButton("Toon", () => {
                    this.openHardBounces()
                }))
                .setHide(10*1000)
                .show()
        }
        if (this.spamComplaints.length > 0) {
            new Toast((this.spamComplaints.length != 1 ? this.spamComplaints.length+' e-mailadressen hebben' : 'Eén e-mailadres heeft')+" eerdere e-mails als spam gemarkeerd. Deze worden uitgesloten.", "warning yellow")
                .setButton(new ToastButton("Toon", () => {
                    this.openSpamComplaints()
                }))
                .setHide(10*1000)
                .show()
        }

        if (this.recipients.length == 0) {
            new Toast("Geen ontvangers gevonden. Kijk na of er wel e-mailadressen beschikbaar zijn.", "warning yellow")
                .setHide(10*1000)
                .show()
        }
    }

    deleteAttachment(index: number) {
        this.files.splice(index, 1)
    }

    async checkBounces() {
        if (this.checkingBounces) {
            return
        }
        this.checkingBounces = true

        try {
            const response = await AdminSession.shared.authenticatedServer.request({
                method: "POST",
                path: "/email/check-bounces",
                body: this.recipients.map(r => r.email),
                decoder: new ArrayDecoder(EmailInformation as Decoder<EmailInformation>)
            })
            this.emailInformation = response.data
        } catch (e) {
            console.error(e)
        }
        this.checkingBounces = false
    }

    get hardBounces() {
        return this.emailInformation.filter(e => e.hardBounce).map(e => e.email)
    }

    get spamComplaints() {
        return this.emailInformation.filter(e => e.markedAsSpam).map(e => e.email)
    }

    get editor() {
        return this.editorView?.editor
    }

    get hasFirstName() {
        return !this.recipients.find(r => !r.replacements.find(r => r.token === "firstName" && r.value.length > 0))
    }

    mounted() {
        this.checkBounces().catch(e => {
            console.error(e)
        })

        if (this.hasFirstName) {
            // Insert "Dag <naam>," into editor
            this.editor.chain().setTextSelection(0).insertContent("Dag ").insertSmartVariable(this.smartVariables[0]).insertContent(",<p></p><p></p>")/*.focus()*/.run()
        }
    }

    getFileIcon(file: TmpFile) {
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

    changedFile(event) {
        if (!event.target.files || event.target.files.length == 0) {
            return;
        }

        for (const file of event.target.files as FileList) {
            const f = new TmpFile(file.name, file)
            this.files.push(f)

            if (f.file.name.endsWith(".docx") || f.file.name.endsWith(".xlsx") || f.file.name.endsWith(".doc") || f.file.name.endsWith(".xls")) {
                const error = "We raden af om Word of Excel bestanden door te sturen omdat veel mensen hun e-mails lezen op hun smartphone en die bestanden vaak niet (correct) kunnen openen. Sommige mensen hebben ook geen licentie voor Word/Excel, want dat is niet gratis. Zet de bestanden om in een PDF en stuur die door."
                new Toast(error, "warning yellow").setHide(30*1000).show()
            }
        }
        
        // Clear selection
        event.target.value = null;
    }

    openHardBounces() {
        const missing = this.hardBounces
        this.present(new ComponentWithProperties(MissingFirstNameView, {
            title: "Deze e-mailadressen zijn ongeldig",
            description: "Er werd eerder al een e-mail verstuurd naar deze e-mailadressen, maar die werd teruggestuurd. Dit komt voor als het e-mailadres ongeldig is of als de e-mailinbox van de afzender vol zit. Om de reputatie van jullie en onze e-mailadressen te beschermen, mogen we geen e-mails versturen naar deze e-mailadressen. Als je denkt dat er een fout in zit, neem dan contact met ons op via "+this.$t('shared.emails.general')+" om de blokkering op te heffen.",
            emails: missing.map((m) => {
                return {
                    email: m,
                    members: this.getEmailNames(m).join(", ")
                }
            })
        }).setDisplayStyle("popup"))
    }

    openSpamComplaints() {
        const missing = this.spamComplaints
        this.present(new ComponentWithProperties(MissingFirstNameView, {
            title: "Deze e-mailadressen hebben e-mails als spam gemarkeerd",
            description: "Er werd eerder al een e-mail verstuurd naar deze e-mailadressen, maar die werd door de ontvanger gemarkeerd als spam. Om de reputatie van jullie en onze e-mailadressen te beschermen, mogen we geen e-mails versturen naar deze e-mailadressen.",
            emails: missing.map((m) => {
                return {
                    email: m,
                    members: this.getEmailNames(m).join(", ")
                }
            })
        }).setDisplayStyle("popup"))
    }

    getEmailNames(email: string) {
        const names = new Set<string>()

        for (const recipient of this.otherRecipients) {
            if (recipient.email === email && recipient.firstName)  {
                names.add(recipient.firstName+" "+recipient.lastName)
                break;
            }
        }
        return [...names.values()]
    }

    // Unfiltered
    get allRecipients(): Map<string, Recipient> {
        const recipients: Map<string, Recipient> = new Map()

        console.log(this.otherRecipients)
      
        // TODO: need to validate the recplacements of other recipients
        for (const recipient of this.otherRecipients) {
            const email = recipient.email.toLowerCase()
            const existing = recipients.get(email)
            const r = recipient instanceof Recipient ? recipient : Recipient.create({
                firstName: recipient.firstName,
                email,
                replacements: [
                    Replacement.create({
                        token: "firstName",
                        value: recipient.firstName ?? ""
                    }),
                    Replacement.create({
                        token: "lastName",
                        value: recipient.lastName ?? ""
                    }),
                    Replacement.create({
                        token: "email",
                        value: email
                    })
                ],
                userId: existing?.userId ?? null,
            });

            if (existing) {
                existing.merge(r)
                continue
            }

            recipients.set(email, r)
        }

        return recipients
    }

    get recipients(): Recipient[] {
        const recipients: Map<string, Recipient> = new Map(this.allRecipients)

        // Filter

        return Array.from(recipients.values())
    }

    get emails() {
        return [
            new Email("hallo@stamhoofd.be", "Stamhoofd"),
            new Email("simon@stamhoofd.be", "Simon Backx"),
            new Email("hallo@stamhoofd.nl", "Stamhoofd"),
            new Email("simon@stamhoofd.nl", "Simon Backx")
        ]
    }

    get primaryColor() {
        return "#0053ff"
    }

    get primaryColorContrast() {
        return "#fff"
    }

    async getHTML() {
        const editor = this.editor
        if (!editor) {
            // When editor is not yet loaded: slow internet -> need to know html on dismiss confirmation
            return {
                text: "",
                html: ""
            }
        }

        const base: string = editor.getHTML();
        return await EmailStyler.format(base, this.subject)
    }

    existingWindow: Window | null

    async openPreview() {
        if (this.existingWindow) {
            // Disable reuse in some browsers
            this.existingWindow.close()
        }
        const newWindow = window.open("", "Voorbeeld"+Math.floor(Math.random()*9999999), "width=650,height=800,menubar=no,toolbar=no,location=no,resizable=yes");
        if (!newWindow) {
            return
        }
        var sY = screenY;
        if (sY < 0) {
            sY = 0;
        }
        var totalScreenWidth = (screenX + window.outerWidth + sY);
        if (totalScreenWidth > screen.width) {
            totalScreenWidth = totalScreenWidth / 2;
        } else {
            totalScreenWidth = 0;
        }
        let { html } = await this.getHTML()
        let subject = this.subject


        // Replacements
        const recipient = this.recipients[0]
        if (recipient) {
            for (const replacement of recipient.replacements) {
                if (html) {
                    html = html.replaceAll("{{"+replacement.token+"}}", replacement.html ?? Formatter.escapeHtml(replacement.value))
                }
                subject = subject.replaceAll("{{"+replacement.token+"}}", replacement.value)
            }
        }

        // Include recipients
        const recipients = this.recipients.map(r => r.email).join(", ")
        html = html.replace("<body>", "<body><p><strong>Aan (elk afzonderlijke e-mail):</strong> "+recipients+"</p><p><strong>Onderwerp:</strong> "+subject+"</p><p><strong>Voorbeeld voor:</strong> "+encodeURI(recipient.email)+"</p><hr>")

        newWindow.document.write(html);

        this.existingWindow = newWindow
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
            const {text, html} = await this.getHTML()

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

            await AdminSession.shared.authenticatedServer.request({
                method: "POST",
                path: "/email",
                body: emailRequest,
            })
            this.dismiss({ force: true })
            new Toast("Jouw e-mail is verstuurd", "success").show()

            // Mark review moment
            AppManager.shared.markReviewMoment(this.$context)
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.sending = false
    }

    async shouldNavigateAway() {
        if ((await this.getHTML()).text.length <= "Dag {{firstName}},".length + 2 && this.subject.length < 2) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder te versturen?", "Niet versturen")
    }
}
</script>

<style lang="scss">

.mail-view {
    .mail-hr {
        margin: 0;
        margin-right: calc(-1 * var(--st-horizontal-padding, 40px));
    }

    #message-title {
        padding-bottom: 0;
    }

    
    .file-list-item {
        .middle {
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;

            > h3 {
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }
        }
    }
    
}
</style>
