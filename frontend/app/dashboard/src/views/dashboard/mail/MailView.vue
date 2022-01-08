<template>
    <EditorView class="mail-view" title="Nieuwe e-mail" save-text="Versturen" :smart-variables="smartVariables" @save="send">
        <h1 class="style-navigation-title">
            Nieuwe e-mail
        </h1>

        <STErrorsDefault :error-box="errorBox" />

        <!-- Buttons -->
        <template slot="buttons">
            <button v-if="!$isMobile" v-tooltip="'Voorbeeld tonen'" class="button navigation icon eye" type="button" @click="openPreview" />
            <label v-tooltip="'Bijlage toevoegen'" class="button icon attachment">
                <input type="file" multiple="multiple" style="display: none;" accept=".pdf, .docx, .xlsx, .png, .jpeg, .jpg, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf, image/jpeg, image/png, image/gif" @change="changedFile">
            </label>
        </template>

        <!-- List -->
        <template slot="list">
            <STListItem v-if="members.length > 0" class="no-padding right-stack">
                <div class="list-input-box">
                    <span>Aan:</span>

                    <div class="list-input" @click="showToMenu">
                        <span>{{ memberFilterDescription }}</span>
                        <span class="icon arrow-down-small gray" />
                    </div>
                </div>
                <span slot="right" class="style-description-small">{{ recipients.length }}</span>
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
            <!-- Buttons that are included in the e-mail -->
            <div v-if="addButton && orders.length == 0" ref="footerButton" key="loginButton" v-tooltip="'Klik om te verwijderen'" class="disabled" title="Knop voor inschrijvingen" @click="addButton = false">
                <hr>
                <p><a class="button primary" :href="'{{signInUrl}}'">Inschrijvingen beheren</a></p>
                <p class="style-description-small button-description">
                    <em>Klik op de knop hierboven om jouw gegevens te wijzigen of om je in te schrijven. Belangrijk! Log altijd in met <strong><span class="replace-placeholder" data-replace-type="email">linda.voorbeeld@gmail.com</span></strong>. Anders heb je geen toegang tot jouw gegevens.</em>
                </p>
            </div>
            <div v-else-if="addButton && orders.length > 0 && webshop" ref="footerButton" key="orderButton" class="disabled" title="Knop voor bestelling">
                <hr>
                <p><a class="button primary" :href="'{{orderUrl}}'">{{ orderButtonText }}</a></p>
                <p class="style-description-small button-description">
                    <em>Via de bovenstaande knop kan je jouw bestelling bekijken.</em>
                </p>
            </div>

            <!-- E-mail attachments -->
            <STList v-if="files.length > 0">
                <STListItem v-for="(file, index) in files" :key="index" class="file-list-item right-description right-stack">
                    <span slot="left" class="icon file" />
                    {{ file.name }}

                    <template #right>
                        <span>{{ file.size }}</span>
                        <span><button class="button icon gray trash" type="button" @click.stop="deleteAttachment(index)" /></span>
                    </template>
                </STListItem>
            </STList>

            <!-- Button to add smart buttons in e-mail -->
            <div v-if="!addButton && members.length > 0 && hasAllUsers" key="addButton" class="style-description-small">
                <button class="button text" type="button" @click="addButton = true">
                    <span class="icon add" />
                    <span>Inlogknop toevoegen</span>
                </button>
                Knop waarmee ontvangers automatisch kunnen inloggen op de registratiepagina of een account kunnen aanmaken.
            </div>

            <div v-if="!addButton && orders.length > 0 && webshop" key="addButton-webshop" class="style-description-small">
                <button class="button text" type="button" @click="addButton = true">
                    <span class="icon add" />
                    <span v-if="webshop.meta.ticketType == 'None'">
                        Voeg knop naar bestelling toe
                    </span>
                    <span v-else>
                        Voeg knop naar tickets en bestelling toe
                    </span>
                </button>
                <template v-if="webshop.meta.ticketType == 'None'">
                    Daar staan ook de betaalinstructies indien de bestelling nog niet betaald werd.
                </template>
                <template v-else>
                    Als de tickets nog niet betaald werden, zal de knop enkel naar de bestelling wijzen (met daar de betaalinstructies).
                </template>
            </div>
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

        <p v-if="!hasAllUsers && members.length > 0" class="info-box">
            Niet elke ontvanger heeft toegang tot de gegevens van de leden. Daarom kan je geen inlogknop toevoegen in de e-mail.
        </p>

        <p v-if="webshop && false " class="info-box" v-text="'Gebruik slimme vervangingen in jouw tekst: {{nr}} wordt automatisch vervangen door het bestelnummer van de klant. Test het uit en klik op \'Voorbeeld\'.'" />

        <p v-if="fileWarning" class="warning-box">
            We raden af om Word of Excel bestanden door te sturen omdat veel mensen hun e-mails lezen op hun smartphone en die bestanden vaak niet (correct) kunnen openen. Sommige mensen hebben ook geen licentie voor Word/Excel, want dat is niet gratis. Zet de bestanden om in een PDF en stuur die door.
        </p>
    </EditorView>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, ContextMenu, ContextMenuItem, Dropdown, EditorSmartVariable, EditorView, ErrorBox, STErrorsDefault, STInputBox, STList, STListItem, Toast, ToastButton, TooltipDirective } from "@stamhoofd/components";
