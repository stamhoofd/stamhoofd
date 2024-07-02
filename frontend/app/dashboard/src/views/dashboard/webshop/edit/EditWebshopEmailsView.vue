<template>
    <SaveView :title="viewTitle" :loading="saving" @save="save">
        <h1>{{ viewTitle }}</h1>
        <p>Hoofdbeheerders kunnen via Instellingen → E-mailadressen ook het e-mailadres wijzigen van waaruit de e-mails verstuurd worden.</p>

        <p>Wijzig de automatische e-mails die op bepaalde momenten verstuurd worden. Sommige e-mails zijn mogelijks niet van toepassing op deze webshop (afhankelijk van de betaalmethodes die ingesteld zijn).</p>

        <STErrorsDefault :error-box="errorBox" />

        <div v-for="(category, index) in emailDefinitions" :key="index" class="container">
            <hr>
            <h2>{{ category.name }}</h2>
            <p>{{ category.description }}</p>
            <STList>
                <STListItem v-for="emailDefinition in category.definitions" :key="emailDefinition.type" :selectable="true" class="left-center right-stack" @click="editEmail(emailDefinition)">
                    <template #left><img :src="emailDefinition.illustration" class="style-illustration-img"></template>
                    <h2 class="style-title-list">
                        {{ emailDefinition.name }}
                    </h2>
                    <p class="style-description">
                        {{ emailDefinition.description }}
                    </p>

                    <template #right>
                        <span v-if="hasTemplate(emailDefinition.type)" class="style-tag">Aangepast</span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import creditCardsIllustration from "@stamhoofd/assets/images/illustrations/creditcards.svg";
import payPointOfSaleIllustration from "@stamhoofd/assets/images/illustrations/pay-point-of-sale.svg";
import transferIllustration from "@stamhoofd/assets/images/illustrations/transfer.svg";
import { CenteredMessage, EditEmailTemplateView, EditorSmartButton, EditorSmartVariable, ErrorBox, SaveView, STErrorsDefault, STList, STListItem, Toast } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from "@stamhoofd/networking";
import { Address, Cart, CartItem, CartItemPrice, Country, Customer, EmailTemplate, EmailTemplateType, Order, OrderData, Payment, PaymentMethod, Product, ProductPrice, TransferDescriptionType, TransferSettings, ValidatedAddress, WebshopTakeoutMethod, WebshopTicketType, WebshopTimeSlot } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";


import { WebshopManager } from "../WebshopManager";

