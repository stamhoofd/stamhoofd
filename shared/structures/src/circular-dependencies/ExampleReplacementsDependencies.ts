import { Address, ValidatedAddress } from '../addresses/Address';
import { Country } from '../addresses/CountryDecoder';
import { ExampleReplacements } from '../email/exampleReplacements';
import { Replacement } from '../endpoints/EmailRequest';
import { Payment } from '../members/Payment';
import { Organization } from '../Organization';
import { OrganizationMetaData } from '../OrganizationMetaData';
import { OrganizationType } from '../OrganizationType';
import { PaymentMethod } from '../PaymentMethod';
import { Cart } from '../webshops/Cart';
import { CartItem, CartItemPrice } from '../webshops/CartItem';
import { Customer } from '../webshops/Customer';
import { Order, OrderData } from '../webshops/Order';
import { Product, ProductPrice } from '../webshops/Product';
import { TransferSettings, TransferDescriptionType } from '../webshops/TransferSettings';
import { WebshopPreview } from '../webshops/Webshop';
import { WebshopTimeSlot, WebshopTakeoutMethod, WebshopMetaData } from '../webshops/WebshopMetaData';

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
                creditor: 'Demovereniging',
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
                name: 'Bakkerij',
                address: Address.create({
                    street: 'Demostraat',
                    number: '12',
                    postalCode: '9000',
                    city: 'Gent',
                    country: Country.Belgium,
                }),
            }),
            address: ValidatedAddress.create({
                street: 'Demostraat',
                number: '12',
                postalCode: '9000',
                city: 'Gent',
                country: Country.Belgium,
                cityId: '',
                parentCityId: null,
                provinceId: '',
            }),
            cart: Cart.create({
                items: [
                    CartItem.create({
                        product: Product.create({
                            name: 'Voorbeeld product',
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
                            name: 'Nog een voorbeeld product',
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
        name: 'Demovereniging',
        uri: 'demo',
        meta: OrganizationMetaData.create({
            type: OrganizationType.Other,
            defaultStartDate: new Date(),
            defaultEndDate: new Date(),
        }),
        address: Address.createDefault(Country.Belgium),
    }), WebshopPreview.create({
        meta: WebshopMetaData.create({
            name: 'Demowinkel',
        }),
    }));

    for (const replacement of [...recipient.replacements, ...recipient.getDefaultReplacements()]) {
        const variable = replacements.find(v => v.token === replacement.token);
        if (variable) {
            variable.value = replacement.value;
            variable.html = replacement.html;
        }
    }
}

fillReplacements(Object.values(ExampleReplacements));
