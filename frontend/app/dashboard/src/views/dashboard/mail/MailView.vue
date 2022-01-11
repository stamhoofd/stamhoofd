<template>
    <EditorView ref="editorView" class="mail-view" title="Nieuwe e-mail" save-text="Versturen" :smart-variables="smartVariables" :smart-buttons="smartButtons" :style="{'--editor-primary-color': primaryColor}" @save="send">
        <h1 class="style-navigation-title">
            Nieuwe e-mail
        </h1>

        <STErrorsDefault :error-box="errorBox" />

        <!-- Buttons -->
        <template slot="buttons">
            <label v-tooltip="'Bijlage toevoegen'" class="button icon attachment">
                <input type="file" multiple="multiple" style="display: none;" accept=".pdf, .docx, .xlsx, .png, .jpeg, .jpg, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf, image/jpeg, image/png, image/gif" @change="changedFile">
                <span v-if="$isMobile && files.length > 0" class="style-bubble">{{ files.length }}</span>
            </label>
            <hr v-if="!$isMobile">
            <button v-if="!$isMobile" v-tooltip="'Voorbeeld tonen'" class="button icon eye" type="button" @click="openPreview" />
        </template>

        <!-- List -->
        <template slot="list">
            <STListItem v-if="members.length > 0" class="no-padding right-stack">
                <div class="list-input-box">
                    <span>Aan:</span>

                    <button class="list-input dropdown" type="button" @click="showToMenu">
                        <span>{{ memberFilterDescription }}</span>
                        <span class="icon arrow-down-small gray" />
                    </button>
                </div>
                <span slot="right" class="style-description-small">{{ recipients.length }}</span>
                <button v-if="hasToWarnings" slot="right" class="button icon warning yellow" type="button" @click="showToWarnings" />
            </STListItem>
            <STListItem v-else-if="orders.length > 0" class="no-padding right-stack">
                <div class="list-input-box">
                    <span>Aan:</span>
                    <span class="list-input">{{ recipients.length == 1 ? recipients[0].firstName+" "+recipients[0].lastName : recipients.length +" ontvangers" }}</span>
                </div>
                <button v-if="hasToWarnings" slot="right" class="button icon warning yellow" type="button" @click="showToWarnings" />
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
                        <select v-model="emailId" class="list-input">
                            <option v-for="email in emails" :key="email.id" :value="email.id">
                                {{ email.name ? (email.name+" <"+email.email+">") : email.email }}
                            </option>
                        </select>
                    </div>
                </div>

                <button v-if="fullAccess" slot="right" class="button text" type="button" @click="manageEmails">
                    <span class="icon settings" />
                </button>
            </STListItem>
        </template>

        <!-- Editor footer -->
        <template slot="footer">
            <!-- E-mail attachments -->
            <STList v-if="files.length > 0">
                <STListItem v-for="(file, index) in files" :key="index" class="file-list-item">
                    <span slot="left" :class="'icon '+getFileIcon(file)" />
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
    </EditorView>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, ContextMenu, ContextMenuItem, Dropdown, EditorSmartButton, EditorSmartVariable, EditorView, EmailStyler,ErrorBox, STErrorsDefault, STInputBox, STList, STListItem, Toast, ToastButton, TooltipDirective } from "@stamhoofd/components";
import { AppManager, SessionManager } from '@stamhoofd/networking';
import { EmailAttachment, EmailInformation, EmailRequest, Group, MemberWithRegistrations, OrderStatusHelper, PaymentMethod, PaymentMethodHelper, PaymentStatus, PrivateOrder, Recipient, Replacement, WebshopPreview, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop, Watch } from "vue-property-decorator";

import { MemberManager } from '../../../classes/MemberManager';
import { OrganizationManager } from '../../../classes/OrganizationManager';
import EmailSettingsView from '../settings/EmailSettingsView.vue';
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

enum MemberFilter {
    All = "all",
    Adults = "Adults",
    None = "none"
}

enum ParentFilter {
    All = "all",
    Minors = "Minors",
    None = "none"
}

enum UserFilter {
    All = "all",
    Existing = "Existing",
    None = "none"
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

    checkingBounces = false
    emailInformation: EmailInformation[] = []

