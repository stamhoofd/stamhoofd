<template>
    <div class="st-view">
        <STNavigationBar :title="viewTitle" />
        <main>
            <h1>{{ viewTitle }}</h1>
            <p>Dit zijn de automatische e-mails die verstuurd worden. Je kan de inhoud hier wijzigen.</p>

            <STErrorsDefault :error-box="errorBox" />

            <STList>
                <STListItem v-for="tt in templateTypes" :key="tt" :selectable="true" class="right-stack" @click="editEmail(tt)">
                    <h2 class="style-title-list">
                        {{ tt }}
                    </h2>
                    <p v-if="getTemplate(tt)" class="style-description">
                        {{ getTemplate(tt)!.subject }}
                    </p>

                    <template #right>
                        <span v-if="!hasTemplate(tt)" class="style-tag warn">Geen</span>
                        <span v-else class="style-tag">{{ formatDateTime(getTemplate(tt)!.updatedAt) }}</span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { CenteredMessage, EditEmailTemplateView, EditorSmartButton, EditorSmartVariable, ErrorBox, SaveView, STErrorsDefault, STList, STListItem, STNavigationBar, Toast } from "@stamhoofd/components";
import { UrlHelper } from "@stamhoofd/networking";
import { Address, Cart, CartItem, CartItemPrice, Country, Customer, EmailTemplate, EmailTemplateType, Group, GroupSettings, Member, MemberDetails, Order, OrderData, Organization, OrganizationMetaData, OrganizationType, Payment, PaymentDetailed, PaymentMethod, Product, ProductPrice, RegistrationWithMember, Replacement, STPackageType, STPackageTypeHelper, TransferDescriptionType, TransferSettings, ValidatedAddress, WebshopMetaData, WebshopPreview, WebshopTakeoutMethod, WebshopTimeSlot } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

import { AdminSession } from "../../classes/AdminSession";