@Component({
    components: {
        STListItem,
        STList,
        STErrorsDefault,
        SaveView
    },
})
export default class EditWebshopEmailsView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        webshopManager: WebshopManager
    
    saving = false
    loading = true
    errorBox: ErrorBox | null = null

    templates: EmailTemplate[] = []
    patchTemplates: PatchableArrayAutoEncoder<EmailTemplate> = new PatchableArray()

    get patchedTemplates() {
        return this.patchTemplates.applyTo(this.templates)
    }

    async loadTemplates() {
        this.loading = true
        try {
            const response = await this.$context.authenticatedServer.request({
                method: "GET",
                path: "/email-templates",
                query: { webshopId: this.webshopManager.preview.id },
                shouldRetry: true,
                owner: this,
                decoder: new ArrayDecoder(EmailTemplate as Decoder<EmailTemplate>)
            })
            this.templates = response.data
            this.loading = false
        } catch (e) {
            Toast.fromError(e).show()
        }
        
    }

    mounted() {
        UrlHelper.setUrl("/webshops/" + Formatter.slug(this.webshopManager.preview.meta.name) + "/settings/emails")
        this.loadTemplates().catch(console.error)
    }

    beforeUnmount() {
        Request.cancelAll(this)
    }

    get viewTitle() {
        return "Wijzig e-mails"
    }

    get organization() {
        return this.$organization
    }

    get hasTickets() {
        return this.webshopManager.preview.meta.ticketType !== WebshopTicketType.None
    }

    get emailDefinitions() {
        if (!this.hasTickets) {
            return [
                {
                    name: "Bestelbevestiging",
                    description: "Afhankelijk van de betaalmethode die de besteller heeft gekozen, ontvangt de besteller één van de volgende e-mails.",
                    definitions: [
                        {
                            type: EmailTemplateType.OrderConfirmationOnline,
                            illustration: creditCardsIllustration,
                            name: "Online betaald (of totaalbedrag is 0 euro)",
                        },
                        {
                            type: EmailTemplateType.OrderConfirmationTransfer,
                            illustration: transferIllustration,
                            name: "Te betalen via overschrijving",
                        },
                        {
                            type: EmailTemplateType.OrderConfirmationPOS,
                            illustration: payPointOfSaleIllustration,
                            name: "Ter plaatse te betalen",
                        }
                    ]
                },
                {
                    name: "Overschrijving ontvangen",
                    description: "Als je in Stamhoofd een overschrijving als betaald markeert, wordt er ook een automatische e-mail verstuurd naar de besteller.",
                    definitions: [
                        {
                            type: EmailTemplateType.OrderReceivedTransfer,
                            illustration: transferIllustration,
                            name: "Overschrijving ontvangen",
                        }
                    ]
                }
            ]
        }

        return [
            {
                name: "Bestelbevestiging",
                description: "Afhankelijk van de betaalmethode die de besteller heeft gekozen, ontvangt de besteller één van de volgende e-mails.",
                definitions: [
                    {
                        type: EmailTemplateType.TicketsConfirmation,
                        illustration: creditCardsIllustration,
                        name: "Online betaald (of totaalbedrag is 0 euro)",
                        description: "De tickets kunnen gedownload worden in de e-mail.",
                    },
                    {
                        type: EmailTemplateType.TicketsConfirmationTransfer,
                        illustration: transferIllustration,
                        name: "Overschrijving (geen tickets)",
                        description: "De besteller ontvangt de tickets pas na het betalen van de overschrijving.",
                    },
                    {
                        type: EmailTemplateType.TicketsConfirmationPOS,
                        illustration: payPointOfSaleIllustration,
                        name: "Ter plaatse betalen",
                        description: "De tickets kunnen gedownload worden in de e-mail, maar betaling is nog noodzakelijk ter plaatse.",
                    },
                ]
            },
            {
                name: "Overschrijving ontvangen",
                description: "Als je in Stamhoofd een overschrijving als betaald markeert, wordt er ook een automatische e-mail verstuurd met de tickets.",
                definitions: [
                    {
                        type: EmailTemplateType.TicketsReceivedTransfer,
                        illustration: transferIllustration,
                        name: "Tickets na ontvangen overschrijving",
                        description: "De e-mail die volgt wanneer een overschrijving als betaald werd gemarkeerd, met daarin de tickets.",
                    }
                ]
            },
        ]
    }

    hasTemplate(type: EmailTemplateType) {
        return !!this.patchedTemplates.find(template => template.type === type && template.organizationId === this.organization.id)
    }

    editEmail(definition) {
        if (this.loading) {
            return
        }
        const type: EmailTemplateType = definition.type
        const existing = this.patchedTemplates.find(template => template.type === type && template.organizationId === this.organization.id)
        const defaultTemplate = this.patchedTemplates.find(template => template.type === type && template.organizationId === null)
        const template = existing ?? EmailTemplate.create({
            ...defaultTemplate,
            id: undefined,
            organizationId: this.organization.id,
            webshopId: this.webshopManager.preview.id,
            type
        })
        this.present({
            components: [
                new ComponentWithProperties(EditEmailTemplateView, {
                    template,
                    isNew: !existing,
                    webshop: this.webshopManager.preview,
                    smartVariables: this.getSmartVariables(EmailTemplate.getSupportedReplacementsForType(type)),
                    smartButtons: this.getSmartButtons(EmailTemplate.getSupportedReplacementsForType(type)),
                    defaultReplacements: this.organization.meta.getEmailReplacements(),
                    saveHandler: (patch: AutoEncoderPatchType<EmailTemplate>) => {
                        patch.id = template.id
                        if (existing) {
                            this.patchTemplates.addPatch(patch)
                        } else {
                            this.patchTemplates.addPut(template.patch(patch))
                        }
                    }
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    get hasChanges() {
        return this.patchTemplates.changes.length > 0
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    async save() {
        if (this.saving) {
            return
        }
        this.saving = true;

        try {
            const response = await this.$context.authenticatedServer.request({
                method: "PATCH",
                path: "/email-templates",
                body: this.patchTemplates,
                shouldRetry: false,
                owner: this,
                decoder: new ArrayDecoder(EmailTemplate as Decoder<EmailTemplate>)
            })
            for (const template of response.data) {
                const existing = this.templates.find(t => t.id === template.id)
                if (!existing) {
                    this.templates.push(template)
                } else {
                    existing.deepSet(template)
                }
            }
            this.dismiss({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.saving = false
    }

    get exampleOrder() {
        return Order.create({
            id: "",
            payment: Payment.create({
                id: "",
                method: PaymentMethod.Transfer,
                transferDescription: "+++111/111/111+++",
                price: 1500,
                transferSettings: this.webshopManager.preview.meta.transferSettings.fillMissing(this.organization.meta.transferSettings),
                createdAt: new Date(),
                updatedAt: new Date()
            }),
            webshopId: "",
            number: 15,
            data: OrderData.create({
                customer: Customer.create({
                    firstName: "John",
                    lastName: "Doe",
                    email: "john@example.com",
                    phone: "+32 479 45 71 52"
                }),
                timeSlot: WebshopTimeSlot.create({
                    date: new Date(),
                    startTime: 12 * 60,
                    endTime: 13 * 60,
                }),
                checkoutMethod: WebshopTakeoutMethod.create({
                    name: "Bakkerij",
                    address: Address.create({
                        street: "Demostraat",
                        number: "12",
                        postalCode: "9000",
                        city: "Gent",
                        country: Country.Belgium,
                    })
                }),
                address: ValidatedAddress.create({
                    street: "Demostraat",
                    number: "12",
                    postalCode: "9000",
                    city: "Gent",
                    country: Country.Belgium,
                    cityId: "",
                    parentCityId: null,
                    provinceId: ""
                }),
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product: Product.create({
                                name: "Voorbeeld product"
                            }),
                            productPrice: ProductPrice.create({
                                price: 550
                            }),
                            amount: 2,
                            calculatedPrices: [CartItemPrice.create({
                                price: 550
                            }), CartItemPrice.create({
                                price: 550
                            })]
                        }),
                        CartItem.create({
                            product: Product.create({
                                name: "Nog een voorbeeld product"
                            }),
                            productPrice: ProductPrice.create({
                                price: 400
                            }),
                            amount: 1,
                            calculatedPrices: [CartItemPrice.create({
                                price: 400
                            })]
                        })
                    ]
                }),
                paymentMethod: PaymentMethod.CreditCard,

            })
        })
    }

    getSmartVariables(filter: string[]) {
        const variables = [
            new EditorSmartVariable({
                id: "firstName", 
                name: "Voornaam", 
                example: "Brandon", 
                deleteMessage: "De voornaam van één of meerdere ontvangers ontbreekt in het systeem. De magische tekstvervanging voor de voornaam is daarom weggehaald."
            }),
            new EditorSmartVariable({
                id: "lastName", 
                name: "Achternaam", 
                example: "Stark", 
                deleteMessage: "De achternaam van één of meerdere ontvangers ontbreekt in het systeem. De magische tekstvervanging voor de achteraam is daarom weggehaald."
            }),
            new EditorSmartVariable({
                id: "email", 
                name: "E-mailadres", 
                example: "voorbeeld@email.com", 
            })
        ]

        //if (this.orders.length > 0) {
        variables.push(new EditorSmartVariable({
            id: "nr", 
            name: "Bestelnummer", 
            example: "15", 
        }))

        variables.push(new EditorSmartVariable({
            id: "orderPrice", 
            name: "Bestelbedrag", 
            example: "€ 15,00", 
        }))

        variables.push(new EditorSmartVariable({
            id: "orderStatus", 
            name: "Bestelstatus", 
            example: "Nieuw", 
        }))

        variables.push(new EditorSmartVariable({
            id: "orderDetailsTable", 
            name: "Tabel met bestelgegevens", 
            example: "order details table", 
            html: ""
        }))

        variables.push(new EditorSmartVariable({
            id: "orderTable", 
            name: "Tabel met bestelde artikels", 
            example: "order table", 
            html: ""
        }))

        variables.push(new EditorSmartVariable({
            id: "paymentTable", 
            name: "Tabel met betaalinstructies", 
            example: "payment table", 
            html: ""
        }))
        //}

        variables.push(new EditorSmartVariable({
            id: "paymentMethod", 
            name: "Betaalmethode", 
            example: "Bancontact", 
        }))

        variables.push(new EditorSmartVariable({
            id: "priceToPay", 
            name: "Te betalen bedrag", 
            example: "€ 15,00", 
        }))     

        variables.push(new EditorSmartVariable({
            id: "transferDescription", 
            name: "Mededeling (overschrijving)", 
            example: "+++111/111/111+++", 
        }))

        variables.push(new EditorSmartVariable({
            id: "transferBankAccount", 
            name: "Rekeningnummer (overschrijving)", 
            example: "BE1234 1234 1234", 
        }))

        variables.push(new EditorSmartVariable({
            id: "transferBankCreditor", 
            name: "Begunstigde (overschrijving)", 
            example: this.organization.name, 
        }))

        variables.push(new EditorSmartVariable({
            id: "organizationName", 
            name: "Naam vereniging", 
            example: this.organization.name, 
        }))

        variables.push(new EditorSmartVariable({
            id: "webshopName", 
            name: "Naam webshop", 
            example: ""
        }))

        // Fill examples
        const exampleOrder = this.exampleOrder
        const recipient = exampleOrder.getRecipient(this.organization, this.webshopManager.preview)
        for (const replacement of recipient.replacements) {
            const variable = variables.find(v => v.id === replacement.token)
            if (variable) {
                if (replacement.html && (variable.html === undefined || variable.html.length == 0)) {
                    variable.html = replacement.html
                }
                if (variable.html === undefined) {
                    variable.example = replacement.value
                }
            }
        }

        // TODO: determine based on the template type
        return variables.filter(v => filter.includes(v.id))
    }

    getSmartButtons(filter: string[]) {
        const buttons: EditorSmartButton[] = []
        /*if (this.hasAllUsers) {
            buttons.push(new EditorSmartButton({
                id: "signInUrl",
                name: "Knop om in te loggen",
                text: "Inschrijvingen beheren",
                hint: "Als gebruikers op deze knop klikken, zorgt het systeem ervoor dat ze inloggen of registreren op het juiste e-mailadres dat al in het systeem zit."
            }))
        }*/

        buttons.push(new EditorSmartButton({
            id: "orderUrl",
            name: "Knop naar bestelling",
            text: "Bestelling openen",
            hint: "Deze knop gaat naar het besteloverzicht, met alle informatie van de bestellingen en eventueel betalingsinstructies."
        }))

        // TODO: determine based on the template type
        return buttons.filter(v => filter.includes(v.id))
    }
}
</script>