    memberFilter = MemberFilter.Adults
    parentFilter = ParentFilter.Minors
    userFilter = UserFilter.All

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
                id: "email", 
                name: "E-mailadres", 
                example: "", 
            })
        ]

        if (this.orders.length > 0) {
            variables.push(new EditorSmartVariable({
                id: "nr", 
                name: "Bestelnummer", 
                example: "", 
            }))

            variables.push(new EditorSmartVariable({
                id: "orderPrice", 
                name: "Bestelbedrag", 
                example: "", 
            }))

            variables.push(new EditorSmartVariable({
                id: "orderStatus", 
                name: "Bestelstatus", 
                example: "", 
            }))

            variables.push(new EditorSmartVariable({
                id: "paymentMethod", 
                name: "Betaalmethode", 
                example: "", 
            }))

            variables.push(new EditorSmartVariable({
                id: "orderPriceToPay", 
                name: "Te betalen bedrag", 
                example: "", 
            }))

            variables.push(new EditorSmartVariable({
                id: "transferDescription", 
                name: "Mededeling (overschrijving)", 
                example: "", 
            }))

            variables.push(new EditorSmartVariable({
                id: "transferBankAccount", 
                name: "Rekeningnummer (overschrijving)", 
                example: "", 
            }))

            variables.push(new EditorSmartVariable({
                id: "transferBankCreditor", 
                name: "Begunstigde (overschrijving)", 
                example: "", 
            }))

            variables.push(new EditorSmartVariable({
                id: "orderTable", 
                name: "Tabel met bestelling", 
                example: "order table", 
                html: ""
            }))
        }

        // Remove all smart variables that are not set in the recipients
        return variables.filter(variable => {
            for (const recipient of this.recipients) {
                const replacement = recipient.replacements.find(r => r.token === variable.id && (r.value.length > 0 || r.html !== undefined))
                if (!replacement) {
                    // Not found
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
        if (this.hasAllUsers && this.members.length > 0) {
            buttons.push(new EditorSmartButton({
                id: "signInUrl",
                name: "Inlog-knop",
                text: "Inschrijvingen beheren",
                hint: "Als gebruikers op deze knop klikken, zorgt het systeem ervoor dat ze inloggen of registreren op het juiste e-mailadres dat al in het systeem zit."
            }))
        }

        if (this.orders.length > 0) {
            buttons.push(new EditorSmartButton({
                id: "orderUrl",
                name: "Bestelling-knop",
                text: this.orderButtonText,
                hint: "Deze knop gaat naar het besteloverzicht, met alle informatie van de bestellingen en eventueel betalingsinstructies."
            }))
        }

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

    getMemberFilter(filter: MemberFilter, none = true): string | undefined {
        switch (filter) {
            case MemberFilter.All:
                return "alle leden"
            case MemberFilter.Adults:
                return "alleen volwassen leden"
            case MemberFilter.None:
                if (none) {
                    return "geen leden"
                }
                break
        }
    }

    getParentFilter(filter: ParentFilter, none = true): string | undefined {
        switch (filter) {
            case ParentFilter.All:
                return "alle ouders"
            case ParentFilter.None:
                if (none) {
                    return "geen ouders"
                }
                break
            case ParentFilter.Minors:
                return "ouders van minderjarige leden"
        }
    }

    getUserFilter(filter: UserFilter, none = true): string | undefined {
        switch (filter) {
            case UserFilter.All:
                return "alle accounts"
            case UserFilter.Existing:
                return "bestaande accounts"
            case UserFilter.None:
                if (none) {
                    return "geen accounts"
                }
                break
        }
    }

    get hasToWarnings() {
        return this.hardBounces.length > 0 || this.spamComplaints.length > 0 || !this.hasFirstName
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
            new Toast((this.hardBounces.length != 1 ? this.hardBounces.length+' e-mailadressen hebben' : 'Eén e-mailadres heeft')+" eerdere e-mails als spam gemarkeerd. Deze worden uitgesloten.", "warning yellow")
                .setButton(new ToastButton("Toon", () => {
                    this.openSpamComplaints()
                }))
                .setHide(10*1000)
                .show()
        }
        if (!this.hasFirstName) {
            new Toast("Bij niet elk e-mailadres staat er een voornaam in het systeem. Daarom kan je geen automatische begroeting toevoegen in de e-mail.", "warning yellow")
                .setButton(new ToastButton("Toon", () => {
                    this.showMissingFirstNames()
                }))
                .setHide(10*1000)
                .show()
        }
    }

    get memberFilterDescription() {
        const list: string[] = []

        const mFilter = this.getMemberFilter(this.memberFilter, false)
        if (mFilter) {
            list.push(mFilter)
        }

        const pFilter = this.getParentFilter(this.parentFilter, false)
        if (pFilter) {
            list.push(pFilter)
        }

        const uFilter = this.getUserFilter(this.userFilter, false)
        if (uFilter) {
            list.push(uFilter)
        }

        if (list.length == 0) {
            return "Geen ontvangers"
        }

        list[0] = Formatter.capitalizeFirstLetter(list[0])
        return Formatter.joinLast(list, ", ", " en ")
    }

    deleteAttachment(index: number) {
        this.files.splice(index, 1)
    }

    showToMenu(event) {
        const m = this
        const menu = new ContextMenu([
            [
                new ContextMenuItem({
                    name: Formatter.capitalizeFirstLetter(this.getMemberFilter(this.memberFilter)!),
                    childMenu: new ContextMenu([
                        Object.values(MemberFilter).map(filter => 
                            new ContextMenuItem({
                                name: Formatter.capitalizeFirstLetter(this.getMemberFilter(filter)!),
                                selected: filter === this.memberFilter,
                                action() {
                                    this.selected = true
                                    if (this.selected) {
                                        m.memberFilter = filter
                                    }
                                    return false
                                }
                            })
                        ),
                    ])
                }),
                new ContextMenuItem({
                    name: Formatter.capitalizeFirstLetter(this.getParentFilter(this.parentFilter)!),
                    childMenu: new ContextMenu([
                        Object.values(ParentFilter).map(filter => 
                            new ContextMenuItem({
                                name: Formatter.capitalizeFirstLetter(this.getParentFilter(filter)!),
                                selected: filter === this.parentFilter,
                                action() {
                                    this.selected = true
                                    if (this.selected) {
                                        m.parentFilter = filter
                                    }
                                    return false
                                }
                            })
                        ),
                    ])
                }),
                new ContextMenuItem({
                    name: Formatter.capitalizeFirstLetter(this.getUserFilter(this.userFilter)!),
                    childMenu: new ContextMenu([
                        Object.values(UserFilter).map(filter => 
                            new ContextMenuItem({
                                name: Formatter.capitalizeFirstLetter(this.getUserFilter(filter)!),
                                selected: filter === this.userFilter,
                                action() {
                                    this.selected = true
                                    if (this.selected) {
                                        m.userFilter = filter
                                    }
                                    return false
                                }
                            })
                        ),
                    ])
                }),
            ]
        ])

        menu.show({ button: event.currentTarget }).catch(console.error)
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

    get hasAdults() {
        return !!this.members.find(m => !m.isMinor)
    }

    get hasMinors() {
        return !!this.members.find(m => m.isMinor)
    }

    get fullAccess() {
        return SessionManager.currentSession!.user!.permissions!.hasFullAccess()
    }


    activated() {
        // Update email id if created
        if (!this.emailId) {
            this.emailId = (!!this.group?.privateSettings?.defaultEmailId && !!this.emails.find(e => e.id === this.group?.privateSettings?.defaultEmailId)?.id ? this.group?.privateSettings?.defaultEmailId : null) ?? this.emails.find(e => e.default)?.id ?? this.emails[0]?.id ?? null
        }
    }

    get editor() {
        return (this.$refs.editorView as EditorView).editor
    }

    didInsertButton = false

    insertSignInButton() {
        this.didInsertButton = true


        // Insert <hr> and content
        // Warning: due to a bug in Safari, we cannot add the <hr> as the first element, because that will cause the whole view to offset to the top for an unknown reason
        
        const content2 = `<p></p><p class="description"><em>Klik op de knop hierboven om jouw gegevens te wijzigen of om je in te schrijven. Belangrijk! Log altijd in met <strong><span data-type="smartVariable" data-id="email"></span></strong>. Anders heb je geen toegang tot jouw gegevens.</em></p>`;
        this.editor.chain().insertContentAt(this.editor.state.doc.content.size, [
            {
                type: "paragraph",
                content: []
            },
            {
                type: "horizontalRule",
            },
            {
                type: "paragraph",
                content: []
            },
        ], { updateSelection: true }).insertSmartButton(this.smartButtons[0]).insertContent(content2, { updateSelection: false })/*.focus()*/.run()
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

    get orderButtonDescription() {
        if (this.orderButtonType === "payment") {
            return "Via de bovenstaande knop kan je jouw bestelling en betaalinstructies bekijken."
        }
        if (this.orderButtonType === "tickets") {
            return "Via de bovenstaande knop kan je jouw tickets bekijken."
        }
        return "Via de bovenstaande knop kan je jouw bestelling bekijken."
    }

    insertOrderButton() {
        this.didInsertButton = true

        // Insert <hr> and content
        // Warning: due to a bug in Safari, we cannot add the <hr> as the first element, because that will cause the whole view to offset to the top for an unknown reason
        const content2 = `<p></p><p class="description"><em>${this.orderButtonDescription}</em></p>`;
        this.editor.chain().insertContentAt(this.editor.state.doc.content.size, [
            {
                type: "paragraph",
                content: []
            },
            {
                type: "horizontalRule",
            },
            {
                type: "paragraph",
                content: []
            },
        ], { updateSelection: true }).insertSmartButton(this.smartButtons[0]).insertContent(content2, { updateSelection: false })/*.focus()*/.run()
    }

    mounted() {
        if (this.members.length > 0) {
            if (!this.hasAdults) {
                this.memberFilter = MemberFilter.None
                this.parentFilter = ParentFilter.All
            } else {
                if (this.hasMinors) {
                    this.parentFilter = ParentFilter.Minors
                } else {
                    this.parentFilter = ParentFilter.None
                }
            }

            // Check if all the parents + members already have access (and an account) when they should have access
            MemberManager.updateMembersAccess(this.members).then(() => {
                // We created some users, so we might check the button again
                if (this.hasAllUsers && !this.didInsertButton) {
                    this.insertSignInButton()
                } else {
                    console.info("doent insert button")
                }
            }).catch(e => {
                Toast.fromError(e).show()
            })
        } else if (this.orders.length > 0 && !this.didInsertButton) {
            this.insertOrderButton()
        }

        if (this.hasFirstName) {
            // Insert "Dag <naam>," into editor
            this.editor.chain().setTextSelection(0).insertContent("Dag ").insertSmartVariable(this.smartVariables[0]).insertContent(",<p></p><p></p>")/*.focus()*/.run()
        }

        this.checkBounces().catch(e => {
            console.error(e)
        })
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

    get organization() {
        return OrganizationManager.organization
    }

    get hasFirstName() {
        return !this.recipients.find(r => !r.replacements.find(r => r.token === "firstName" && r.value.length > 0))
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
        if (hasAllUsers && !this.didInsertButton) {
            this.insertSignInButton()
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
                                token: "lastName",
                                value: order.data.customer.lastName ?? ""
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
                            }),
                            Replacement.create({
                                token: "orderPrice",
                                value: Formatter.price(order.data.totalPrice)
                            }),
                            Replacement.create({
                                token: "orderPriceToPay",
                                value: order.payment?.status !== PaymentStatus.Succeeded ? Formatter.price(order.payment!.price) : ""
                            }),
                            Replacement.create({
                                token: "paymentMethod",
                                value: order.payment?.method ? PaymentMethodHelper.getName(order.payment.method) : ""
                            }),
                            Replacement.create({
                                token: "transferDescription",
                                value: order.payment?.status !== PaymentStatus.Succeeded && order.payment?.method === PaymentMethod.Transfer ? (order.payment?.transferDescription ?? "") : ""
                            }),
                            Replacement.create({
                                token: "transferBankAccount",
                                value: order.payment?.status !== PaymentStatus.Succeeded && order.payment?.method === PaymentMethod.Transfer ? (this.webshop?.meta.transferSettings.iban ?? this.organization.meta.transferSettings.iban ?? "") : ""
                            }),
                            Replacement.create({
                                token: "transferBankCreditor",
                                value: order.payment?.status !== PaymentStatus.Succeeded && order.payment?.method === PaymentMethod.Transfer ? (this.webshop?.meta.transferSettings.creditor ?? this.organization.meta.transferSettings.creditor ?? this.organization.name) : ""
                            }),
                            Replacement.create({
                                token: "orderStatus",
                                value: OrderStatusHelper.getName(order.status)
                            }),
                            Replacement.create({
                                token: "orderTable",
                                value: "",
                                html: order.getHTMLTable()
                            })
                        ]
                    }))

                }
            }
        }
        

        for (const member of this.members) {
            // Minor if no age and registered in a group with max age = 17, or if member has age and is lower than 18
            const isMinor = member.isMinor

            for (const parent of member.details.parents) {
                if (!parent.email) {
                    continue;
                }

                const recipient = Recipient.create({
                    firstName: parent.firstName,
                    lastName: parent.lastName,
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
                    types: ["parent", isMinor ? "minor-parent" : "adult-parent"]
                })

                const existing = recipients.get(recipient.email)

                if (existing) {
                    existing.merge(recipient)
                    continue
                }

                recipients.set(recipient.email, recipient)
            }

            if (member.details.email) {
                // Create a loop for convenience (to allow break/contniue)
                for (const email of [member.details.email.toLowerCase()]) {
                    const existing = recipients.get(email)

                    const recipient = Recipient.create({
                        firstName: member.details.firstName,
                        lastName: member.details.lastName,
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
                        types: ["member", isMinor ? "minor-member" : "adult-member"]
                    })

                    if (existing) {
                        if (existing.types.includes("parent") && !existing.types.includes("member")) {
                            existing.merge(recipient)
                            
                            if (isMinor) {
                                // This is a duplicate email address that was also added to a minor member.
                                // probably because they didn't read and just entered their email address in a member email address field
                                // Keep this as a parent only email address
                                existing.types = existing.types.filter(t => !t.includes("member"))
                            }
                        } else {
                            existing.merge(recipient)
                        }
                        
                        continue
                    }

                    recipients.set(
                        email, 
                        recipient
                    )
                }
            }

            for (const user of member.users) {
                if (!user.email) {
                    continue;
                }
               
                const email = user.email.toLowerCase()
                const existing = recipients.get(email)

                const recipient = Recipient.create({
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email,
                    replacements: [
                        Replacement.create({
                            token: "firstName",
                            value: user.firstName ?? ""
                        }),
                        Replacement.create({
                            token: "lastName",
                            value: user.lastName ?? ""
                        }),
                        Replacement.create({
                            token: "email",
                            value: email
                        })
                    ],
                    // Create sign-in replacement 'signInUrl'
                    userId: user.id,
                    types: ["user", user.publicKey !== null ? "existing-user" : "pending-user"]
                })

                if (existing) {
                    // Link user
                    existing.merge(recipient)
                    continue
                }

                recipients.set(email, recipient)
            }
        }
      
        // todo: need to validate the recplacements of other recipients
        for (const recipient of this.otherRecipients) {
            const email = recipient.email.toLowerCase()
            const existing = recipients.get(email)
            const r = Recipient.create({
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
        // Keep track of all the types that we should filter out
        // If all the types of a given recipient are in this list, we should filter it out
        const deleteFilterList: string[] = []
        if (this.memberFilter !== MemberFilter.All) {
            deleteFilterList.push("member")

            if (this.memberFilter === MemberFilter.Adults || this.memberFilter === MemberFilter.None) {
                deleteFilterList.push("minor-member")
            }

            if (this.memberFilter === MemberFilter.None) {
                deleteFilterList.push("adult-member")
            }
        }

        if (this.parentFilter !== ParentFilter.All) {
            deleteFilterList.push("parent")

            if (this.parentFilter === ParentFilter.Minors || this.parentFilter === ParentFilter.None) {
                deleteFilterList.push("adult-parent")
            }

            if (this.parentFilter === ParentFilter.None) {
                deleteFilterList.push("minor-parent")
            }
        }

        if (this.userFilter !== UserFilter.All) {
            deleteFilterList.push("user")

            if (this.userFilter === UserFilter.Existing || this.userFilter === UserFilter.None) {
                deleteFilterList.push("pending-user")
            }

            if (this.userFilter === UserFilter.None) {
                deleteFilterList.push("existing-user")
            }
        }

        // Filter recipients based on deleteFilterList
        for (const recipient of recipients.values()) {
            if (recipient.types.every(t => deleteFilterList.includes(t))) {
                recipients.delete(recipient.email)
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

    get primaryColor() {
        return OrganizationManager.organization.meta.color ?? "black"
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
        return await EmailStyler.format(base, this.subject, this.primaryColor)
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

            await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/email",
                body: emailRequest,
            })
            this.dismiss({ force: true })
            new Toast("Jouw e-mail is verstuurd", "success").show()

            // Mark review moment
            AppManager.shared.markReviewMoment()
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
