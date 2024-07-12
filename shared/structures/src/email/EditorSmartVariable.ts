import { AutoEncoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { Replacement } from "../endpoints/EmailRequest";
import { Organization } from "../Organization";
import { OrganizationMetaData } from "../OrganizationMetaData";
import { OrganizationType } from "../OrganizationType";
import { PaymentMethod } from "../PaymentMethod";
import { Address, ValidatedAddress } from "../addresses/Address";
import { Country } from "../addresses/CountryDecoder";
import { Payment } from "../members/Payment";
import { Cart } from "../webshops/Cart";
import { CartItem, CartItemPrice } from "../webshops/CartItem";
import { Customer } from "../webshops/Customer";
import { Order, OrderData } from "../webshops/Order";
import { Product, ProductPrice } from "../webshops/Product";
import { TransferSettings, TransferDescriptionType } from "../webshops/TransferSettings";
import { WebshopPreview } from "../webshops/Webshop";
import { WebshopTimeSlot, WebshopTakeoutMethod, WebshopMetaData } from "../webshops/WebshopMetaData";
import { Formatter } from "@stamhoofd/utility";
import { STPackageType, STPackageTypeHelper } from "../billing/STPackage";
import { PaymentDetailed } from "../members/PaymentDetailed";
import { Group } from "../Group";
import { GroupSettings } from "../GroupSettings";
import { Member } from "../members/Member";
import { MemberDetails } from "../members/MemberDetails";
import { RegistrationWithMember } from "../members/RegistrationWithMember";

export class EditorSmartVariable extends AutoEncoder {
    @field({ decoder: StringDecoder})
    id: string;

    @field({ decoder: StringDecoder})
    name: string;

    @field({ decoder: StringDecoder, nullable: true})
    description: string | null = null;

    @field({ decoder: StringDecoder})
    example: string;

    @field({ decoder: StringDecoder, optional: true})
    html?: string;

    @field({ decoder: StringDecoder, optional: true})
    deleteMessage?: string

    @field({ decoder: StringDecoder, optional: true})
    hint?: string;

    getJSONContent() {
        return { type: this.html ? "smartVariableBlock" : "smartVariable", attrs: { id: this.id } }
    }

    static forRecipient(recipient: {replacements: Replacement[]}) {
        return this.all.map(v => v.clone()).filter(variable => {
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
            return true
        })
    }

    static get all() {
        const exampleRegistrationPayment = PaymentDetailed.create({
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
                    organizationId: '',
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
                    organizationId: '',
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

        const variables = [
            EditorSmartVariable.create({
                id: "firstName", 
                name: "Voornaam", 
                example: "", 
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
            html: exampleRegistrationPayment.getDetailsHTMLTable()
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
            example: "Inschrijving van John en Jane", 
        }))

        variables.push(EditorSmartVariable.create({
            id: "memberNames", 
            name: "Naam leden", 
            example: exampleRegistrationPayment.getMemberNames()
        }))

        variables.push(EditorSmartVariable.create({
            id: "organizationName", 
            name: "Naam vereniging", 
            example: "Demovereniging", 
        }))

        variables.push(EditorSmartVariable.create({
            id: "webshopName", 
            name: "Naam webshop", 
            example: ""
        }))

        variables.push(EditorSmartVariable.create({
            id: "validUntil", 
            name: "Geldig tot", 
            example: Formatter.dateTime(new Date()), 
        }))

        variables.push(EditorSmartVariable.create({
            id: "validUntilDate", 
            name: "Geldig tot (datum)", 
            example: Formatter.date(new Date()), 
        }))

        variables.push(EditorSmartVariable.create({
            id: "packageName", 
            name: "Pakketnaam", 
            example: STPackageTypeHelper.getName(STPackageType.Members), 
        }))

        fillSmartVariables(variables)

        return variables
    }
}


function fillSmartVariables(variables: EditorSmartVariable[]) {
    const exampleOrder = Order.create({
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
}
