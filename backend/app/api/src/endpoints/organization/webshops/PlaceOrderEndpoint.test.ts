/* eslint-disable jest/expect-expect */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable jest/no-standalone-expect */
import { Request, Response } from "@simonbackx/simple-endpoints";
import { Organization, OrganizationFactory, StripeAccount, Token, User,UserFactory, Webshop, WebshopFactory } from "@stamhoofd/models";
import { Address, Cart, CartItem, CartItemOption, Country, Customer, Option, OptionMenu, OrderData, OrderResponse, PaymentConfiguration, PaymentMethod, PermissionLevel, Permissions, PrivatePaymentConfiguration, Product, ProductPrice, ProductType, SeatingPlan, SeatingPlanRow, SeatingPlanSeat, SeatingPlanSection, TransferSettings, WebshopDeliveryMethod, WebshopMetaData, WebshopOnSiteMethod, WebshopPrivateMetaData, WebshopTakeoutMethod, WebshopTimeSlot } from "@stamhoofd/structures";
import sinon from 'sinon';

import { StripeMocker } from "../../../../tests/helpers/StripeMocker";
import { testServer } from "../../../../tests/helpers/TestServer";
import { PatchWebshopOrdersEndpoint } from "../dashboard/webshops/PatchWebshopOrdersEndpoint";
import { PlaceOrderEndpoint } from './PlaceOrderEndpoint';

const address = Address.create({
    street: 'Demostraat',
    number: '15',
    postalCode: '9000',
    city: 'Gent',
    country: Country.Belgium
})

const customer = Customer.create({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '+32412345678'
});

