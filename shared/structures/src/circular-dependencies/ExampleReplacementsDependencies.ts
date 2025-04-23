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
import { TransferSettings, TransferDescriptionType } from '../webshops/TransferSettings.js';
import { WebshopPreview } from '../webshops/Webshop.js';
import { WebshopTimeSlot, WebshopTakeoutMethod, WebshopMetaData } from '../webshops/WebshopMetaData.js';

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
                name: $t(`Bakkerij`),
                address: Address.create({
                    street: $t(`Demostraat`),
                    number: '12',
                    postalCode: '9000',
                    city: $t(`Gent`),
                    country: Country.Belgium,
                }),
            }),
            address: ValidatedAddress.create({
                street: $t(`Demostraat`),
                number: '12',
                postalCode: '9000',
                city: $t(`Gent`),
                country: Country.Belgium,
                cityId: '',
                parentCityId: null,
                provinceId: '',
            }),
            cart: Cart.create({
                items: [
                    CartItem.create({
                        product: Product.create({
                            name: $t(`Voorbeeld product`),
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
                            name: $t(`Nog een voorbeeld product`),
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
        description: $t(`Voorbeeld betaallijn 1`),
        unitPrice: 1234,
    });
    const balance2 = BalanceItem.create({
        description: $t(`Voorbeeld betaallijn 2`),
        unitPrice: 1234,
        amount: 2,
    });

    const paymentGeneral = PaymentGeneral.create({
        method: PaymentMethod.Transfer,
        status: PaymentStatus.Pending,
        iban: 'BE1234 1234 1234',
        ibanName: $t(`Voorbeeld`),
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
