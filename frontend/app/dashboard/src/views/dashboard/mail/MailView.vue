<template>
    <div class="st-view mail-view">
        <STNavigationBar title="E-mail versturen">
            <template #right>
                <button class="button icon close gray" @click="dismiss" />
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            <span class="icon-spacer">E-mail versturen</span>
        </STNavigationTitle>

        <main>
            <template v-if="emails.length == 0">
                <p v-if="fullAccess" class="warning-box selectable with-button" @click="manageEmails">
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

            <p v-if="fileWarning" class="warning-box">
                We raden af om Word of Excel bestanden door te sturen omdat veel mensen hun e-mails lezen op hun smartphone en die bestanden vaak niet (correct) kunnen openen. Sommige mensen hebben ook geen licentie op Word/Excel, want dat is niet gratis. Zet de bestanden om in een PDF en stuur die door.
            </p>

            <p v-if="!hasFirstName" class="warning-box warning-box selectable with-button" @click="showMissingFirstNames">
                Niet elk e-mailadres heeft een gekoppelde naam (komt voor als een gebruiker zijn e-mailadres heeft gewijzigd zonder bijhorende lid of ouder aan te passen). Pas aan indien nodig. Daarom dat we geen automatische aanspreking kunnen genereren.
                <span class="button text inherit-color">
                    Toon
                </span>
            </p>

            <STInputBox id="message-title" title="Bericht" error-fields="message" :error-box="errorBox" class="max">
                <label slot="right" class="button text">
                    <span class="icon add" />
                    <span>Bijlage</span>
                    <input type="file" multiple="multiple" style="display: none;" accept=".pdf, .docx, .xlsx, .png, .jpeg, .jpg, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf, image/jpeg, image/png, image/gif" @change="changedFile">
                </label>
            </STInputBox>
            
            <MailEditor ref="editor" :has-first-name="hasFirstName">
                <div v-if="addButton" slot="footer" ref="footerButton" class="disabled" title="Knop voor inschrijvingen">
                    <hr>
                    <p><a class="button primary" :href="'{{signInUrl}}'">Inschrijvingen beheren</a></p>
                    <p class="style-description-small button-description">
                        <em>Klik op de knop hierboven om jouw gegevens te wijzigen of om je in te schrijven. Belangrijk! Log altijd in met <strong><span class="replace-placeholder" data-replace-type="email">linda.voorbeeld@gmail.com</span></strong>. Anders heb je geen toegang tot jouw gegevens.</em>
                    </p>
                </div>
                <template v-if="files.length > 0" slot="footer">
                    <hr>
                    <STList>
                        <STListItem v-for="(file, index) in files" :key="index" class="file-list-item right-description right-stack">
                            <span slot="left" class="icon file" />
                            {{ file.name }}

                            <template #right>
                                <span>{{ file.size }}</span>
                                <span><button class="button icon gray trash" @click.stop="deleteAttachment(index)" /></span>
                            </template>
                        </STListItem>
                    </STList>
                </template>
            </MailEditor>

            <Checkbox v-if="members.length > 0 && hasMinors" v-model="includeMinorMembers">
                E-mail ook naar minderjarige leden<template v-if="hasUnknownAge">
                    (of leden met onbekende leeftijd)
                </template> zelf sturen
            </Checkbox>

            <Checkbox v-if="members.length > 0 && hasGrownUpParents" v-model="includeGrownUpParents">
                E-mail ook naar ouders van 18+ leden<template v-if="hasUnknownAge">
                    (of leden met onbekende leeftijd)
                </template> sturen
            </Checkbox>

            <Checkbox v-if="members.length > 0" v-model="addButton" :disabled="!hasAllUsers">
                <h3 class="style-title-list">
                    Voeg magische inlogknop toe (aangeraden)
                </h3>
                <span v-if="addButton" class="radio-description">Als een lid op de knop duwt wordt hij automatisch door het proces geloodst om in te loggen of te registreren zodat hij aan de gegevens kan die al in het systeem zitten. De tekst die getoond wordt is maar als voorbeeld en verschilt per persoon waar je naartoe verstuurt.</span>
            </Checkbox>
            <p v-if="!hasAllUsers && members.length > 0" class="style-description-small">
                Niet elke ontvanger heeft toegang tot de gegevens van de leden. Daarom kan je de knop niet toevoegen.
            </p>
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
                <button class="button secundary" @click="openPreview">
                    Voorbeeld
                </button>
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
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox,ErrorBox, LoadingButton, STInputBox, STList, STListItem, STNavigationTitle, Toast } from "@stamhoofd/components";
import { STToolbar } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { SegmentedControl } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { EmailAttachment,EmailRequest, Group, MemberWithRegistrations, Recipient, Replacement } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop, Watch } from "vue-property-decorator";

