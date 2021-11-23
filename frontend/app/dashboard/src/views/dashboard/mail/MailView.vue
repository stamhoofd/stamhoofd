<template>
    <div class="st-view mail-view">
        <STNavigationBar title="E-mail versturen">
            <template #right>
                <button class="button icon close gray" @click="dismiss" />
            </template>
        </STNavigationBar>

        <main>
            <h1>
                E-mail versturen
            </h1>

            <STErrorsDefault :error-box="errorBox" />

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
                    <Dropdown v-model="emailId">
                        <option v-for="email in emails" :key="email.id" :value="email.id">
                            {{ email.name ? (email.name+" <"+email.email+">") : email.email }}
                        </option>
                    </Dropdown>
                </STInputBox>
            </div>

            <p v-if="fileWarning" class="warning-box">
                We raden af om Word of Excel bestanden door te sturen omdat veel mensen hun e-mails lezen op hun smartphone en die bestanden vaak niet (correct) kunnen openen. Sommige mensen hebben ook geen licentie voor Word/Excel, want dat is niet gratis. Zet de bestanden om in een PDF en stuur die door.
            </p>

            <STInputBox id="message-title" title="Bericht" error-fields="message" :error-box="errorBox" class="max">
                <label slot="right" class="button text">
                    <span class="icon add" />
                    <span>Bijlage</span>
                    <input type="file" multiple="multiple" style="display: none;" accept=".pdf, .docx, .xlsx, .png, .jpeg, .jpg, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf, image/jpeg, image/png, image/gif" @change="changedFile">
                </label>
            </STInputBox>
            
            <MailEditor ref="editor" :has-first-name="hasFirstName">
                <div v-if="addButton && orders.length == 0" slot="footer" ref="footerButton" class="disabled" title="Knop voor inschrijvingen">
                    <hr>
                    <p><a class="button primary" :href="'{{signInUrl}}'">Inschrijvingen beheren</a></p>
                    <p class="style-description-small button-description">
                        <em>Klik op de knop hierboven om jouw gegevens te wijzigen of om je in te schrijven. Belangrijk! Log altijd in met <strong><span class="replace-placeholder" data-replace-type="email">linda.voorbeeld@gmail.com</span></strong>. Anders heb je geen toegang tot jouw gegevens.</em>
                    </p>
                </div>
                <div v-if="addButton && orders.length > 0 && webshop" slot="footer" ref="footerButton" class="disabled" title="Knop voor inschrijvingen">
                    <hr>
                    <p><a class="button primary" :href="'{{orderUrl}}'">{{ orderButtonText }}</a></p>
                    <p class="style-description-small button-description">
                        <em>Via de bovenstaande knop kan je jouw bestelling bekijken.</em>
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
                <p v-if="addButton" class="style-description-small">
                    Als een lid op de knop duwt, wordt hij automatisch door het proces geloodst om in te loggen of te registreren zodat hij aan de gegevens kan die al in het systeem zitten. De tekst die getoond wordt is maar als voorbeeld en verschilt per persoon waar je naartoe verstuurt.
                </p>
            </Checkbox>
            <p v-if="!hasAllUsers && members.length > 0" class="style-description-small">
                Niet elke ontvanger heeft toegang tot de gegevens van de leden. Daarom kan je de knop niet toevoegen.
            </p>

            <Checkbox v-if="orders.length > 0 && webshop" v-model="addButton">
                <h3 v-if="webshop.meta.ticketType == 'None'" class="style-title-list">
                    Voeg knop naar bestelling toe
                </h3>
                <h3 v-else class="style-title-list">
                    Voeg knop naar tickets en bestelling toe
                </h3>
                <p v-if="addButton" class="style-description-small">
                    <template v-if="webshop.meta.ticketType == 'None'">
                        Daar staan ook de betaalinstructies indien de bestelling nog niet betaald werd.
                    </template>
                    <template v-else>
                        Als de tickets nog niet betaald werden, zal de knop enkel naar de bestelling wijzen (met daar de betaalinstructies).
                    </template>
                </p>
            </Checkbox>

            <p v-if="hardBounces.length > 0" class="warning-box warning-box selectable with-button limit-height" @click="openHardBounces">
                {{ hardBounces.length != 1 ? hardBounces.length+' e-mailadressen zijn' : 'Eén e-mailadres is' }} ongeldig. Deze worden uitgesloten.
                <span class="button text inherit-color">
                    Toon
                </span>
            </p>

            <p v-if="spamComplaints.length > 0" class="warning-box warning-box selectable with-button limit-height" @click="openSpamComplaints">
                {{ spamComplaints.length != 1 ? spamComplaints.length +' e-mailadressen hebben' : 'Eén e-mailadres heeft' }} eerdere e-mails als spam gemarkeerd. Deze worden uitgesloten.
                <span class="button text inherit-color">
                    Toon
                </span>
            </p>

            <p v-if="!hasFirstName" class="warning-box warning-box selectable with-button limit-height" @click="showMissingFirstNames">
                Niet elk e-mailadres heeft een gekoppelde naam
                <span class="button text inherit-color">
                    Toon
                </span>
            </p>
            <p v-if="webshop" class="info-box" v-text="'Gebruik slimme vervangingen in jouw tekst: {{nr}} wordt automatisch vervangen door het bestelnummer van de klant. Test het uit en klik op \'Voorbeeld\'.'" />
        </main>

        <STToolbar :sticky="false">
            <template #right>
                <button class="button secundary" @click="openPreview">
                    <span class="icon eye" />
                    <span>Voorbeeld</span>
                </button>
                <LoadingButton :loading="sending">
                    <button class="button primary" :disabled="recipients.length == 0 || emails.length == 0" @click="send">
                        <span>Versturen</span>
                        <span class="bubble">{{ recipients.length }}</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox,Dropdown,ErrorBox, LoadingButton, STErrorsDefault, STInputBox, STList, STListItem, STNavigationTitle, Toast } from "@stamhoofd/components";
