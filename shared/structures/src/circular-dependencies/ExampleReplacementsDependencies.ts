import { Country } from '@stamhoofd/types/Country';
import { Formatter } from '@stamhoofd/utility';
import { Address, ValidatedAddress } from '../addresses/Address.js';
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
            price: 1500_00,
            transferSettings: TransferSettings.create({
                type: TransferDescriptionType.Structured,
                iban: 'BE1234 1234 1234',
                creditor: $t('%D'),
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
                name: $t(`%13P`),
                address: Address.create({
                    street: $t(`%13Q`),
                    number: '12',
                    postalCode: '9000',
                    city: $t(`%13R`),
                    country: Country.Belgium,
                }),
            }),
            address: ValidatedAddress.create({
                street: $t(`%13Q`),
                number: '12',
                postalCode: '9000',
                city: $t(`%13R`),
                country: Country.Belgium,
                cityId: '',
                parentCityId: null,
                provinceId: '',
            }),
            cart: Cart.create({
                items: [
                    CartItem.create({
                        product: Product.create({
                            name: $t(`%13S`),
                        }),
                        productPrice: ProductPrice.create({
                            price: 550_00,
                        }),
                        amount: 2,
                        calculatedPrices: [CartItemPrice.create({
                            price: 550_00,
                            amount: 2
                        })],
                    }),
                    CartItem.create({
                        product: Product.create({
                            name: $t(`%13T`),
                        }),
                        productPrice: ProductPrice.create({
                            price: 400_00,
                        }),
                        amount: 1,
                        calculatedPrices: [CartItemPrice.create({
                            price: 400_00,
                        })],
                    }),
                ],
            }),
            paymentMethod: PaymentMethod.CreditCard,

        }),
    });

    const recipient = exampleOrder.getEmailRecipient(Organization.create({
        name: $t('%D'),
        uri: 'demo',
        meta: OrganizationMetaData.create({
            type: OrganizationType.Other,
            defaultStartDate: new Date(),
            defaultEndDate: new Date(),
        }),
        address: Address.createDefault(Country.Belgium),
    }), WebshopPreview.create({
        meta: WebshopMetaData.create({
            name: $t('%Au'),
        }),
    }));

    const balance1 = BalanceItem.create({
        description: $t(`%13U`),
        unitPrice: 1234_00,
    });
    const balance2 = BalanceItem.create({
        description: $t(`%13V`),
        unitPrice: 1234_00,
        amount: 2,
    });

    const paymentGeneral = PaymentGeneral.create({
        method: PaymentMethod.Transfer,
        status: PaymentStatus.Pending,
        iban: 'BE1234 1234 1234',
        ibanName: $t(`%ID`),
        transferDescription: '+++111/111/111+++',
        transferSettings: TransferSettings.create({
            type: TransferDescriptionType.Structured,
            iban: 'BE1234 1234 1234',
            creditor: $t('%D'),
        }),
        price: 1234_00 + 2468_00,
        balanceItemPayments: [
            BalanceItemPaymentDetailed.create({
                price: 1234_00,
                balanceItem: balance1,
            }),
            BalanceItemPaymentDetailed.create({
                price: 2468_00,
                balanceItem: balance2,
            }),
        ],
    });

    const paymentReplacemnets = [
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
            token: 'overviewTable',
            html: paymentGeneral.getBalanceItemPaymentsHtmlTable(),
        }),
        Replacement.create({
            token: 'paymentPrice',
            value: Formatter.price(paymentGeneral.price),
        }),
        Replacement.create({
            token: 'paymentData',
            html: paymentGeneral.getPaymentDataHTMLTable(),
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