import { MemberManager } from '../../../classes/MemberManager';
import { OrganizationManager } from '../../../classes/OrganizationManager';
import EmailSettingsView from '../settings/EmailSettingsView.vue';
import { EmailStyler } from './EmailStyler';
import MissingFirstNameView from './MissingFirstNameView.vue';

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
        Checkbox,
        MailEditor: () => import(/* webpackChunkName: "MailEditor" */ './MailEditor.vue'),
    },
})
export default class MailView extends Mixins(NavigationMixin) {
    @Prop({ default: () => []})
    members!: MemberWithRegistrations[];

    @Prop({ default: () => []})
    otherRecipients: { firstName?: string; lastName?: string; email: string }[]

    sending = false

    addButton = this.members.length > 0 && this.hasAllUsers

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

    includeGrownUpParents = false
    includeMinorMembers = false

    deleteAttachment(index) {
        this.files.splice(index, 1)
    }

    get hasUnknownAge() {
        return !!this.members.find(m => m.details.age === null)
    }

    get hasMinors() {
        return !!this.members.find(m => (!m.details.age || m.details.age < 18) && !!m.details.email)
    }

    get hasGrownUpParents() {
        return !!this.members.find(m => (!m.details.age || m.details.age >= 18) && !!m.details.parents.find(p => p.email))
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

    mounted() {
        if (this.members.length > 0) {
            // Check if all the parents + members already have access (and an account) when they should have access
            MemberManager.updateMembersAccess(this.members).then(() => {
                // We created some users, so we might check the button again
                if (!this.addButton && this.hasAllUsers) {
                    this.addButton = true
                }
            }).catch(e => {
                Toast.fromError(e).show()
            })
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

    showMissingFirstNames() {
        const missing = this.recipients.filter(r => r.firstName == null)
        this.present(new ComponentWithProperties(MissingFirstNameView, {
            title: "Ontbrekende namen",
            description: "Voor deze e-mailadressen konden we geen voornaam terugvinden. Kijk na of ze wel aanwezig zijn als ouder of lid in het systeem. Meestal komt dit voor omdat ze puur als gebruiker gekoppeld zijn, en die hebben geen namen. Om dit op te lossen kan je ofwel het e-mailadres wijzigen of het e-maialdres toevoegen bij één van de ouders of het lid zelf.",
            emails: missing.map((m) => {
                return {
                    email: m.email,
                    members: this.getEmailMemberNames(m.email).join(", ")
                }
            })
        }).setDisplayStyle("popup"))
    }

    get hasAllUsers() {
        return !this.recipients.find(r => r.userId === null)
    }

    @Watch('hasAllUsers')
    onUpdateHasAllUsers(hasAllUsers: boolean) {
        if (!hasAllUsers) {
            this.addButton = false
        }
    }

    getEmailMemberNames(email: string) {
        const names = new Set<string>()

        for (const member of this.members) {
            if (member.details.email === email) {
                names.add(member.name)
                continue;
            }

            for (const parent of member.details.parents) {
                if (parent.email === email) {
                    names.add(member.name)
                    break;
                }
            }

            for (const user of member.users) {
                if (user.email === email) {
                    names.add(member.name)
                    break;
                }
            }
        }
        return [...names.values()]
    }

    get recipients(): Recipient[] {
        const recipients: Map<string, Recipient> = new Map()

        for (const member of this.members) {
            if (!member.details) {
                continue
            }

            if ((member.details.age !== null && member.details.age < 18) || this.includeGrownUpParents) {
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
                            }),
                            Replacement.create({
                                token: "email",
                                value: parent.email
                            })
                        ]
                    }))
                }
            }

            for (const user of member.users) {
                if (!user.email) {
                    continue;
                }

                if (recipients.has(user.email)) {
                    // Link user
                    const recipient = recipients.get(user.email)!
                    recipient.userId = user.id
                    continue
                }
                // todo: skip parents and member if needed

                recipients.set(user.email, Recipient.create({
                    firstName: user.firstName,
                    email: user.email,
                    replacements: [
                        Replacement.create({
                            token: "firstName",
                            value: user.firstName ?? ""
                        }),
                        Replacement.create({
                            token: "email",
                            value: user.email ?? ""
                        })
                    ],
                    // Create sign-in replacement 'signInUrl'
                    userId: user.id
                }))
            }

            if (!member.details.email) {
                continue;
            }

            if (!this.includeMinorMembers && (member.details.age == null || member.details.age < 18)) {
                // remove member if it was included
                recipients.delete(member.details.email)
                continue;
            }

            if (recipients.has(member.details.email) && recipients.get(member.details.email)!.firstName) {
                continue
            }

            const existing = recipients.get(member.details.email)
            recipients.set(member.details.email, Recipient.create({
                firstName: member.details.firstName,
                email: member.details.email,
                replacements: [
                    Replacement.create({
                        token: "firstName",
                        value: member.details.firstName
                    }),
                    Replacement.create({
                        token: "email",
                        value: member.details.email
                    })
                ],
                userId: existing?.userId ?? null
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
        this.present(new ComponentWithProperties(NavigationController, { root : new ComponentWithProperties(EmailSettingsView)}).setDisplayStyle("popup"))
    }

    async getHTML(withButton: boolean | null = null) {
        let base = (this.$refs.editor as any).editor!.getHTML();

        // Append footer HTML if needed
        if ((withButton ?? this.addButton) && this.$refs.footerButton) {
            base += (this.$refs.footerButton as Element).innerHTML;
        }
        
        return await EmailStyler.format(base, this.subject, OrganizationManager.organization)
    }

    existingWindow: Window | null

    async openPreview() {
        if (this.existingWindow) {
            // Disable reuse in some browsers
            this.existingWindow.close()
        }
        const newWindow = window.open("", "Voorbeeld"+Math.floor(Math.random()*9999999), "width=800,height=800,menubar=no,toolbar=no,location=no,resizable=yes");
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

        // Replacements
        const recipient = this.recipients[0]
        if (recipient) {
            for (const replacement of recipient.replacements) {
                if (html) {
                    html = html.replace("{{"+replacement.token+"}}", replacement.value)
                }
            }
        }

        // Include recipients
        const recipients = this.recipients.map(r => r.email).join(", ")
        html = html.replace("<body>", "<body><p><strong>Aan (elk afzonderlijke e-mail):</strong> "+recipients+"</p><p><strong>Voorbeeld voor:</strong> "+encodeURI(recipient.email)+"</p><hr>")

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

            await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/email",
                body: emailRequest,
            })
            this.dismiss({ force: true })
            new Toast("Jouw e-mail is verstuurd", "success").show()
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.sending = false
    }

    async shouldNavigateAway() {
        if ((await this.getHTML(false)).text.length <= "Dag {{firstName}},".length + 2 && this.subject.length < 2) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder te versturen?", "Niet versturen")
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

            & > .editor-container {
                flex-grow: 1;
                display: flex;
                flex-direction: column;

                & > .editor-content {
                    flex-grow: 1;
                    display: flex;
                    flex-direction: column;

                    & > .ProseMirror {
                        flex-grow: 1;
                    }
                }
            }

            + * {
                margin-top: 10px;
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
