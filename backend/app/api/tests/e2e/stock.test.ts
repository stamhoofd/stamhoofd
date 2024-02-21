/* eslint-disable jest/expect-expect */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable jest/no-standalone-expect */
import { PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-endpoints";
import { Order, Organization, OrganizationFactory, StripeAccount, Token, UserFactory, Webshop, WebshopFactory } from "@stamhoofd/models";
import { Address, Cart, CartItem, CartItemOption, CartReservedSeat, Country, Customer, Option, OptionMenu, OrderData, OrderStatus, PaymentConfiguration, PaymentMethod, PermissionLevel, Permissions, PrivateOrder, PrivatePaymentConfiguration, Product, ProductPrice, ProductType, ReservedSeat, SeatingPlan, SeatingPlanRow, SeatingPlanSeat, SeatingPlanSection, TransferSettings, ValidatedAddress, WebshopDeliveryMethod, WebshopMetaData, WebshopOnSiteMethod, WebshopPrivateMetaData, WebshopTakeoutMethod, WebshopTimeSlot } from "@stamhoofd/structures";
import { v4 as uuidv4 } from "uuid";

import { PatchWebshopOrdersEndpoint } from "../../src/endpoints/webshops/manage/PatchWebshopOrdersEndpoint";
import { PlaceOrderEndpoint } from '../../src/endpoints/webshops/PlaceOrderEndpoint';
import { StripeMocker } from "../helpers/StripeMocker";

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

describe("E2E.Stock", () => {
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

    async function refreshCartItems(orderId: string, cartItems: CartItem[]): Promise<Order> {
        const order = (await Order.getByID(orderId))!;

        for (const item of cartItems) {
            const i = order.data.cart.items.find(i => i.id == item.id)!;
            if (i) {
                item.set(i);
            }
        }
        return order;
    }

    async function checkStocks(orderIds: string[], cartItems: CartItem[], excludedCartItems: CartItem[] = []) {
        await refreshAll();
        const orders: Order[] = [];
        for (const orderId of orderIds) {
            orders.push(await refreshCartItems(orderId, [...cartItems, ...excludedCartItems]));
        }

        const products = [product, seatProduct, personProduct];
        for (const product of products) {
            let used = 0;
            const seats: ReservedSeat[] = []

            for (const item of cartItems) {
                if (item.product.id == product.id) {
                    used += item.amount;
                    // All seats should be reserved
                    expect(item.reservedSeats).toIncludeSameMembers(item.seats);
                    seats.push(...item.seats.map(s => ReservedSeat.create(s)));
                }
            }
            expect(product.usedStock).toBe(used);
            expect(product.reservedSeats.length).toBe(seats.length);
            expect(product.reservedSeats).toIncludeSameMembers(seats);
        }

        const productPrices = [productPrice1, productPrice2, freeProductPrice, personProductPrice];
        for (const price of productPrices) {
            let used = 0;
            for (const item of cartItems) {
                if (item.productPrice.id == price.id) {
                    used += item.amount;
                }
            }
            expect(price.usedStock).toBe(used);
        }

        const options = [checkboxOption1, checkboxOption2, radioOption1, radioOption2];
        for (const option of options) {
            let used = 0;
            for (const item of cartItems) {
                for (const o of item.options) {
                    if (o.option.id == option.id) {
                        used += item.amount;
                    }
                }
            }
            expect(option.usedStock).toBe(used);
        }

        // Now check reserved for each item
        for (const item of cartItems) {
            expect(item.reservedAmount).toBe(item.amount);
            
            for (const price of productPrices) {
                if (item.productPrice.id == price.id) {
                    expect(item.reservedPrices.get(price.id)).toBe(item.amount);
                } else {
                    expect(item.reservedPrices.get(price.id) ?? 0).toBe(0);
                }
            }

            for (const option of options) {
                let reserved = 0;
                for (const o of item.options) {
                    if (o.option.id == option.id) {
                        reserved += item.amount;
                    }
                }
                expect(item.reservedOptions.get(option.id) ?? 0).toBe(reserved);
            }
        }

        for (const item of excludedCartItems) {
            expect(item.reservedAmount).toBe(0);
            expect(item.reservedSeats.length).toBe(0);
            
            for (const price of productPrices) {
                expect(item.reservedPrices.get(price.id) ?? 0).toBe(0);
            }

            for (const option of options) {
                expect(item.reservedOptions.get(option.id) ?? 0).toBe(0);
            }
        }

        // Check order stock
        for (const order of orders) {
            const filteredItems = cartItems.filter(i => !!order.data.cart.items.find(c => c.id === i.id))
            let persons = 0;
            for (const item of filteredItems) {
                if (item.product.type === ProductType.Person) {
                    persons += item.amount;
                }
            }
            expect(order.data.reservedPersons).toBe(persons);
            expect(order.data.reservedOrder).toBe(filteredItems.length > 0);
        }

        const timeslots = [slot1, slot2, slot3, slot4];
        for (const slot of timeslots) {
            let ordersCount = 0;
            let personsCount = 0;

            for (const order of orders) {
                if (order.data.timeSlot?.id === slot.id) {
                    let persons = 0;
                    const filteredItems = cartItems.filter(i => !!order.data.cart.items.find(c => c.id === i.id))

                    for (const item of filteredItems) {
                        if (item.product.type === ProductType.Person) {
                            persons += item.amount;
                        }
                    }

                    ordersCount += filteredItems.length > 0 ? 1 : 0
                    personsCount += persons;
                }
            }

            expect(slot.usedOrders).toBe(ordersCount);
            expect(slot.usedPersons).toBe(personsCount);
        }

        return orders;
    }

    async function checkStock(orderId: string, cartItems: CartItem[], excludedCartItems: CartItem[] = []) {
        const otherOrders = (await Order.where({webshopId: webshop.id})).filter(o => o.id !== orderId)
        return (await checkStocks([orderId, ...otherOrders.map(o => o.id)], [...cartItems, ...otherOrders.flatMap(o => o.data.cart.items)], excludedCartItems))[0]!
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

    describe('Reserving stock', () => {
        test("Online payments reserve the stock and remain if they succeed", async () => {
            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.Bancontact,
                checkoutMethod: onSiteMethod,
                timeSlot: slot4,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product,
                            productPrice: productPrice2,
                            amount: 5,
                            options: [
                                CartItemOption.create({
                                    optionMenu: multipleChoiceOptionMenu,
                                    option: checkboxOption1
                                }),
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

            const response = await endpoint.test(r);
            expect(response.body).toBeDefined();
            const order = response.body.order;

            await checkStock(order.id, order.data.cart.items);

            // Cancel the payment
            await stripeMocker.succeedPayment(stripeMocker.getLastIntent())

            const updatedOrder = await checkStock(order.id, order.data.cart.items);
            expect(updatedOrder.status).toBe(OrderStatus.Created);
            expect(updatedOrder.number).toBeDefined();
        });

        test("Online payments do not reserve the stock if creation fails", async () => {
            stripeMocker.forceFailure();
            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.Bancontact,
                checkoutMethod: onSiteMethod,
                timeSlot: slot4,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product,
                            productPrice: productPrice2,
                            amount: 5,
                            options: [
                                CartItemOption.create({
                                    optionMenu: multipleChoiceOptionMenu,
                                    option: checkboxOption1
                                }),
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

            await expect(endpoint.test(r)).toReject();
            await checkStocks([], []);
        });

        test("Free payments reserve the stock", async () => {
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

            const response = await endpoint.test(r);
            expect(response.body).toBeDefined();
            const order = response.body.order;

            await checkStock(order.id, order.data.cart.items);
        });

        test("Transfer payments reserve the stock", async () => {
            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.Transfer,
                checkoutMethod: onSiteMethod,
                timeSlot: slot4,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product,
                            productPrice: productPrice2,
                            amount: 5,
                            options: [
                                CartItemOption.create({
                                    optionMenu: multipleChoiceOptionMenu,
                                    option: checkboxOption1
                                }),
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

            const response = await endpoint.test(r);
            expect(response.body).toBeDefined();
            const order = response.body.order;

            await checkStock(order.id, order.data.cart.items);
        });

        test("Transfer payments do not reserve the stock if iban is missing and throws on validating", async () => {
            webshop.meta.paymentConfiguration.transferSettings.iban = null;
            await webshop.save();
            
            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.Transfer,
                checkoutMethod: onSiteMethod,
                timeSlot: slot4,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product,
                            productPrice: productPrice2,
                            amount: 5,
                            options: [
                                CartItemOption.create({
                                    optionMenu: multipleChoiceOptionMenu,
                                    option: checkboxOption1
                                }),
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

            await expect(endpoint.test(r)).rejects.toThrow('Missing IBAN');
            await checkStocks([], []);
        });

        test("POS payments reserve the stock", async () => {
            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.PointOfSale,
                checkoutMethod: takeoutMethod,
                timeSlot: slot1,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product,
                            productPrice: productPrice1,
                            amount: 5,
                            options: [
                                CartItemOption.create({
                                    optionMenu: multipleChoiceOptionMenu,
                                    option: checkboxOption2
                                }),
                                CartItemOption.create({
                                    optionMenu: chooseOneOptionMenu,
                                    option: radioOption1
                                })
                            ]
                        })
                    ]
                }),
                customer
            })
            
            const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);

            const response = await endpoint.test(r);
            expect(response.body).toBeDefined();
            const order = response.body.order;

            await checkStock(order.id, order.data.cart.items);
        });

        test("Orders placed by an admin reserve the stock", async () => {
            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.PointOfSale,
                checkoutMethod: takeoutMethod,
                timeSlot: slot1,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product,
                            productPrice: productPrice1,
                            amount: 5,
                            options: [
                                CartItemOption.create({
                                    optionMenu: multipleChoiceOptionMenu,
                                    option: checkboxOption2
                                }),
                                CartItemOption.create({
                                    optionMenu: chooseOneOptionMenu,
                                    option: radioOption1
                                })
                            ]
                        })
                    ]
                }),
                customer
            })

            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

            const orderPatch = PrivateOrder.create({
                id: uuidv4(),
                data: orderData,
                webshopId: webshop.id
            });
            patchArray.addPut(orderPatch);

            // Send a patch
            const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r.headers.authorization = "Bearer " + token.accessToken

            const response = await patchWebshopOrdersEndpoint.test(r);
            expect(response.body).toBeDefined();
            const order = response.body[0];
            await checkStock(order.id, order.data.cart.items);
        });

        test("Orders placed by an admin do not reserve the stock if IBAN is missing", async () => {

            webshop.meta.paymentConfiguration.transferSettings.iban = null;
            await webshop.save();

            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.Transfer,
                checkoutMethod: takeoutMethod,
                timeSlot: slot1,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product,
                            productPrice: productPrice1,
                            amount: 5,
                            options: [
                                CartItemOption.create({
                                    optionMenu: multipleChoiceOptionMenu,
                                    option: checkboxOption2
                                }),
                                CartItemOption.create({
                                    optionMenu: chooseOneOptionMenu,
                                    option: radioOption1
                                })
                            ]
                        })
                    ]
                }),
                customer
            })

            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

            const orderPatch = PrivateOrder.create({
                id: uuidv4(),
                data: orderData,
                webshopId: webshop.id
            });
            patchArray.addPut(orderPatch);

            // Send a patch
            const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r.headers.authorization = "Bearer " + token.accessToken

            await expect(patchWebshopOrdersEndpoint.test(r)).rejects.toThrow('Missing IBAN');
            await checkStocks([], []);
        });

        test("Chosen seats reserve the stock for POS order", async () => {
            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.PointOfSale,
                checkoutMethod: takeoutMethod,
                timeSlot: slot1,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product: seatProduct,
                            productPrice: seatProductPrice,
                            amount: 2,
                            seats: [
                                CartReservedSeat.create({
                                    section: seatingPlan.sections[0].id,
                                    row: 'A',
                                    seat: '1'
                                }),
                                CartReservedSeat.create({
                                    section: seatingPlan.sections[0].id,
                                    row: 'A',
                                    seat: '2'
                                })
                            ]
                        })
                    ]
                }),
                customer
            })
            
            const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);

            const response = await endpoint.test(r);
            expect(response.body).toBeDefined();
            const order = response.body.order;

            await checkStock(order.id, order.data.cart.items);
        });

        test("Chosen seats reserve the stock for an admin order", async () => {
            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.PointOfSale,
                checkoutMethod: takeoutMethod,
                timeSlot: slot1,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product: seatProduct,
                            productPrice: seatProductPrice,
                            amount: 2,
                            seats: [
                                CartReservedSeat.create({
                                    section: seatingPlan.sections[0].id,
                                    row: 'A',
                                    seat: '1'
                                }),
                                CartReservedSeat.create({
                                    section: seatingPlan.sections[0].id,
                                    row: 'A',
                                    seat: '2'
                                })
                            ]
                        })
                    ]
                }),
                customer
            })
            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

            const orderPatch = PrivateOrder.create({
                id: uuidv4(),
                data: orderData,
                webshopId: webshop.id
            });
            patchArray.addPut(orderPatch);

            // Send a patch
            const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r.headers.authorization = "Bearer " + token.accessToken

            const response = await patchWebshopOrdersEndpoint.test(r);
            expect(response.body).toBeDefined();
            const order = response.body[0];
            await checkStock(order.id, order.data.cart.items);
        });

        test("Amount of a cart item should match the amount of chosen seats", async () => {
            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.PointOfSale,
                checkoutMethod: takeoutMethod,
                timeSlot: slot1,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product: seatProduct,
                            productPrice: seatProductPrice,
                            amount: 2,
                            seats: [
                                CartReservedSeat.create({
                                    section: seatingPlan.sections[0].id,
                                    row: 'A',
                                    seat: '1'
                                })
                            ]
                        })
                    ]
                }),
                customer
            })
            
            const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);
            await expect(endpoint.test(r)).rejects.toThrow('Invalid seats');
        });

        test.todo("Amount of persons and orders for a takeout method is calculated correctly");

        test.todo("Amount of persons and orders for a delivery method is calculated correctly");

    });

    describe('Full stock', () => {
        test("Cannot place an order when product stock is full", async () => {
            // Set stock
            product.stock = 2;
            await saveChanges();

            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.PointOfSale,
                checkoutMethod: takeoutMethod,
                timeSlot: slot1,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product,
                            productPrice: productPrice1,
                            amount: 5,
                            options: [
                                CartItemOption.create({
                                    optionMenu: multipleChoiceOptionMenu,
                                    option: checkboxOption2
                                }),
                                CartItemOption.create({
                                    optionMenu: chooseOneOptionMenu,
                                    option: radioOption1
                                })
                            ]
                        })
                    ]
                }),
                customer
            })
            
            const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);

            await expect(endpoint.test(r)).rejects.toThrow('Product unavailable');
        });

        test("Cannot place an order when product price stock is full", async () => {
            // Set stock
            productPrice1.stock = 2;
            await saveChanges();

            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.PointOfSale,
                checkoutMethod: takeoutMethod,
                timeSlot: slot1,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product,
                            productPrice: productPrice1,
                            amount: 5,
                            options: [
                                CartItemOption.create({
                                    optionMenu: multipleChoiceOptionMenu,
                                    option: checkboxOption2
                                }),
                                CartItemOption.create({
                                    optionMenu: chooseOneOptionMenu,
                                    option: radioOption1
                                })
                            ]
                        })
                    ]
                }),
                customer
            })
            
            const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);

            await expect(endpoint.test(r)).rejects.toHaveProperty('human','Er zijn nog maar 2 stuks van productPrice1 beschikbaar');
        });

        test("Cannot place an order when option stock is full", async () => {
            // Set stock
            radioOption1.stock = 2;
            await saveChanges();

            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.PointOfSale,
                checkoutMethod: takeoutMethod,
                timeSlot: slot1,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product,
                            productPrice: productPrice1,
                            amount: 5,
                            options: [
                                CartItemOption.create({
                                    optionMenu: multipleChoiceOptionMenu,
                                    option: checkboxOption2
                                }),
                                CartItemOption.create({
                                    optionMenu: chooseOneOptionMenu,
                                    option: radioOption1
                                })
                            ]
                        })
                    ]
                }),
                customer
            })
            
            const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);

            await expect(endpoint.test(r)).rejects.toHaveProperty('human','Er zijn nog maar 2 stuks van radioOption1 beschikbaar');
        });

        test("Cannot place an order when multiple choice option stock is full", async () => {
            // Set stock
            checkboxOption2.stock = 2;
            await saveChanges();

            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.PointOfSale,
                checkoutMethod: takeoutMethod,
                timeSlot: slot1,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product,
                            productPrice: productPrice1,
                            amount: 5,
                            options: [
                                CartItemOption.create({
                                    optionMenu: multipleChoiceOptionMenu,
                                    option: checkboxOption2
                                }),
                                CartItemOption.create({
                                    optionMenu: chooseOneOptionMenu,
                                    option: radioOption1
                                })
                            ]
                        })
                    ]
                }),
                customer
            })
            
            const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);

            await expect(endpoint.test(r)).rejects.toHaveProperty('human','Er zijn nog maar 2 stuks van checkboxOption2 beschikbaar');
        });

        test.todo("Cannot place an order when takeout persons stock is full");

        test.todo("Cannot place an order when takeout orders stock is full");

        test("Cannot place an order for a reserved seat", async () => {
            // Set stock
            seatProduct.reservedSeats = [
                ReservedSeat.create({
                    section: seatingPlan.sections[0].id,
                    row: 'A',
                    seat: '1'
                })
            ]
            await saveChanges();

            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.PointOfSale,
                checkoutMethod: takeoutMethod,
                timeSlot: slot1,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product: seatProduct,
                            productPrice: seatProductPrice,
                            amount: 2,
                            seats: [
                                CartReservedSeat.create({
                                    section: seatingPlan.sections[0].id,
                                    row: 'A',
                                    seat: '1'
                                }),
                                CartReservedSeat.create({
                                    section: seatingPlan.sections[0].id,
                                    row: 'A',
                                    seat: '2'
                                })
                            ]
                        })
                    ]
                }),
                customer
            })
            
            const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);
            await expect(endpoint.test(r)).rejects.toThrow('Seats unavailable');
        });

        test("Admin cannot place an order for a reserved seat", async () => {
            // Set stock
            seatProduct.reservedSeats = [
                ReservedSeat.create({
                    section: seatingPlan.sections[0].id,
                    row: 'A',
                    seat: '1'
                })
            ]
            await saveChanges();
            
            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.PointOfSale,
                checkoutMethod: takeoutMethod,
                timeSlot: slot1,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product: seatProduct,
                            productPrice: seatProductPrice,
                            amount: 2,
                            seats: [
                                CartReservedSeat.create({
                                    section: seatingPlan.sections[0].id,
                                    row: 'A',
                                    seat: '1'
                                }),
                                CartReservedSeat.create({
                                    section: seatingPlan.sections[0].id,
                                    row: 'A',
                                    seat: '2'
                                })
                            ]
                        })
                    ]
                }),
                customer
            })
            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

            const orderPatch = PrivateOrder.create({
                id: uuidv4(),
                data: orderData,
                webshopId: webshop.id
            });
            patchArray.addPut(orderPatch);

            // Send a patch
            const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r.headers.authorization = "Bearer " + token.accessToken
            await expect(patchWebshopOrdersEndpoint.test(r)).rejects.toThrow('Seats unavailable');
        });

        test.todo("Admin cannot edit an an order to a reserved seat");
    });

    describe('Cleaning up stock', () => {
        test("Stock is returned when a payment failed", async () => {
            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.Bancontact,
                checkoutMethod: onSiteMethod,
                timeSlot: slot4,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product,
                            productPrice: productPrice2,
                            amount: 5,
                            options: [
                                CartItemOption.create({
                                    optionMenu: multipleChoiceOptionMenu,
                                    option: checkboxOption1
                                }),
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

            const response = await endpoint.test(r);
            expect(response.body).toBeDefined();
            const order = response.body.order;

            await checkStock(order.id, order.data.cart.items);

            // Cancel the payment
            await stripeMocker.failPayment(stripeMocker.getLastIntent())

            const updatedOrder = await checkStock(order.id, [], order.data.cart.items);
            expect(updatedOrder.status).toBe(OrderStatus.Deleted);
        });
    });

    describe('Modifying orders', () => {
        let order: Order;
        let baseOrder: Order;
        let productCartItem: CartItem|undefined;
        let personCartItem: CartItem|undefined;

        beforeEach(async () => {
            productCartItem = CartItem.create({
                product,
                productPrice: productPrice1,
                amount: 5,
                options: [
                    CartItemOption.create({
                        optionMenu: multipleChoiceOptionMenu,
                        option: checkboxOption1
                    }),
                    CartItemOption.create({
                        optionMenu: chooseOneOptionMenu,
                        option: radioOption1
                    })
                ]
            })

            personCartItem = CartItem.create({
                product: personProduct,
                productPrice: personProductPrice,
                amount: 2
            })

            {
                const orderData = OrderData.create({
                    paymentMethod: PaymentMethod.PointOfSale,
                    checkoutMethod: takeoutMethod,
                    timeSlot: slot1,
                    cart: Cart.create({
                        items: [
                            productCartItem,
                            personCartItem
                        ]
                    }),
                    customer
                })
                
                const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);

                const response = await endpoint.test(r);
                expect(response.body).toBeDefined();
                const orderStruct = response.body.order;


                // Now check the stock has changed for the product
                order = await checkStock(orderStruct.id, [productCartItem, personCartItem]);
            }

            // Make sure all items in the cart, options etc, have at least a usedStock of 1, to also test they don't decrease when making 
            // changes to roders
            {
                const orderData = OrderData.create({
                    paymentMethod: PaymentMethod.PointOfSale,
                    checkoutMethod: takeoutMethod,
                    timeSlot: slot1,
                    cart: Cart.create({
                        items: [
                            CartItem.create({
                                product,
                                productPrice: productPrice1,
                                amount: 1,
                                options: [
                                    CartItemOption.create({
                                        optionMenu: multipleChoiceOptionMenu,
                                        option: checkboxOption1
                                    }),
                                    CartItemOption.create({
                                        optionMenu: chooseOneOptionMenu,
                                        option: radioOption1
                                    })
                                ]
                            }),
                            CartItem.create({
                                product,
                                productPrice: productPrice2,
                                amount: 1,
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
                            }),
                            CartItem.create({
                                product: personProduct,
                                productPrice: personProductPrice,
                                amount: 1
                            })
                        ]
                    }),
                    customer
                })
                
                const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);

                const response = await endpoint.test(r);
                expect(response.body).toBeDefined();
                const orderStruct = response.body.order;


                // Now check the stock has changed for the product
                const orders = await checkStocks([order.id, orderStruct.id], [productCartItem, personCartItem, ...orderStruct.data.cart.items]);
                baseOrder = orders.find(o => o.id === orderStruct.id)!
            }
        });

        test("Stock is removed when a product is removed or added in two steps", async () => {
            {
                const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

                const cartPatch = Cart.patch({})
                cartPatch.items.addDelete(productCartItem!.id)
                const orderPatch = PrivateOrder.patch({id: order.id, data: OrderData.patch({cart: cartPatch})});
                patchArray.addPatch(orderPatch);

                // Send a patch
                const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
                r.headers.authorization = "Bearer " + token.accessToken

                await patchWebshopOrdersEndpoint.test(r);

                await checkStock(order.id, [personCartItem!]);
            }

            {
                const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

                const cartPatch = Cart.patch({})
                cartPatch.items.addDelete(personCartItem!.id)
                const newItem = CartItem.create({
                    product,
                    productPrice: productPrice2,
                    amount: 30,
                    options: [
                        CartItemOption.create({
                            optionMenu: chooseOneOptionMenu,
                            option: radioOption2
                        })
                    ]
                });

                cartPatch.items.addPut(
                    newItem
                )

                const orderPatch = PrivateOrder.patch({id: order.id, data: OrderData.patch({cart: cartPatch})});
                patchArray.addPatch(orderPatch);

                // Send a patch
                const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
                r.headers.authorization = "Bearer " + token.accessToken

                await patchWebshopOrdersEndpoint.test(r);

                await checkStock(order.id, [newItem]);
            }
        });

        test("Stock is removed when a product is removed or added in single step", async () => {
            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

            const cartPatch = Cart.patch({})
            cartPatch.items.addDelete(productCartItem!.id)
            cartPatch.items.addDelete(personCartItem!.id)
            cartPatch.items.addPut(personCartItem!)
            
            const newItem = CartItem.create({
                product,
                productPrice: productPrice2,
                amount: 40,
                options: [
                    CartItemOption.create({
                        optionMenu: chooseOneOptionMenu,
                        option: radioOption2
                    })
                ]
            });

            cartPatch.items.addPut(
                newItem
            )

            const orderPatch = PrivateOrder.patch({id: order.id, data: OrderData.patch({cart: cartPatch})});
            patchArray.addPatch(orderPatch);

            // Send a patch
            const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r.headers.authorization = "Bearer " + token.accessToken

            await patchWebshopOrdersEndpoint.test(r);

            order = await checkStock(order.id, [personCartItem!, newItem]);
        });

        test("Stock is adjusted if product amount is changed", async () => {
            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

            const cartPatch = Cart.patch({})
            cartPatch.items.addPatch(CartItem.patch({
                id: productCartItem!.id,
                amount: 6
            }))
            cartPatch.items.addPatch(CartItem.patch({
                id: personCartItem!.id,
                amount: 13
            }))
            const orderPatch = PrivateOrder.patch({id: order.id, data: OrderData.patch({cart: cartPatch})});
            patchArray.addPatch(orderPatch);

            // Send a patch
            const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r.headers.authorization = "Bearer " + token.accessToken

            await patchWebshopOrdersEndpoint.test(r);

            await checkStock(order.id, [personCartItem!, productCartItem!]);
        });

        test("Stock is changed if timeslot is changed", async () => {
            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

            const orderPatch = PrivateOrder.patch({
                id: order.id, 
                data: OrderData.patch({
                    timeSlot: slot2
                })
            });
            patchArray.addPatch(orderPatch);

            // Send a patch
            const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r.headers.authorization = "Bearer " + token.accessToken

            await patchWebshopOrdersEndpoint.test(r);

            await checkStock(order.id, [personCartItem!, productCartItem!]);
        });

        test('Stock is changed if productPrice is changed', async () => {
            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()
            
            const cartPatch = Cart.patch({})
            cartPatch.items.addPatch(CartItem.patch({
                id: productCartItem!.id,
                productPrice: productPrice2
            }))

            const orderPatch = PrivateOrder.patch({id: order.id, data: OrderData.patch({cart: cartPatch})});
            patchArray.addPatch(orderPatch);

            // Send a patch
            const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r.headers.authorization = "Bearer " + token.accessToken

            await patchWebshopOrdersEndpoint.test(r);

            await checkStock(order.id, [personCartItem!, productCartItem!]);
        });

        test('Stock is changed when option is removed', async () => {
            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()
            
            const cartPatch = Cart.patch({})
            cartPatch.items.addPatch(CartItem.patch({
                id: productCartItem!.id,
                options: [
                    CartItemOption.create({
                        optionMenu: chooseOneOptionMenu,
                        option: radioOption1
                    })
                ]
            }))

            const orderPatch = PrivateOrder.patch({id: order.id, data: OrderData.patch({cart: cartPatch})});
            patchArray.addPatch(orderPatch);

            // Send a patch
            const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r.headers.authorization = "Bearer " + token.accessToken

            await patchWebshopOrdersEndpoint.test(r);

            await checkStock(order.id, [personCartItem!, productCartItem!]);
        });

        test('Stock is changed when option is changed', async () => {
            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()
            
            const cartPatch = Cart.patch({})
            cartPatch.items.addPatch(CartItem.patch({
                id: productCartItem!.id,
                options: [
                    CartItemOption.create({
                        optionMenu: chooseOneOptionMenu,
                        option: radioOption2
                    }),
                    CartItemOption.create({
                        optionMenu: multipleChoiceOptionMenu,
                        option: checkboxOption2
                    })
                ]
            }))

            const orderPatch = PrivateOrder.patch({id: order.id, data: OrderData.patch({cart: cartPatch})});
            patchArray.addPatch(orderPatch);

            // Send a patch
            const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r.headers.authorization = "Bearer " + token.accessToken

            await patchWebshopOrdersEndpoint.test(r);

            await checkStock(order.id, [personCartItem!, productCartItem!]);
        });

        test('Stock is changed when option is added', async () => {
            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()
            
            const cartPatch = Cart.patch({})
            cartPatch.items.addPatch(CartItem.patch({
                id: productCartItem!.id,
                options: [
                    CartItemOption.create({
                        optionMenu: chooseOneOptionMenu,
                        option: radioOption1
                    }),
                    CartItemOption.create({
                        optionMenu: multipleChoiceOptionMenu,
                        option: checkboxOption1
                    }),
                    CartItemOption.create({
                        optionMenu: multipleChoiceOptionMenu,
                        option: checkboxOption2
                    })
                ]
            }))

            const orderPatch = PrivateOrder.patch({id: order.id, data: OrderData.patch({cart: cartPatch})});
            patchArray.addPatch(orderPatch);

            // Send a patch
            const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r.headers.authorization = "Bearer " + token.accessToken

            await patchWebshopOrdersEndpoint.test(r);

            await checkStock(order.id, [personCartItem!, productCartItem!]);
        });

        test("Stock is changed if delivery method is changed", async () => {
            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

            const orderPatch = PrivateOrder.patch({
                id: order.id, 
                data: OrderData.patch({
                    checkoutMethod: deliveryMethod,
                    timeSlot: slot3,
                    address: ValidatedAddress.create({
                        ...address,
                        cityId: '',
                        parentCityId: null,
                        provinceId: ''
                    })
                })
            });
            patchArray.addPatch(orderPatch);

            // Send a patch
            const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r.headers.authorization = "Bearer " + token.accessToken

            await patchWebshopOrdersEndpoint.test(r);
            await checkStock(order.id, [personCartItem!, productCartItem!]);
        });

        test("Stock is returned when an order is canceled and added when uncanceled again", async () => {
            {
                const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

                const orderPatch = PrivateOrder.patch({
                    id: order.id, 
                    status: OrderStatus.Canceled
                });
                patchArray.addPatch(orderPatch);

                // Send a patch
                const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
                r.headers.authorization = "Bearer " + token.accessToken

                await patchWebshopOrdersEndpoint.test(r);

                await checkStock(order.id, [], [personCartItem!, productCartItem!]);
            }

            // Uncancel
            {
                const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

                const orderPatch = PrivateOrder.patch({
                    id: order.id, 
                    status: OrderStatus.Created
                });
                patchArray.addPatch(orderPatch);

                // Send a patch
                const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
                r.headers.authorization = "Bearer " + token.accessToken

                await patchWebshopOrdersEndpoint.test(r);

                await checkStock(order.id, [personCartItem!, productCartItem!]);
            }
        });

        test("Stock is returned when an order is deleted and added when undeleted", async () => {
            {
                const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

                const orderPatch = PrivateOrder.patch({
                    id: order.id, 
                    status: OrderStatus.Deleted
                });
                patchArray.addPatch(orderPatch);

                // Send a patch
                const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
                r.headers.authorization = "Bearer " + token.accessToken

                await patchWebshopOrdersEndpoint.test(r);

                await checkStock(order.id, [], [personCartItem!, productCartItem!]);
            }

            // Undelete
            {
                const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

                const orderPatch = PrivateOrder.patch({
                    id: order.id, 
                    status: OrderStatus.Created
                });
                patchArray.addPatch(orderPatch);

                // Send a patch
                const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
                r.headers.authorization = "Bearer " + token.accessToken

                await patchWebshopOrdersEndpoint.test(r);

                await checkStock(order.id, [personCartItem!, productCartItem!]);
            }
        });
    });

    describe('Modifying seat orders', () => {
        let order: Order;
        let seatCartItem: CartItem|undefined;

        beforeEach(async () => {
            seatCartItem = CartItem.create({
                product: seatProduct,
                productPrice: seatProductPrice,
                amount: 2,
                seats: [
                    CartReservedSeat.create({
                        section: seatingPlan.sections[0].id,
                        row: 'A',
                        seat: '1'
                    }),
                    CartReservedSeat.create({
                        section: seatingPlan.sections[0].id,
                        row: 'A',
                        seat: '2'
                    })
                ]
            })

            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.PointOfSale,
                checkoutMethod: takeoutMethod,
                timeSlot: slot1,
                cart: Cart.create({
                    items: [
                        seatCartItem
                    ]
                }),
                customer
            })
            
            const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);

            const response = await endpoint.test(r);
            expect(response.body).toBeDefined();
            const orderStruct = response.body.order;

            // Now check the stock has changed for the product
            order = await checkStock(orderStruct.id, [seatCartItem]);
        });

        test("Stock is removed when a product is removed and another is added", async () => {
            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

            const cartPatch = Cart.patch({})
            cartPatch.items.addDelete(seatCartItem!.id)

            const newItem = CartItem.create({
                product: seatProduct,
                productPrice: seatProductPrice,
                amount: 1,
                seats: [
                    CartReservedSeat.create({
                        section: seatingPlan.sections[0].id,
                        row: 'B',
                        seat: '1'
                    })
                ]
            });

            cartPatch.items.addPut(
                newItem
            )

            const orderPatch = PrivateOrder.patch({id: order.id, data: OrderData.patch({cart: cartPatch})});
            patchArray.addPatch(orderPatch);

            // Send a patch
            const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r.headers.authorization = "Bearer " + token.accessToken

            await patchWebshopOrdersEndpoint.test(r);

            await checkStock(order.id, [newItem]);
            
        });

        test("Stock is adjusted if extra seat is selected", async () => {
            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

            const cartPatch = Cart.patch({})
            const c = CartItem.patch({
                id: seatCartItem!.id,
                amount: 3,
                seats: [
                    CartReservedSeat.create({
                        section: seatingPlan.sections[0].id,
                        row: 'A',
                        seat: '1'
                    }),
                    CartReservedSeat.create({
                        section: seatingPlan.sections[0].id,
                        row: 'A',
                        seat: '2'
                    }),
                    CartReservedSeat.create({
                        section: seatingPlan.sections[0].id,
                        row: 'A',
                        seat: '3'
                    })
                ]
            });
            cartPatch.items.addPatch(c)

            const orderPatch = PrivateOrder.patch({id: order.id, data: OrderData.patch({cart: cartPatch})});
            patchArray.addPatch(orderPatch);

            // Send a patch
            const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r.headers.authorization = "Bearer " + token.accessToken

            await patchWebshopOrdersEndpoint.test(r);

            await checkStock(order.id, [seatCartItem!]);
        });        

        test("Reserved seats are changed when seats are moved", async () => {
            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

            const cartPatch = Cart.patch({})
            cartPatch.items.addPatch(CartItem.patch({
                id: seatCartItem?.id,
                seats: [
                    CartReservedSeat.create({
                        section: seatingPlan.sections[0].id,
                        row: 'B',
                        seat: '1'
                    }),
                    CartReservedSeat.create({
                        section: seatingPlan.sections[0].id,
                        row: 'B',
                        seat: '2'
                    })
                ]
            }))
            const orderPatch = PrivateOrder.patch({id: order.id, data: OrderData.patch({cart: cartPatch})});
            patchArray.addPatch(orderPatch);

            // Send a patch
            const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r.headers.authorization = "Bearer " + token.accessToken

            await patchWebshopOrdersEndpoint.test(r);

            await checkStock(order.id, [seatCartItem!]);
        });

        test("Stock is returned when an order is canceled and added when uncanceled again", async () => {
            {
                const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

                const orderPatch = PrivateOrder.patch({
                    id: order.id, 
                    status: OrderStatus.Canceled
                });
                patchArray.addPatch(orderPatch);

                // Send a patch
                const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
                r.headers.authorization = "Bearer " + token.accessToken

                await patchWebshopOrdersEndpoint.test(r);

                await checkStock(order.id, [], [seatCartItem!]);
            }

            // Uncancel
            {
                const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

                const orderPatch = PrivateOrder.patch({
                    id: order.id, 
                    status: OrderStatus.Created
                });
                patchArray.addPatch(orderPatch);

                // Send a patch
                const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
                r.headers.authorization = "Bearer " + token.accessToken

                await patchWebshopOrdersEndpoint.test(r);

                await checkStock(order.id, [seatCartItem!]);
            }
        });

        test("Stock is returned when an order is deleted and added when undeleted", async () => {
            {
                const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

                const orderPatch = PrivateOrder.patch({
                    id: order.id, 
                    status: OrderStatus.Deleted
                });
                patchArray.addPatch(orderPatch);

                // Send a patch
                const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
                r.headers.authorization = "Bearer " + token.accessToken

                await patchWebshopOrdersEndpoint.test(r);

                await checkStock(order.id, [], [seatCartItem!]);
            }

            // Undelete
            {
                const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

                const orderPatch = PrivateOrder.patch({
                    id: order.id, 
                    status: OrderStatus.Created
                });
                patchArray.addPatch(orderPatch);

                // Send a patch
                const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
                r.headers.authorization = "Bearer " + token.accessToken

                await patchWebshopOrdersEndpoint.test(r);

                await checkStock(order.id, [seatCartItem!]);
            }
        });

        test("Correctly handles duplicate seat booking recovery", async () => {
            {
                const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

                const orderPatch = PrivateOrder.patch({
                    id: order.id, 
                    status: OrderStatus.Canceled
                });
                patchArray.addPatch(orderPatch);

                // Send a patch
                const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
                r.headers.authorization = "Bearer " + token.accessToken

                await patchWebshopOrdersEndpoint.test(r);

                await checkStock(order.id, [], [seatCartItem!]);
            }

            // Place an order for the same seats
            const newItem = CartItem.create({
                product: seatProduct,
                productPrice: seatProductPrice,
                amount: 2,
                seats: [
                    CartReservedSeat.create({
                        section: seatingPlan.sections[0].id,
                        row: 'A',
                        seat: '1'
                    }),
                    CartReservedSeat.create({
                        section: seatingPlan.sections[0].id,
                        row: 'A',
                        seat: '2'
                    })
                ]
            })

            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.PointOfSale,
                checkoutMethod: takeoutMethod,
                timeSlot: slot1,
                cart: Cart.create({
                    items: [
                        newItem
                    ]
                }),
                customer
            })
            let orders: Order[];

            {
                const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);

                const response = await endpoint.test(r);
                expect(response.body).toBeDefined();
                const orderStruct = response.body.order;

                // Now check the stock has changed for the product
                orders = await checkStocks([order.id, orderStruct.id], [newItem], [seatCartItem!]);
            }

            // Uncancel
            {
                const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

                const orderPatch = PrivateOrder.patch({
                    id: order.id, 
                    status: OrderStatus.Created
                });
                patchArray.addPatch(orderPatch);

                // Send a patch
                const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
                r.headers.authorization = "Bearer " + token.accessToken

                await patchWebshopOrdersEndpoint.test(r);

                orders = await checkStocks(orders.map(o => o.id), [newItem, seatCartItem!]);
            }

            // Now we are in a duplicate seat selected situation.
            // To recover, move seats of one of the orders
            // and check in the final result, all seats are still correctly reserved (once)
            
            // Manual check
            expect(seatProduct.reservedSeats).toHaveLength(4);
            expect(seatProduct.reservedSeats).toIncludeSameMembers([
                ReservedSeat.create({
                    section: seatingPlan.sections[0].id,
                    row: 'A',
                    seat: '1'
                }),
                ReservedSeat.create({
                    section: seatingPlan.sections[0].id,
                    row: 'A',
                    seat: '1'
                }),
                ReservedSeat.create({
                    section: seatingPlan.sections[0].id,
                    row: 'A',
                    seat: '2'
                }),
                ReservedSeat.create({
                    section: seatingPlan.sections[0].id,
                    row: 'A',
                    seat: '2'
                }),
            ])

            // Move seats of first order
            {
                const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

                const cartPatch = Cart.patch({})
                cartPatch.items.addPatch(CartItem.patch({
                    id: seatCartItem?.id,
                    seats: [
                        CartReservedSeat.create({
                            section: seatingPlan.sections[0].id,
                            row: 'B',
                            seat: '1'
                        }),
                        CartReservedSeat.create({
                            section: seatingPlan.sections[0].id,
                            row: 'B',
                            seat: '2'
                        })
                    ]
                }))
                const orderPatch = PrivateOrder.patch({id: order.id, data: OrderData.patch({cart: cartPatch})});
                patchArray.addPatch(orderPatch);

                // Send a patch
                const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
                r.headers.authorization = "Bearer " + token.accessToken

                await patchWebshopOrdersEndpoint.test(r);

                await checkStocks(orders.map(o => o.id), [newItem, seatCartItem!]);
            }

            // Manual check
            expect(seatProduct.reservedSeats).toHaveLength(4);
            expect(seatProduct.reservedSeats).toIncludeSameMembers([
                ReservedSeat.create({
                    section: seatingPlan.sections[0].id,
                    row: 'A',
                    seat: '1'
                }),
                ReservedSeat.create({
                    section: seatingPlan.sections[0].id,
                    row: 'B',
                    seat: '1'
                }),
                ReservedSeat.create({
                    section: seatingPlan.sections[0].id,
                    row: 'A',
                    seat: '2'
                }),
                ReservedSeat.create({
                    section: seatingPlan.sections[0].id,
                    row: 'B',
                    seat: '2'
                }),
            ])
        });

        test("Patching an order triggers an auto recovery of not reserved seats", async () => {
            // This is required to recover from bugs in stock changes.
            // Simply patching all orders will fix the stock.

            // Manually remove all reserved seats = caused by a past bug
            seatProduct.reservedSeats = []
            await saveChanges();

            {
                const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

                const orderPatch = PrivateOrder.patch({
                    id: order.id, 
                    status: OrderStatus.Completed
                });
                patchArray.addPatch(orderPatch);

                // Send a patch
                const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
                r.headers.authorization = "Bearer " + token.accessToken

                await patchWebshopOrdersEndpoint.test(r);

                await checkStock(order.id, [seatCartItem!]);
            }

            // Manual check
            expect(seatProduct.reservedSeats).toHaveLength(2);
            expect(seatProduct.reservedSeats).toIncludeSameMembers([
                ReservedSeat.create({
                    section: seatingPlan.sections[0].id,
                    row: 'A',
                    seat: '1'
                }),
                ReservedSeat.create({
                    section: seatingPlan.sections[0].id,
                    row: 'A',
                    seat: '2'
                }),
            ])
        });
    });
});
