import { Formatter } from '@stamhoofd/utility';
import { Address, ValidatedAddress } from '../addresses/Address.js';
import { Country } from '../addresses/CountryDecoder.js';
import { BalanceItem } from '../BalanceItem.js';
import { BalanceItemPaymentDetailed } from '../BalanceItemDetailed.js';
import { injectReplacementValues } from '../email/exampleReplacements.js';
import { Replacement } from '../endpoints/EmailRequest.js';
import { Payment } from '../members/Payment.js';
import { PaymentGeneral } from '../members/PaymentGeneral.js';
import { Organization } from '../Organization.js';
import { OrganizationMetaData } from '../OrganizationMetaData.js';
import { OrganizationType } from '../OrganizationType.js';
import { PaymentMethod } from '../PaymentMethod.js';
import { PaymentStatus } from '../PaymentStatus.js';
import { Cart } from '../webshops/Cart.js';
import { CartItem, CartItemPrice } from '../webshops/CartItem.js';
import { Customer } from '../webshops/Customer.js';
import { Order, OrderData } from '../webshops/Order.js';
import { Product, ProductPrice } from '../webshops/Product.js';
import { TransferDescriptionType, TransferSettings } from '../webshops/TransferSettings.js';
import { WebshopPreview } from '../webshops/Webshop.js';
import { WebshopMetaData, WebshopTakeoutMethod, WebshopTimeSlot } from '../webshops/WebshopMetaData.js';

injectReplacementValues(fillReplacements);
function fillReplacements(replacements: Replacement[]) {
    const exampleOrder = Order.create({
        id: '',
        payment: Payment.create({
            id: '',
            method: PaymentMethod.Transfer,
            transferDescription: '+++111/111/111+++',
            price: 1500,
            transferSettings: TransferSettings.create({
                type: TransferDescriptionType.Structured,
                iban: 'BE1234 1234 1234',
                creditor: $t('16ba3d97-5943-451d-92b5-0bf21555f7ae'),
            }),
            createdAt: new Date(),
            updatedAt: new Date(),
        }),
        webshopId: '',
        number: 15,
        data: OrderData.create({
            customer: Customer.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                phone: '+32 479 45 71 52',
            }),
            timeSlot: WebshopTimeSlot.create({
                date: new Date(),
                startTime: 12 * 60,
                endTime: 13 * 60,
            }),
            checkoutMethod: WebshopTakeoutMethod.create({
                name: $t(`7214779f-7c97-49af-b7b9-b6424a1b2903`),
                address: Address.create({
                    street: $t(`424566d8-a5ec-4cf8-af8b-6ed49a4a1920`),
                    number: '12',
                    postalCode: '9000',
                    city: $t(`863c5b6c-dbed-4b55-bbd7-2e99e15dba5e`),
                    country: Country.Belgium,
                }),
            }),
            address: ValidatedAddress.create({
                street: $t(`424566d8-a5ec-4cf8-af8b-6ed49a4a1920`),
                number: '12',
                postalCode: '9000',
                city: $t(`863c5b6c-dbed-4b55-bbd7-2e99e15dba5e`),
                country: Country.Belgium,
                cityId: '',
                parentCityId: null,
                provinceId: '',
            }),
            cart: Cart.create({
                items: [
                    CartItem.create({
                        product: Product.create({
                            name: $t(`feb79403-3266-47de-9e27-55122bc0c881`),
                        }),
                        productPrice: ProductPrice.create({
                            price: 550,
                        }),
                        amount: 2,
                        calculatedPrices: [CartItemPrice.create({
                            price: 550,
                        }), CartItemPrice.create({
                            price: 550,
                        })],
                    }),
                    CartItem.create({
                        product: Product.create({
                            name: $t(`d93000f0-cb13-4756-a6ac-961950efb25c`),
                        }),
                        productPrice: ProductPrice.create({
                            price: 400,
                        }),
                        amount: 1,
                        calculatedPrices: [CartItemPrice.create({
                            price: 400,
                        })],
                    }),
                ],
            }),
            paymentMethod: PaymentMethod.CreditCard,

        }),
    });

    const recipient = exampleOrder.getEmailRecipient(Organization.create({
        name: $t('16ba3d97-5943-451d-92b5-0bf21555f7ae'),
        uri: 'demo',
        meta: OrganizationMetaData.create({
            type: OrganizationType.Other,
            defaultStartDate: new Date(),
            defaultEndDate: new Date(),
        }),
        address: Address.createDefault(Country.Belgium),
    }), WebshopPreview.create({
        meta: WebshopMetaData.create({
            name: $t('a17cab0f-62f8-4403-8436-c649f578196f'),
        }),
    }));

    const balance1 = BalanceItem.create({
        description: $t(`260c4ef6-413c-45c9-9f59-6aee4e67a848`),
        unitPrice: 1234,
    });
    const balance2 = BalanceItem.create({
        description: $t(`e7e960cc-94aa-42c1-b476-8a8ad67512f3`),
        unitPrice: 1234,
        amount: 2,
    });

    const paymentGeneral = PaymentGeneral.create({
        method: PaymentMethod.Transfer,
        status: PaymentStatus.Pending,
        iban: 'BE1234 1234 1234',
        ibanName: $t(`fbe32760-d352-4d3d-813c-acd50f3cba50`),
        transferDescription: '+++111/111/111+++',
        transferSettings: TransferSettings.create({
            type: TransferDescriptionType.Structured,
            iban: 'BE1234 1234 1234',
            creditor: $t('16ba3d97-5943-451d-92b5-0bf21555f7ae'),
        }),
        price: 1234 + 2468,
        balanceItemPayments: [
            BalanceItemPaymentDetailed.create({
                price: 1234,
                balanceItem: balance1,
            }),
            BalanceItemPaymentDetailed.create({
                price: 2468,
                balanceItem: balance2,
            }),
        ],
    });

    const paymentReplacemnets = [
        Replacement.create({
            token: 'overviewTable',
            value: '',
            html: paymentGeneral.getDetailsHTMLTable(),
        }),
        Replacement.create({
            token: 'paymentTable',
            value: '',
            html: paymentGeneral.getHTMLTable(),
        }),
        Replacement.create({
            token: 'balanceTable',
            value: '',
            html: BalanceItem.getDetailsHTMLTable([
                balance1,
                balance2,
            ]),
        }),
        Replacement.create({
            token: 'balanceItemPaymentsTable',
            html: paymentGeneral.getBalanceItemPaymentsHtmlTable(),
        }),
        Replacement.create({
            token: 'paymentPrice',
            value: Formatter.price(paymentGeneral.price),
        }),
    ];

    for (const replacement of [...recipient.replacements, ...recipient.getDefaultReplacements(), ...paymentReplacemnets]) {
        const variable = replacements.find(v => v.token === replacement.token);
        if (variable) {
            if (replacement.value) {
                variable.value = replacement.value;
            }
            if (replacement.html) {
                variable.html = replacement.html;
            }
        }
    }
}