describe("Endpoint.PlaceOrderEndpoint", () => {
    // Test endpoint
    const endpoint = new PlaceOrderEndpoint();
    const patchWebshopOrdersEndpoint = new PatchWebshopOrdersEndpoint();

    let organization: Organization;
    let webshop: Webshop;
    let product: Product;
    let seatProduct: Product;
    let personProduct: Product;
    let takeoutMethod: WebshopTakeoutMethod;
    let deliveryMethod: WebshopDeliveryMethod;
    let onSiteMethod: WebshopOnSiteMethod;
    let slot1: WebshopTimeSlot;
    let slot2: WebshopTimeSlot;
    let slot3: WebshopTimeSlot;
    let slot4: WebshopTimeSlot;

    let productPrice1: ProductPrice;
    let productPrice2: ProductPrice;
    let freeProductPrice: ProductPrice;
    let personProductPrice: ProductPrice;
    let seatProductPrice: ProductPrice;
    let seatingPlan: SeatingPlan;

    let multipleChoiceOptionMenu: OptionMenu;
    let chooseOneOptionMenu: OptionMenu;
    let checkboxOption1: Option;
    let checkboxOption2: Option;
    let radioOption1: Option;
    let radioOption2: Option;
    let stripeMocker: StripeMocker
    let stripeAccount: StripeAccount
    let token: Token;

    async function refreshAll() {
        webshop = (await Webshop.getByID(webshop.id))!;
        product = webshop.products.find(p => p.id == product.id)!;
        seatProduct = webshop.products.find(p => p.id == seatProduct.id)!;
        personProduct = webshop.products.find(p => p.id == personProduct.id)!;
        takeoutMethod = webshop.meta.checkoutMethods.find(m => m.id == takeoutMethod.id)! as WebshopTakeoutMethod;
        deliveryMethod = webshop.meta.checkoutMethods.find(m => m.id == deliveryMethod.id)! as WebshopDeliveryMethod;
        onSiteMethod = webshop.meta.checkoutMethods.find(m => m.id == onSiteMethod.id)! as WebshopOnSiteMethod;
        slot1 = takeoutMethod.timeSlots.timeSlots.find(s => s.id == slot1.id)!;
        slot2 = takeoutMethod.timeSlots.timeSlots.find(s => s.id == slot2.id)!;
        slot3 = deliveryMethod.timeSlots.timeSlots.find(s => s.id == slot3.id)!;
        slot4 = onSiteMethod.timeSlots.timeSlots.find(s => s.id == slot4.id)!;
        productPrice1 = product.prices.find(p => p.id == productPrice1.id)!;
        productPrice2 = product.prices.find(p => p.id == productPrice2.id)!;
        freeProductPrice = product.prices.find(p => p.id == freeProductPrice.id)!;
        multipleChoiceOptionMenu = product.optionMenus.find(m => m.id == multipleChoiceOptionMenu.id)!;
        chooseOneOptionMenu = product.optionMenus.find(m => m.id == chooseOneOptionMenu.id)!;
        checkboxOption1 = multipleChoiceOptionMenu.options.find(o => o.id == checkboxOption1.id)!;
        checkboxOption2 = multipleChoiceOptionMenu.options.find(o => o.id == checkboxOption2.id)!;
        radioOption1 = chooseOneOptionMenu.options.find(o => o.id == radioOption1.id)!;
        radioOption2 = chooseOneOptionMenu.options.find(o => o.id == radioOption2.id)!;
        personProductPrice = personProduct.prices.find(p => p.id == personProductPrice.id)!;
        seatProductPrice = seatProduct.prices.find(p => p.id == seatProductPrice.id)!;
        seatingPlan = webshop.meta.seatingPlans.find(s => s.id === seatingPlan.id)!;
    }

    /** Allows to change the stock */
    async function saveChanges() {
        // Set products
        webshop = (await Webshop.getByID(webshop.id))!;
        webshop.products = [product, seatProduct, personProduct]
        await webshop.save();
        await refreshAll();
    }

    beforeAll(async () => {
        stripeMocker = new StripeMocker();
        stripeMocker.start();
        organization = await new OrganizationFactory({}).create()
        stripeAccount = await stripeMocker.createStripeAccount(organization.id);

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full
            })
        }).create()
        token = await Token.createToken(user)
    });

    afterAll(() => {
        stripeMocker.stop();
        sinon.restore();
    });

    beforeEach(async () => {
        stripeMocker.reset();
        let meta = WebshopMetaData.patch({});

        productPrice1 = ProductPrice.create({
            name: 'productPrice1',
            price: 100,
            stock: 100
        })

        productPrice2 = ProductPrice.create({
            name: 'productPrice2',
            price: 150,
            stock: 100
        })

        freeProductPrice = ProductPrice.create({
            name: 'freeProductPrice',
            price: 0,
            stock: 100
        })

        checkboxOption1 = Option.create({
            name: 'checkboxOption1',
            price: 10,
            stock: 100
        })

        checkboxOption2 = Option.create({
            name: 'checkboxOption2',
            price: 0,
            stock: 100
        })

        radioOption1 = Option.create({
            name: 'radioOption1',
            price: 10,
            stock: 100
        })

        radioOption2 = Option.create({
            name: 'radioOption2',
            price: 0,
            stock: 100
        })

        multipleChoiceOptionMenu = OptionMenu.create({
            name: 'multipleChoiceOptionMenu',
            multipleChoice: true,
            options: [checkboxOption1, checkboxOption2]
        })

        chooseOneOptionMenu = OptionMenu.create({
            name: 'chooseOneOptionMenu',
            multipleChoice: false,
            options: [radioOption1, radioOption2]
        })

        product = Product.create({
            name: 'product',
            stock: 100,
            prices: [productPrice1, productPrice2, freeProductPrice],
            optionMenus: [multipleChoiceOptionMenu, chooseOneOptionMenu]
        })

        personProduct = Product.create({
            name: 'personProduct',
            type: ProductType.Person,
            stock: 100
        })
        personProductPrice = personProduct.prices[0]

        seatingPlan = SeatingPlan.create({
            name: 'Testzaal',
            sections: [
                SeatingPlanSection.create({
                    rows: [
                        SeatingPlanRow.create({
                            label: 'A',
                            seats: [
                                SeatingPlanSeat.create({
                                    label: '1'
                                }),
                                SeatingPlanSeat.create({
                                    label: '2'
                                }),
                                SeatingPlanSeat.create({
                                    label: '3'
                                }),
                                SeatingPlanSeat.create({
                                    label: '4'
                                })
                            ]
                        }),
                        SeatingPlanRow.create({
                            label: 'B',
                            seats: [
                                SeatingPlanSeat.create({
                                    label: '1'
                                }),
                                SeatingPlanSeat.create({
                                    label: '2'
                                }),
                                SeatingPlanSeat.create({
                                    label: '3'
                                }),
                                SeatingPlanSeat.create({
                                    label: '4'
                                })
                            ]
                        })
                    ]
                })
            ]
        })
        meta.seatingPlans.addPut(seatingPlan)

        seatProduct = Product.create({
            name: 'seatProduct',
            type: ProductType.Ticket,
            seatingPlanId: seatingPlan.id
        })
        seatProductPrice = seatProduct.prices[0]

        // Takeout
        takeoutMethod = WebshopTakeoutMethod.create({
            name: 'Bakkerij Test',
            address
        })

        slot1 = WebshopTimeSlot.create({
            date: new Date(),
            maxPersons: 100,
            maxOrders: 100
        });
        takeoutMethod.timeSlots.timeSlots.push(slot1)

        slot2 = WebshopTimeSlot.create({
            date: new Date(),
            maxPersons: 100,
            maxOrders: 100,
            startTime: 14*60,
            endTime: 15*60
        })
        takeoutMethod.timeSlots.timeSlots.push(slot2)
        meta.checkoutMethods.addPut(takeoutMethod)


        // Delivery
        deliveryMethod = WebshopDeliveryMethod.create({
            name: 'Delivery',
            countries: [Country.Belgium]
        })

        slot3 = WebshopTimeSlot.create({
            date: new Date(),
            maxPersons: 100,
            maxOrders: 100
        });

        deliveryMethod.timeSlots.timeSlots.push(slot3)
        meta.checkoutMethods.addPut(deliveryMethod)

        // OnSite
        onSiteMethod = WebshopOnSiteMethod.create({
            name: 'Onsite',
            address
        })

        slot4 = WebshopTimeSlot.create({
            date: new Date(),
            maxPersons: 100,
            maxOrders: 100
        });

        onSiteMethod.timeSlots.timeSlots.push(slot4)
        meta.checkoutMethods.addPut(onSiteMethod)
        
        const paymentConfigurationPatch = PaymentConfiguration.patch({
            transferSettings: TransferSettings.create({
                iban: 'BE56587127952688' // = random IBAN
            }),
        })
        paymentConfigurationPatch.paymentMethods.addPut(PaymentMethod.PointOfSale)
        paymentConfigurationPatch.paymentMethods.addPut(PaymentMethod.Transfer)
        paymentConfigurationPatch.paymentMethods.addPut(PaymentMethod.Bancontact)

        const privatePaymentConfiguration = PrivatePaymentConfiguration.patch({
            stripeAccountId: stripeAccount.id
        })

        meta = meta.patch({
            paymentConfiguration: paymentConfigurationPatch
        })

        const privateMeta = WebshopPrivateMetaData.patch({
            paymentConfiguration: privatePaymentConfiguration
        })

        webshop = await new WebshopFactory({
            organizationId: organization.id,
            name: 'Test webshop',
            meta,
            privateMeta,
            products: [product, seatProduct, personProduct]
        }).create()
    });

    describe('User authentication', () => {
        test("Placing an order with a signed in user overrides the order customer", async () => {
            const user = await new UserFactory({ organization, firstName: 'User', lastName: 'Tester' }).create()
            const token = await Token.createToken(user)

            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.Unknown,
                checkoutMethod: onSiteMethod,
                timeSlot: slot4,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product,
                            productPrice: freeProductPrice,
                            amount: 5,
                            options: [
                                CartItemOption.create({
                                    optionMenu: multipleChoiceOptionMenu,
                                    option: checkboxOption2
                                }),
                                CartItemOption.create({
                                    optionMenu: chooseOneOptionMenu,
                                    option: radioOption2
                                })
                            ]
                        })
                    ]
                }),
                customer
            })
            
            const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);
            r.headers.authorization = "Bearer " + token.accessToken

            const response = await testServer.test(endpoint, r);
            expect(response.body).toBeDefined();
            const order = response.body.order;

            expect(order.data.customer.email).toEqual(user.email);
            expect(order.data.customer.firstName).toEqual(user.firstName);
            expect(order.data.customer.lastName).toEqual(user.lastName);
        });

        /**
         * This checks if the authenticated context is passed when multiple orders are executed in a queue
         */
        test("Authenticated context is guarded with race conditions", async () => {
            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.Unknown,
                checkoutMethod: onSiteMethod,
                timeSlot: slot4,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product,
                            productPrice: freeProductPrice,
                            amount: 5,
                            options: [
                                CartItemOption.create({
                                    optionMenu: multipleChoiceOptionMenu,
                                    option: checkboxOption2
                                }),
                                CartItemOption.create({
                                    optionMenu: chooseOneOptionMenu,
                                    option: radioOption2
                                })
                            ]
                        })
                    ]
                }),
                customer
            })

            let counter = 0;
            let resolve: null | (() => void) = null;
            const hangingPromise = new Promise<void>((r) => {
                resolve = r;
            });

            const stub = sinon.stub(Webshop, 'getByID').callsFake(async function (...args) {
                counter += 1;

                if (counter === 1) {
                    setTimeout(() => {
                        // all waiting
                        resolve!();
                    }, 1000);
                }

                await hangingPromise;
                return stub.wrappedMethod.apply(this, args);
            });

            const pendingResponses: {promise: Promise<Response<OrderResponse>>, user: User}[] = []
            for (let i = 0; i < 10; i++) {
                const user = await new UserFactory({ organization, firstName: 'User', lastName: 'Tester' }).create()
                const token = await Token.createToken(user)

                const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);
                r.headers.authorization = "Bearer " + token.accessToken

                pendingResponses.push({
                    promise: testServer.test(endpoint, r),
                    user
                });
            }

            const responses = await Promise.all(pendingResponses.map(r => r.promise));

            for (const [index, response] of responses.entries()) {
                const user = pendingResponses[index].user;
                expect(response.body).toBeDefined();
                const order = response.body.order;

                expect(order.data.customer.email).toEqual(user.email);
                expect(order.data.customer.firstName).toEqual(user.firstName);
                expect(order.data.customer.lastName).toEqual(user.lastName);
            }
        });
    });
});
