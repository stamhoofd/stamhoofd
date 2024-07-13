<template>
    <EditorView ref="editorView" :disabled="!emailId" class="mail-view" title="Nieuwe e-mail" save-text="Versturen" :smart-variables="smartVariables" :smart-buttons="smartButtons" :style="{'--editor-primary-color': primaryColor, '--editor-primary-color-contrast': primaryColorContrast}" @save="send">
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
            <hr v-if="!$isMobile && !$isIOS && !$isAndroid">
            <button v-if="!$isMobile && !$isIOS && !$isAndroid" v-tooltip="'Voorbeeld tonen'" class="button icon eye" type="button" @click="openPreview" />
        </template>

        <!-- List -->
        <template #list>
            <STListItem v-if="members.length > 0" class="no-padding right-stack">
                <div class="list-input-box">
                    <span>Aan:</span>

                    <button class="list-input dropdown" type="button" @click="showToMenu">
                        <span>{{ memberFilterDescription }}</span>
                        <span class="icon arrow-down-small gray" />
                    </button>
                </div>
                <template #right><span class="style-description-small">{{ recipients.length }}</span></template>
                <template v-if="hasToWarnings" #right><button class="button icon warning yellow" type="button" @click="showToWarnings" /></template>
            </STListItem>
            <STListItem v-else class="no-padding right-stack">
                <div class="list-input-box">
                    <span>Aan:</span>
                    <span class="list-input">{{ recipients.length == 1 ? recipients[0].firstName+" "+recipients[0].lastName : recipients.length +" ontvangers" }}</span>
                </div>
                <template v-if="hasToWarnings" #right><button class="button icon warning yellow" type="button" @click="showToWarnings" /></template>
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

                <template v-if="fullAccess" #right><button class="button text" type="button" @click="manageEmails">
                    <span class="icon settings" />
                </button></template>
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
import { Component, Mixins, Prop, Watch } from "@simonbackx/vue-app-navigation/classes";
import { EmailSettingsView, CenteredMessage, Checkbox, ContextMenu, ContextMenuItem, Dropdown, EditorView, EmailStyler, ErrorBox, STErrorsDefault, STInputBox, STList, STListItem, Toast, ToastButton, TooltipDirective } from "@stamhoofd/components";
import { AppManager } from '@stamhoofd/networking';
import { EmailAttachment, EmailInformation, EmailRequest, Group, Member, EditorSmartButton, EditorSmartVariable, MemberWithRegistrations, Order, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, PrivateOrder, Recipient, Replacement, WebshopPreview, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

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

    @Prop({ default: () => []})
        payments!: PaymentGeneral[];

    @Prop({ default: null})
        webshop!: WebshopPreview | null

    @Prop({ default: () => []})
        otherRecipients: { firstName?: string; lastName?: string; email: string }[]
    
    @Prop({ required: false, default: () => [] })
        defaultReplacements: Replacement[]

    sending = false

    addButton = (this.orders.length > 0 && this.webshop) || (this.members.length > 0 && this.hasAllUsers)

    @Prop({ default: null })
        defaultSubject!: string | null

    @Prop({ default: null })
        group!: Group | null

    // Make session (organization) reactive
    reactiveSession = this.$context

    emailId: string | null = null
    subject = this.defaultSubject ?? ""

    errorBox: ErrorBox | null = null

    files: TmpFile[] = []

    checkingBounces = false
    emailInformation: EmailInformation[] = []

    memberFilter = MemberFilter.Adults
    parentFilter = ParentFilter.Minors
    userFilter = UserFilter.All
    oneEmailPerMember = true

    get smartVariables() {
        const variables = [
            EditorSmartVariable.create({
                id: "firstName", 
                name: "Voornaam", 
                example: "", 
                description: (this.members.length > 0) ? (this.parentFilter !== ParentFilter.None ? "'beste ouder' voor onbekende voornaam" : "'beste lid' voor onbekende voornaam") : "",
                deleteMessage: "De voornaam van één of meerdere ontvangers ontbreekt in het systeem. De magische tekstvervanging voor de voornaam is daarom weggehaald."
            }),
            EditorSmartVariable.create({
                id: "lastName", 
                name: "Achternaam", 
                example: "", 
                deleteMessage: "De achternaam van één of meerdere ontvangers ontbreekt in het systeem. De magische tekstvervanging voor de achteraam is daarom weggehaald."
            }),
            EditorSmartVariable.create({
                id: "email", 
                name: "E-mailadres", 
                example: "", 
            }),
            EditorSmartVariable.create({
                id: "firstNameMember", 
                name: "Voornaam van lid", 
                example: "", 
                deleteMessage: "Je kan de voornaam van een lid enkel gebruiken als je één e-mail per lid verstuurt."
            }),
            EditorSmartVariable.create({
                id: "lastNameMember", 
                name: "Achternaam van lid", 
                example: "", 
                deleteMessage: "Je kan de achternaam van een lid enkel gebruiken als je één e-mail per lid verstuurt."
            }),
            EditorSmartVariable.create({
                id: "outstandingBalance", 
                name: "Openstaand bedrag", 
                example: "", 
                deleteMessage: "Je kan het openstaand bedrag van een lid enkel gebruiken als je één e-mail per lid verstuurt."
            }),
            EditorSmartVariable.create({
                id: "loginDetails", 
                name: "Inloggegevens", 
                example: "",
                hint: "Deze tekst wijzigt afhankelijk van de situatie: als de ontvanger nog geen account heeft, vertelt het op welk e-mailadres de ontvanger kan registreren. In het andere geval op welk e-mailadres de ontvanger kan inloggen."
            }),
        ]

        //if (this.orders.length > 0) {
        variables.push(EditorSmartVariable.create({
            id: "nr", 
            name: "Bestelnummer", 
            example: "", 
        }))

        variables.push(EditorSmartVariable.create({
            id: "orderPrice", 
            name: "Bestelbedrag", 
            example: "", 
        }))

        variables.push(EditorSmartVariable.create({
            id: "orderStatus", 
            name: "Bestelstatus", 
            example: "", 
        }))

        variables.push(EditorSmartVariable.create({
            id: "orderTime", 
            name: "Tijdstip", 
            example: "", 
        }))

        variables.push(EditorSmartVariable.create({
            id: "orderDate", 
            name: "Afhaal/leverdatum", 
            example: "", 
        }))

        variables.push(EditorSmartVariable.create({
            id: "orderMethod", 
            name: "Afhaalmethode (afhalen, leveren, ter plaatse)", 
            example: "", 
        }))

        variables.push(EditorSmartVariable.create({
            id: "orderLocation", 
            name: "Locatie of leveradres", 
            example: "", 
        }))

        //}

        variables.push(EditorSmartVariable.create({
            id: "paymentMethod", 
            name: "Betaalmethode", 
            example: "", 
        }))

        variables.push(EditorSmartVariable.create({
            id: "priceToPay", 
            name: "Te betalen bedrag", 
            example: "", 
        }))     

        variables.push(EditorSmartVariable.create({
            id: "pricePaid", 
            name: "Betaald bedrag", 
            example: "", 
        }))      

        variables.push(EditorSmartVariable.create({
            id: "transferDescription", 
            name: "Mededeling (overschrijving)", 
            example: "", 
        }))

        variables.push(EditorSmartVariable.create({
            id: "transferBankAccount", 
            name: "Rekeningnummer (overschrijving)", 
            example: "", 
        }))

        variables.push(EditorSmartVariable.create({
            id: "transferBankCreditor", 
            name: "Begunstigde (overschrijving)", 
            example: "", 
        }))

        variables.push(EditorSmartVariable.create({
            id: "orderTable", 
            name: "Tabel met bestelde artikels", 
            example: "order table", 
            html: ""
        }))

        variables.push(EditorSmartVariable.create({
            id: "overviewTable", 
            name: "Overzichtstabel", 
            example: "overview table", 
            html: ""
        }))

        variables.push(EditorSmartVariable.create({
            id: "orderDetailsTable", 
            name: "Tabel met bestelgegevens", 
            example: "order details table", 
            html: ""
        }))

        variables.push(EditorSmartVariable.create({
            id: "paymentTable", 
            name: "Tabel met betaalinstructies", 
            example: "payment table", 
            html: ""
        }))

        variables.push(EditorSmartVariable.create({
            id: "overviewContext", 
            name: "Betaalcontext", 
            example: "", 
        }))


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
            buttons.push(EditorSmartButton.create({
                id: "signInUrl",
                name: "Knop om in te loggen",
                text: "Open ledenportaal",
                hint: "Als gebruikers op deze knop klikken, zorgt het systeem ervoor dat ze inloggen of registreren op het juiste e-mailadres dat al in het systeem zit."
            }))
        }

        buttons.push(EditorSmartButton.create({
            id: "orderUrl",
            name: "Knop naar bestelling",
            text: this.orderButtonText,
            hint: "Deze knop gaat naar het besteloverzicht, met alle informatie van de bestellingen en eventueel betalingsinstructies."
        }))

        buttons.push(EditorSmartButton.create({
            id: "unsubscribeUrl",
            name: "Knop om uit te schrijven voor e-mails",
            text: "Uitschrijven",
            hint: "Met deze knop kan de ontvanger zich uitschrijven voor alle e-mails.",
            type: 'inline'
        }))

        // Remove all smart variables that are not set in the recipients
        return buttons.filter(button => {
            if (button.id === "signInUrl" || button.id === "unsubscribeUrl") {
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
        return this.recipients.length == 0 || this.hardBounces.length > 0 || this.spamComplaints.length > 0 || !this.hasFirstName
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
        } else {
            if (!this.hasFirstName) {
                new Toast("Bij niet elk e-mailadres staat er een voornaam in het systeem. Daarom kan je geen automatische begroeting toevoegen in de e-mail.", "warning yellow")
                    .setButton(new ToastButton("Toon", () => {
                        this.showMissingFirstNames()
                    }))
                    .setHide(10*1000)
                    .show()
            }
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
        return Formatter.joinLast(list, ", ", " en ") + (this.oneEmailPerMember && this.parentFilter !== ParentFilter.None ? " (één e-mail per lid)" : "")
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
            ],
            [
                // oneEmailPerMember
                new ContextMenuItem({
                    name: this.oneEmailPerMember ? "Eén e-mail per lid" : "Groepeer per gezin",
                    childMenu: new ContextMenu([
                        [
                            new ContextMenuItem({
                                name: "Eén e-mail per lid",
                                selected: this.oneEmailPerMember,
                                action() {
                                    this.selected = true
                                    if (this.selected) {
                                        m.oneEmailPerMember = true
                                    }
                                    return false
                                }
                            }),
                            new ContextMenuItem({
                                name: "Groepeer per gezin",
                                selected: !this.oneEmailPerMember,
                                action() {
                                    this.selected = true
                                    if (this.selected) {
                                        m.oneEmailPerMember = false
                                    }
                                    return false
                                }
                            }),
                        ],
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
            const response = await this.$context.authenticatedServer.request({
                method: "POST",
                path: "/email/check-bounces",
                body: [...this.allRecipients.values()].map(r => r.email),
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

    get hasParents() {
        return !!this.members.find(m => !!m.details.parents.length)
    }

    get fullAccess() {
        return this.$context.organizationAuth.hasFullAccess()
    }

    getDefaultEmailId() {
        if (this.webshop) {
            const id = this.webshop.privateMeta.defaultEmailId
            if (!this.emails.find(e => e.id === id)) {
                // Invalid: take first again
                return this.emails[0]?.id ?? null
            }
            return id
        }
        return (!!this.group?.privateSettings?.defaultEmailId && !!this.emails.find(e => e.id === this.group?.privateSettings?.defaultEmailId)?.id ? this.group?.privateSettings?.defaultEmailId : null) ?? this.emails.find(e => e.default)?.id ?? this.emails[0]?.id ?? null
    }

    activated() {
        // Update email id if created
        if (!this.emailId) {
            this.emailId = this.getDefaultEmailId()
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
        //const content2 = `<p class="description"><em>Log in het ledenportaal altijd in met <strong><span data-type="smartVariable" data-id="email"></span></strong>. Anders heb je geen toegang tot jouw gegevens.</em></p>`;
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
        ], { updateSelection: true }).insertSmartButton(this.smartButtons[0], { updateSelection: true }).insertSmartVariable(this.smartVariables.find(s => s.id === 'loginDetails')!, { updateSelection: false }).setTextSelection(0)/*.focus()*/.run()

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        //this.editor.state.tr.setSelection(TextSelection.create(this.editor.state.tr.doc, position))
    }

    get orderButtonType() {
        for (const order of this.orders) {
            if (order.payment?.paidAt !== null || order.payment?.method === PaymentMethod.PointOfSale) {
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
        ], { updateSelection: true }).insertSmartButton(this.smartButtons[0], { updateSelection: true }).insertContent(content2, { updateSelection: false }).setTextSelection(0)/*.focus()*/.run()
    }

    insertPaymentDefault() {

        // Find all variables, if they are valid
        const priceToPay = this.smartVariables.find(v => v.id === "priceToPay")
        const pricePaid = this.smartVariables.find(v => v.id === "pricePaid")

        const transferDescription = this.smartVariables.find(v => v.id === "transferDescription")
        const transferBankAccount = this.smartVariables.find(v => v.id === "transferBankAccount")
        const transferBankCreditor = this.smartVariables.find(v => v.id === "transferBankCreditor")
        const overviewTable = this.smartVariables.find(v => v.id === "overviewTable")
        const overviewContext = this.smartVariables.find(v => v.id === "overviewContext")
        const paymentTable = this.smartVariables.find(v => v.id === "paymentTable")

        // Insert <hr> and content
        // Warning: due to a bug in Safari, we cannot add the <hr> as the first element, because that will cause the whole view to offset to the top for an unknown reason
        let chain = this.editor.chain()

        if (priceToPay) {
            chain = chain.insertContentAt(this.editor.state.doc.content.size, [
                {
                    type: "paragraph",
                    content: []
                },
                {
                    type: "horizontalRule",
                    content: []
                },
                {
                    type: "heading",
                    attrs: {
                        level: 2
                    },
                    content: [
                        {
                            type: "text",
                            text: "Betaalinstructies"
                        }
                    ]
                },
            ]);

            if (transferDescription) {
                chain = chain
                    .insertContent(`<p></p>`)
                    .insertContent([
                        {
                            type: "paragraph",
                            content: []
                        },
                    
                        {
                            type: "descriptiveText",
                            marks: [{
                                type: 'italic'
                            }],
                            content: [
                                {
                                    type: "text",
                                    text: "Gelieve zeker de mededeling '",
                                    marks: [{
                                        type: 'italic'
                                    }],
                                },
                                { 
                                    ...transferDescription.getJSONContent(), 
                                    marks: [{
                                        type: 'italic'
                                    }], 
                                },
                                {
                                    type: "text",
                                    text: "' te vermelden in jouw overschrijving.",
                                    marks: [{
                                        type: 'italic'
                                    }],
                                }
                            ]
                        },

                        {
                            type: "paragraph",
                            content: []
                        },

                        ...(paymentTable ? [
                            paymentTable.getJSONContent()
                        ] : []),
                        
                        {
                            type: "paragraph",
                            content: []
                        },

                        {
                            type: "paragraph",
                            content: []
                        },
                    ])
            }
        }
        
        if (overviewTable) {
            chain = chain.insertContent([
                {
                    type: "paragraph",
                    content: []
                },
                ...(transferDescription ? [] : [{
                    type: "horizontalRule",
                    content: []
                }]),
                {
                    type: "heading",
                    attrs: {
                        level: 2
                    },
                    content: [
                        overviewContext ? 
                            overviewContext.getJSONContent() 
                            : {
                                type: "text",
                                text: "Overzicht"
                            }
                    ]
                },
                {
                    type: "paragraph",
                    content: []
                },
                overviewTable.getJSONContent(),
                {
                    type: "paragraph",
                    content: []
                },
            ])
            
            if (priceToPay) {
                chain = chain.insertContent("<p></p><h3>Totaal: </h3>").insertSmartVariable(priceToPay);
            } else if (pricePaid) {
                chain = chain.insertContent("<p></p><h3>Totaal: </h3>").insertSmartVariable(pricePaid).insertContent(" (betaald)");
            }
        }
        
        chain.run()
    }

    get hasParentsOrMembers() {
        return !![...this.allRecipients.values()].find(r => r.types.includes('parent') || r.types.includes('member'))
    }

    mounted() {
        this.emailId = this.getDefaultEmailId()

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
            if (this.hasAllUsers && !this.didInsertButton) {
                this.insertSignInButton()
            } else {
                console.info("doent insert button")
            }
        } else if (this.orders.length > 0 && !this.didInsertButton) {
            this.insertOrderButton()
        }

        if (this.hasFirstName) {
            // Insert "Dag <naam>," into editor
            this.editor.chain().setTextSelection(0).insertContent("Dag ").insertSmartVariable(this.smartVariables[0]).insertContent(",<p></p><p></p>")/*.focus()*/.run()
        }

        if (this.payments.length) {
            this.insertPaymentDefault()
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
        return this.$organization
    }

    get hasFirstName() {
        return !this.recipients.find(r => !r.replacements.find(r => r.token === "firstName" && r.value.length > 0))
    }

    showMissingFirstNames() {
        const missing = this.recipients.filter(r => !r.replacements.find(r => r.token === "firstName" && r.value.length > 0))
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

    addMemberRecipient(member: Member | MemberWithRegistrations, recipients:  Map<string, Recipient>, prefix = '') {
        // Minor if no age and registered in a group with max age = 17, or if member has age and is lower than 18
        const isMinor = member.isMinor

        const shared: Replacement[] = []
        if (this.oneEmailPerMember) {
            shared.push(Replacement.create({
                token: "firstNameMember",
                value: member.firstName
            }))

            if (member.details.lastName) {
                shared.push(Replacement.create({
                    token: "lastNameMember",
                    value: member.details.lastName
                }))
            }

            shared.push(Replacement.create({
                token: "outstandingBalance",
                value: Formatter.price(member.outstandingBalance)
            }))
        }

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
                        token: "lastName",
                        value: parent.lastName
                    }),
                    Replacement.create({
                        token: "email",
                        value: parent.email.toLowerCase()
                    }),
                    ...shared
                ],
                types: ["parent", isMinor ? "minor-parent" : "adult-parent"]
            })

            const existing = recipients.get(prefix + recipient.email)

            if (existing) {
                existing.merge(recipient)
                continue
            }

            recipients.set(prefix + recipient.email, recipient)
        }

        if (member.details.email) {
            // Create a loop for convenience (to allow break/contniue)
            for (const email of [member.details.email.toLowerCase()]) {
                const existing = recipients.get(prefix + email)

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
                            token: "lastName",
                            value: member.details.lastName
                        }),
                        Replacement.create({
                            token: "email",
                            value: email
                        }),
                        ...shared
                    ],
                    types: ["member", isMinor ? "minor-member" : "adult-member"]
                })

                if (existing) {
                    if (existing.types.includes("parent") && !existing.types.includes("member")) {
                        // Only merge after check!
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
                    prefix + email, 
                    recipient
                )
            }
        }

        if (member instanceof MemberWithRegistrations) {
            for (const user of member.users) {
                if (!user.email) {
                    continue;
                }
                
                const email = user.email.toLowerCase()
                const existing = recipients.get(prefix + email)

                const recipient = Recipient.create({
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email,
                    replacements: [
                        Replacement.create({
                            token: "firstName",
                            value: user.firstName ?? (isMinor ? "beste ouder" : "beste lid")
                        }),
                        Replacement.create({
                            token: "lastName",
                            value: user.lastName ?? ""
                        }),
                        Replacement.create({
                            token: "email",
                            value: email
                        }),
                        Replacement.create({
                            token: "loginDetails",
                            value: "",
                            html: user.hasAccount ? `<p class="description"><em>Je kan op het ledenportaal inloggen met <strong>${Formatter.escapeHtml(email)}</strong></em></p>` : `<p class="description"><em>Je kan op het ledenportaal een nieuw account aanmaken met het e-mailadres <strong>${Formatter.escapeHtml(email)}</strong>, dan krijg je automatisch toegang tot alle bestaande gegevens.</em></p>`
                        }),
                        ...shared
                    ],
                    // Create sign-in replacement 'signInUrl'
                    userId: user.id,
                    types: ["user", user.hasAccount ? "existing-user" : "pending-user"]
                })

                if (existing) {
                    // Link user
                    existing.merge(recipient)
                    continue
                }

                recipients.set(prefix + email, recipient)
            }
        }
    }

    addOrderRecipient(order: Order, recipients:  Map<string, Recipient>, payment?: PaymentGeneral) {
        if (order.data.customer.email.length > 0) {
            let webshop: WebshopPreview | null = this.webshop

            if (!webshop || order.webshopId !== webshop.id) {
                webshop = this.organization.webshops.find(w => w.id === order.webshopId) ?? null
            }
            if (!webshop) {
                return;
            }

            // Send one e-mail for every order
            const id = "order-"+order.id

            const existing = recipients.get(id)
            const recipient = order.getRecipient(this.organization, webshop, payment)

            if (existing) {
                existing.merge(recipient)
                existing.email = recipient.email
                return
            }
            recipients.set(id, recipient)
        }
    }

    // Unfiltered
    get allRecipients(): Map<string, Recipient> {
        const recipients: Map<string, Recipient> = new Map()

        for (const payment of this.payments) {
            const paymentRecipientsMap: Map<string, Recipient> = new Map()
            for (const order of payment.orders) {
                this.addOrderRecipient(order, paymentRecipientsMap, payment)
            }

            for (const member of payment.members) {
                this.addMemberRecipient(member, paymentRecipientsMap)
            }

            // Move recipients
            let paymentRecipients = [...paymentRecipientsMap.values()]   

            // Filter if we have more than 1
            if (paymentRecipients.length > 1) {
                paymentRecipients = paymentRecipients.filter(recipient => {
                    // filter minors
                    if (recipient.types.includes("minor-member")) {
                        return false
                    }
                    if (recipient.types.includes("adult-parent")) {
                        return false
                    }
                    return true
                })         
            }

            // Readd to recipients
            for (const recipient of paymentRecipients) {
                // Override some replacements (we'll remove duplicates later)       
                let overviewContext: string[] = [];

                for (const order of payment.orders) {
                    const webshop = this.organization.webshops.find(w => w.id === order.webshopId) ?? null
                    if (webshop) {
                        overviewContext.push(`${webshop.meta.name} (bestelling ${order.number ?? ''})`)
                    } else {
                        overviewContext.push(`Bestelling ${order.number ?? ''}`)
                    }
                }

                if (payment.registrations.length > 0) {
                    overviewContext.push("Inschrijving " + Formatter.joinLast(Formatter.uniqueArray(payment.members.map(member => member.details.firstName)), ', ', ' en '))
                }

                recipient.replacements.push(
                    ...[
                        Replacement.create({
                            token: "overviewTable",
                            value: "",
                            html: payment.getDetailsHTMLTable()
                        }),
                        Replacement.create({
                            token: "paymentTable",
                            value: "",
                            html: payment.getHTMLTable()
                        }),
                        Replacement.create({
                            token: "overviewContext",
                            value: overviewContext.join(', '),
                        }),
                    ]);

                if (payment.method && payment.status !== PaymentStatus.Succeeded) {
                    // Add data
                    recipient.replacements.push(
                        ...[
                            Replacement.create({
                                token: "priceToPay",
                                value: Formatter.price(payment.price)
                            }),
                            Replacement.create({
                                token: "paymentMethod",
                                value: PaymentMethodHelper.getName(payment.method)
                            }),
                            Replacement.create({
                                token: "transferDescription",
                                value: (payment.transferDescription ?? "")
                            }),
                        ]
                    )

                    const transferSettings = payment.transferSettings ?? this.organization.meta.transferSettings
                    recipient.replacements.push(
                        ...[
                            Replacement.create({
                                token: "transferBankAccount",
                                value: transferSettings.iban ?? ""
                            }),
                            Replacement.create({
                                token: "transferBankCreditor",
                                value: transferSettings.creditor ?? this.organization.name
                            }),
                        ]
                    )
                } else if (payment.status === PaymentStatus.Succeeded) {
                    recipient.replacements.push(
                        ...[
                            Replacement.create({
                                token: "pricePaid",
                                value: Formatter.price(payment.price)
                            }),
                            Replacement.create({
                                token: "paymentMethod",
                                value: payment.method ? PaymentMethodHelper.getName(payment.method) : ""
                            }),
                        ]
                    )
                }

                recipient.removeDuplicates()
                recipients.set(payment.id+"-"+recipient.email, recipient)
            }
        }

        if (this.webshop) {
            for (const order of this.orders) {
                this.addOrderRecipient(order, recipients)
            }
        }

        for (const member of this.members) {
            // One e-mail per member
            const prefix = this.oneEmailPerMember ? `${member.id}-member-` : ""

            this.addMemberRecipient(member, recipients, prefix)
        }
      
        // TODO: need to validate the recplacements of other recipients
        for (const recipient of this.otherRecipients) {
            const email = recipient.email.toLowerCase()
            const existing = recipients.get(email)
            const r = Recipient.create({
                firstName: recipient.firstName,
                lastName: recipient.lastName,
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
                ]
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
        if (this.members.length === 0) {
            return [...this.allRecipients.values()];
        }
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

        return Array.from(recipients.values()).filter(recipient => {
            return !recipient.types.every(t => deleteFilterList.includes(t))
        });
    }

    get emails() {
        return this.organization.privateMeta?.emails ?? []
    }

    @Watch("emails")
    onChangeEmails() {
        if (!this.emailId) {
            this.emailId = this.getDefaultEmailId()
        }
    }

    manageEmails() {
        this.present(new ComponentWithProperties(NavigationController, { root : new ComponentWithProperties(EmailSettingsView)}).setDisplayStyle("popup"))
    }

    get primaryColor() {
        return this.defaultReplacements.find(r => r.token === 'primaryColor')?.value ?? "#0053ff"
    }

    get primaryColorContrast() {
        return this.defaultReplacements.find(r => r.token === 'primaryColorContrast')?.value ?? "#fff"
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
            const extra = this.defaultReplacements
            for (const replacement of [...recipient.replacements, ...extra]) {
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
                    message: "Schrijf een voldoende groot bericht, anders is de kans groot dat jouw e-mail als spam wordt gezien",
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
                attachments,
                defaultReplacements: this.defaultReplacements
            })

            await this.$context.authenticatedServer.request({
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