import { AppManager, SessionManager } from '@stamhoofd/networking';
import { EmailAttachment, EmailInformation, EmailRequest, Group, MemberWithRegistrations, PrivateOrder, Recipient, Replacement, WebshopPreview, WebshopTicketType } from '@stamhoofd/structures';
import { OrderStatusHelper } from '@stamhoofd/structures/esm/dist';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop, Watch } from "vue-property-decorator";

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

enum MemberFilter {
    All = "all",
    GrownUps = "GrownUps",
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

    memberFilter = MemberFilter.GrownUps
    parentFilter = ParentFilter.Minors
    userFilter = UserFilter.All

    get smartVariables() {
        const variables = [
            new EditorSmartVariable({
                id: "firstName", 
                name: "Voornaam", 
                example: this.recipients.find(r => r.firstName && r.firstName.length > 0)?.firstName ?? undefined,
            }),
            new EditorSmartVariable({
                id: "lastName", 
                name: "Achternaam", 
                example: this.recipients.find(r => r.lastName && r.lastName.length > 0)?.lastName ?? undefined,
            })
        ]

        if (this.orders.length > 0) {
            variables.push(new EditorSmartVariable({
                id: "orderNumber", 
                name: "Bestelnummer", 
                example: this.orders[0].number?.toString(),
            }))

            variables.push(new EditorSmartVariable({
                id: "orderPrice", 
                name: "Bestelbedrag", 
                example: this.orders[0].data.totalPrice ? Formatter.price(this.orders[0].data.totalPrice) : undefined,
            }))

            variables.push(new EditorSmartVariable({
                id: "orderStatus", 
                name: "Bestelstatus", 
                example: this.orders[0].status ? OrderStatusHelper.getName(this.orders[0].status) : undefined,
            }))
        }

        return variables
    }

    getMemberFilter(filter: MemberFilter, none = true): string | undefined {
        switch (filter) {
            case MemberFilter.All:
                return "alle leden"
            case MemberFilter.GrownUps:
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

    get hasGrownUps() {
        return !!this.members.find(m => m.details.defaultAge < 18)
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
            if (!this.hasGrownUps) {
                this.memberFilter = MemberFilter.None
                this.parentFilter = ParentFilter.All
            }

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
                            })
                        ]
                    }))

                }
            }
        }
        

        for (const member of this.members) {
            const isMinor = (member.details.age == null || member.details.age < 18)

            if (this.parentFilter !== ParentFilter.None && !(this.parentFilter === ParentFilter.Minors && !isMinor)) {
                for (const parent of member.details.parents) {
                    if (!parent.email) {
                        continue;
                    }

                    const existing = recipients.get(parent.email.toLowerCase())

                    if (existing && existing.firstName) {
                        // Mark this e-mail for deletion
                        continue
                    }

                    recipients.set(parent.email.toLowerCase(), Recipient.create({
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
                        userId: existing?.userId,
                        type: "parent"
                    }))
                }
            }

            if (member.details.email) {
                if (this.memberFilter !== MemberFilter.None && !(this.memberFilter === MemberFilter.GrownUps && isMinor)) {
                    // Create a loop for convenience (to allow break/contniue)
                    for (const email of [member.details.email.toLowerCase()]) {
                        const existing = recipients.get(email)
                        if (existing && existing.firstName) {
                            if (existing.type === "parent" && isMinor) {
                                // This is a duplicate email address that was also added to the member.
                                // Keep this as a parent email address
                                continue
                            }

                            // Mark this e-mail as a member's one
                            existing.type = "member"

                            continue
                        }
                        recipients.set(
                            email, 
                            Recipient.create({
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
                                type: "member"
                            })
                        )
                    }
                }
            }

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

                    if (!existing.lastName && user.lastName) {
                        existing.lastName = user.lastName
                    }
                    continue
                }

                if (this.userFilter === UserFilter.None) {
                    continue
                }

                if (this.userFilter === UserFilter.Existing && user.publicKey === null) {
                    continue
                }

                recipients.set(email, Recipient.create({
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
                    userId: user.id
                }))
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
        return Array.from(recipients.values())
    }

    get emails() {
        return this.organization.privateMeta?.emails ?? []
    }

    manageEmails() {
        this.present(new ComponentWithProperties(NavigationController, { root : new ComponentWithProperties(EmailSettingsView)}).setDisplayStyle("popup"))
    }

    async getHTML(withButton: boolean | null = null) {
        const editor = (this.$refs.editor as any)?.editor
        if (!editor) {
            // When editor is not yet loaded: slow internet -> need to know html on dismiss confirmation
            return {
                text: "",
                html: ""
            }
        }

        let base: string = editor.getHTML();

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

            // Mark review moment
            AppManager.shared.markReviewMoment()
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

        .mail-hr {
            margin: 0;
            margin-right: calc(-1 * var(--st-horizontal-padding, 40px));
        }

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