@Component({
    components: {
        STListItem,
        STList,
        STErrorsDefault,
        SaveView,
        STNavigationBar
    }
})
export default class EditEmailTemplatesView extends Mixins(NavigationMixin) {

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
            const response = await AdminSession.shared.authenticatedServer.request({
                method: "GET",
                path: "/email-templates",
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
        UrlHelper.setUrl("/settings/email-templates")    
        document.title = "E-mailtemplates - Stamhoofd"
        this.loadTemplates().catch(console.error)
    }

    beforeUnmount() {
        Request.cancelAll(this)
    }

    get viewTitle() {
        return "Wijzig automatische e-mails"
    }

    hasTemplate(type: EmailTemplateType) {
        return !!this.getTemplate(type)
    }

    getTemplate(type: EmailTemplateType) {
        return this.patchedTemplates.find(template => template.type === type)
    }

    get templateTypes() {
        return [...Object.values(EmailTemplateType)]
    }

    editEmail(type: EmailTemplateType) {
        if (this.loading) {
            return
        }
        const existing = this.patchedTemplates.find(template => template.type === type && template.organizationId === null)
        const template = existing ?? EmailTemplate.create({
            id: undefined,
            organizationId: null,
            webshopId: null,
            type
        })

        this.present({
            components: [
                new ComponentWithProperties(EditEmailTemplateView, {
                    template,
                    isNew: !existing,
                    smartVariables: this.getSmartVariables(EmailTemplate.getSupportedReplacementsForType(type)),
                    smartButtons: this.getSmartButtons(EmailTemplate.getSupportedReplacementsForType(type)),
                    defaultReplacements: [
                        Replacement.create({
                            token: "primaryColor",
                            value: "#000"
                        }),
                        Replacement.create({
                            token: "primaryColorContrast",
                            value: "#fff"
                        }),
                    ],
                    saveHandler: async (patch: AutoEncoderPatchType<EmailTemplate>) => {
                        patch.id = template.id
                        if (existing) {
                            this.patchTemplates.addPatch(patch)
                        } else {
                            this.patchTemplates.addPut(template.patch(patch))
                        }
                        await this.save()
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
        const response = await AdminSession.shared.authenticatedServer.request({
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
                existing.set(template)
            }
        }
        this.patchTemplates = new PatchableArray()
    }

    get exampleRegistrationPayment() {
        return PaymentDetailed.create({
            id: "",
            method: PaymentMethod.Transfer,
            transferDescription: "+++111/111/111+++",
            price: 1500,
            transferSettings: TransferSettings.create({
                type: TransferDescriptionType.Structured,
                iban: "BE1234 1234 1234",
                creditor: "Demovereniging"
            }),
            createdAt: new Date(),
            updatedAt: new Date(),
            registrations: [
                RegistrationWithMember.create({
                    member: Member.create({
                        details: MemberDetails.create({
                            firstName: 'John',
                            lastName: 'Doe'
                        })
                    }),
                    group: Group.create({
                        settings: GroupSettings.create({
                            name: "Kapoenen",
                            startDate: new Date(),
                            endDate: new Date(),
                            registrationStartDate: new Date(),
                            registrationEndDate: new Date(),
                            minAge: 6,
                            maxAge: 7
                        })
                    }),
                    groupId: '',
                    cycle: 0,
                }),
                RegistrationWithMember.create({
                    member: Member.create({
                        details: MemberDetails.create({
                            firstName: 'Jane',
                            lastName: 'Doe'
                        })
                    }),
                    group: Group.create({
                        settings: GroupSettings.create({
                            name: "Kapoenen",
                            startDate: new Date(),
                            endDate: new Date(),
                            registrationStartDate: new Date(),
                            registrationEndDate: new Date(),
                            minAge: 6,
                            maxAge: 7
                        })
                    }),
                    groupId: '',
                    cycle: 0,
                })
            ]
        });
    }

    get exampleOrder() {
        return Order.create({
            id: "",
            payment: Payment.create({
                id: "",
                method: PaymentMethod.Transfer,
                transferDescription: "+++111/111/111+++",
                price: 1500,
                transferSettings: TransferSettings.create({
                    type: TransferDescriptionType.Structured,
                    iban: "BE1234 1234 1234",
                    creditor: "Demovereniging"
                }),
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
            }),
            new EditorSmartVariable({
                id: "mailDomain", 
                name: "E-maildomeinnaam", 
                example: "vereniging.com", 
            }),
            new EditorSmartVariable({
                id: "registerUrl", 
                name: "Inschrijvingsportaal link", 
                example: "https://inschrijven.mijnvereniging.be", 
            }),
            new EditorSmartVariable({
                id: "groupName", 
                name: "Groepnaam", 
                example: "Kapoenen", 
            }),

            new EditorSmartVariable({
                id: "loginDetails",
                name: "Inloggegevens", 
                example: '',
                html: `<p class="description"><em>Je kan op het ledenportaal inloggen met <strong>${Formatter.escapeHtml('voorbeeld@email.com')}</strong></em></p>`,
                hint: "Deze tekst wijzigt afhankelijk van de situatie: als de ontvanger nog geen account heeft, vertelt het op welk e-mailadres de ontvanger kan registreren. In het andere geval op welk e-mailadres de ontvanger kan inloggen."
            }),
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
            id: "overviewTable", 
            name: "Tabel met betaalde items", 
            example: "overview table", 
            html: this.exampleRegistrationPayment.getDetailsHTMLTable()
        }))

        variables.push(new EditorSmartVariable({
            id: "overviewContext", 
            name: "Context betaling", 
            example: "Inschrijving van John en Jane"
        }))

        variables.push(new EditorSmartVariable({
            id: "memberNames", 
            name: "Naam leden", 
            example: this.exampleRegistrationPayment.getMemberNames()
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
            example: "Demovereniging", 
        }))

        variables.push(new EditorSmartVariable({
            id: "organizationName", 
            name: "Naam vereniging", 
            example: "Demovereniging", 
        }))

        variables.push(new EditorSmartVariable({
            id: "webshopName", 
            name: "Naam webshop", 
            example: ""
        }))

        variables.push(new EditorSmartVariable({
            id: "validUntil", 
            name: "Geldig tot", 
            example: Formatter.dateTime(new Date()), 
        }))

        variables.push(new EditorSmartVariable({
            id: "validUntilDate", 
            name: "Geldig tot (datum)", 
            example: Formatter.date(new Date()), 
        }))

        variables.push(new EditorSmartVariable({
            id: "packageName", 
            name: "Pakketnaam", 
            example: STPackageTypeHelper.getName(STPackageType.Members), 
        }))

        // Fill examples
        const exampleOrder = this.exampleOrder
        const recipient = exampleOrder.getRecipient(Organization.create({
            name: "Demovereniging",
            uri: "demo",
            meta: OrganizationMetaData.create({
                type: OrganizationType.Other,
                defaultStartDate: new Date(),
                defaultEndDate: new Date(),
            }),
            address: Address.createDefault(Country.Belgium),
        }), WebshopPreview.create({
            meta: WebshopMetaData.create({
                name: "Demowinkel"
            })
        }))
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
        buttons.push(new EditorSmartButton({
            id: "signInUrl",
            name: "Knop om in te loggen",
            text: "Open ledenportaal",
            hint: "Als gebruikers op deze knop klikken, zorgt het systeem ervoor dat ze inloggen of registreren op het juiste e-mailadres dat al in het systeem zit."
        }))

        buttons.push(new EditorSmartButton({
            id: "renewUrl",
            name: "Knop naar pakketten",
            text: "Verlengen",
            hint: "Deze knop gaat naar het instellingen scherm van de pakketten."
        }))

        buttons.push(new EditorSmartButton({
            id: "unsubscribeUrl",
            name: "Knop om uit te schrijven",
            text: "Uitschrijven",
            hint: "Met deze knop kan de ontvanger uitschrijven van alle e-mails.",
            type: 'inline'
        }))

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