import { STToolbar } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { SegmentedControl } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { EmailAttachment,EmailInformation,EmailRequest, Group, MemberWithRegistrations, PrivateOrder, Recipient, Replacement, WebshopPreview, WebshopTicketType } from '@stamhoofd/structures';
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
        Dropdown,
        STErrorsDefault,
        MailEditor: () => import(/* webpackChunkName: "MailEditor" */ './MailEditor.vue'),
    },
})
export default class MailView extends Mixins(NavigationMixin) {
    @Prop({ default: () => []})
    members!: MemberWithRegistrations[];

    @Prop({ default: () => []})
    orders!: PrivateOrder[];

    @Prop({ default: null})
    webshop!: WebshopPreview | null

    @Prop({ default: () => []})
    otherRecipients: { firstName?: string; lastName?: string; email: string }[]

    sending = false

    addButton = (this.orders.length > 0 && this.webshop) || (this.members.length > 0 && this.hasAllUsers)

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

    checkingBounces = false
    emailInformation: EmailInformation[] = []

    deleteAttachment(index) {
        this.files.splice(index, 1)
    }

    async checkBounces() {
        if (this.checkingBounces) {
            return
        }
        this.checkingBounces = true

        try {
            const response = await SessionManager.currentSession!.authenticatedServer.request({
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

    get hasUnknownAge() {
        return !!this.members.find(m => m.details.age === null)
    }

    get hasMinors() {
        return !![...this.allRecipients.values()].find(r => r.type === "minor")
    }

    get hasGrownUpParents() {
        return !![...this.allRecipients.values()].find(r => r.type === "grownUpParent")
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

    get orderButtonType() {
        for (const order of this.orders) {
            if (order.payment?.paidAt !== null) {
                if (!this.webshop || this.webshop.meta.ticketType === WebshopTicketType.None) {
                    return "order"
                }
                return "tickets"
            }
        }
        return "payment"
    }

    get orderButtonText() {
        if (this.orderButtonType === "payment") {
            return "Betaalinstructies"
        }
        if (this.orderButtonType === "tickets") {
            return "Tickets bekijken"
        }
        return "Bestelling bekijken"
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

        this.checkBounces().catch(e => {
            console.error(e)
        })
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

    openHardBounces() {
        const missing = this.hardBounces
        this.present(new ComponentWithProperties(MissingFirstNameView, {
            title: "Deze e-mailadressen zijn ongeldig",
            description: "Er werd eerder al een e-mail verstuurd naar deze e-mailadressen, maar die werd teruggestuurd. Dit komt voor als het e-mailadres ongeldig is of als de e-mailinbox van de afzender vol zit. Om de reputatie van jullie en onze e-mailadressen te beschermen, mogen we geen e-mails versturen naar deze e-mailadressen. Als je denkt dat er een fout in zit, neem dan contact met ons op via "+this.$t('shared.emails.general')+" om de blokkering op te heffen.",
            emails: missing.map((m) => {
                return {
                    email: m,
                    members: this.getEmailMemberNames(m).join(", ")
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
                    members: this.getEmailMemberNames(m).join(", ")
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

    // Unfiltered
    get allRecipients(): Map<string, Recipient> {
        const recipients: Map<string, Recipient> = new Map()

        if (this.webshop) {
            for (const order of this.orders) {
                if (order.data.customer.email.length > 0) {
                    const email = order.data.customer.email.toLowerCase()

                    // Send one e-mail for every order
                    const id = "order-"+order.id

                    const existing = recipients.get(id)

                    if (existing) {
                        if (!existing.firstName && order.data.customer.firstName) {
                            existing.firstName = order.data.customer.firstName
                        }
                        continue
                    }

                    recipients.set(id, Recipient.create({
                        firstName: order.data.customer.firstName,
                        lastName: order.data.customer.lastName,
                        email,
                        replacements: [
                            Replacement.create({
                                token: "firstName",
                                value: order.data.customer.firstName ?? ""
                            }),
                            Replacement.create({
                                token: "email",
                                value: email
                            }),
                            Replacement.create({
                                token: "orderUrl",
                                value: "https://"+this.webshop.getUrl(OrganizationManager.organization)+"/order/"+(order.id)
                            }),
                            Replacement.create({
                                token: "nr",
                                value: (order.number ?? "")+""
                            })
                        ]
                    }))

                }
            }
        }
        

        for (const member of this.members) {
            const isMinor = (member.details.age == null || member.details.age < 18 || (member.details.age < 24 && !member.details.address && !member.details.email))

            for (const user of member.users) {
                if (!user.email) {
                    continue;
                }

                const email = user.email.toLowerCase()
                const existing = recipients.get(email)

                if (existing) {
                    // Link user
                    existing.userId = user.id

                    if (!existing.firstName && user.firstName) {
                        existing.firstName = user.firstName
                    }
                    continue
                }

                recipients.set(email, Recipient.create({
                    firstName: user.firstName,
                    email,
                    replacements: [
                        Replacement.create({
                            token: "firstName",
                            value: user.firstName ?? ""
                        }),
                        Replacement.create({
                            token: "email",
                            value: email
                        })
                    ],
                    // Create sign-in replacement 'signInUrl'
                    userId: user.id,
                    type: "user"
                }))
            }
        
            for (const parent of member.details.parents) {
                if (!parent.email) {
                    continue;
                }

                const existing = recipients.get(parent.email.toLowerCase())
                let type = isMinor ? 'minorParent' : 'grownUpParent'

                if (existing && existing.type === "minorParent") {
                    // If this was a minor parent, keep it as a minor parent
                    type = "minorParent"
                }

                if (existing && existing.firstName) {
                    // Mark this e-mail for deletion

                    if (existing.type === "user" || (type == "minorParent" && existing.type == "grownUpParent")) {
                        existing.type = type
                    }
                    continue
                }

                recipients.set(parent.email.toLowerCase(), Recipient.create({
                    firstName: parent.firstName,
                    email: parent.email.toLowerCase(),
                    replacements: [
                        Replacement.create({
                            token: "firstName",
                            value: parent.firstName
                        }),
                        Replacement.create({
                            token: "email",
                            value: parent.email.toLowerCase()
                        })
                    ],
                    userId: existing?.userId,
                    type
                }))
            }

            if (member.details.email) {
                // Create a loop for convenience (to allow break/contniue)
                for (const email of [member.details.email.toLowerCase()]) {
                    const existing = recipients.get(email)
                    const type = isMinor ? 'minor' : 'grownUp'
                    if (existing && existing.firstName) {
                        if (existing.type !== "user" && isMinor) {
                            // This is a duplicate email address that was also added to the member.
                            // Keep this as a parent email address
                            continue
                        }

                        // Mark this e-mail as a member's one
                        existing.type = type

                        continue
                    }
                    recipients.set(
                        email, 
                        Recipient.create({
                            firstName: member.details.firstName,
                            email,
                            replacements: [
                                Replacement.create({
                                    token: "firstName",
                                    value: member.details.firstName
                                }),
                                Replacement.create({
                                    token: "email",
                                    value: email
                                })
                            ],
                            userId: existing?.userId ?? null,
                            type
                    }))
                }
            }
        }
      
        for (const recipient of this.otherRecipients) {
            const email = recipient.email.toLowerCase()
            const existing = recipients.get(email)

            if (existing && existing.firstName) {
                continue
            }

            recipients.set(email, Recipient.create({
                firstName: recipient.firstName,
                email,
                replacements: [
                    Replacement.create({
                        token: "firstName",
                        value: recipient.firstName ?? ""
                    }),
                    Replacement.create({
                        token: "email",
                        value: email
                    })
                ],
                userId: existing?.userId ?? null,
                type: existing?.type ?? null
            }))
        }

        return recipients
    }

    get recipients(): Recipient[] {
        const recipients: Map<string, Recipient> = new Map(this.allRecipients)

        // Only at the end, remove minor / parents
        if (!this.includeGrownUpParents) {
            // Remove parents
            for (const [email, recipient] of recipients) {
                if (recipient.type == "grownUpParent") {
                    recipients.delete(email)
                }
            }
        }

        if (!this.includeMinorMembers) {
            // Remove minor members
            for (const [email, recipient] of recipients) {
                if (recipient.type == "minor") {
                    recipients.delete(email)
                }
            }
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
        let subject = this.subject


        // Replacements
        const recipient = this.recipients[0]
        if (recipient) {
            for (const replacement of recipient.replacements) {
                if (html) {
                    html = html.replaceAll("{{"+replacement.token+"}}", replacement.value)
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
