/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable jest/no-standalone-expect */
import { PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-endpoints";
import { Order, Organization, OrganizationFactory, Token, UserFactory, Webshop,WebshopFactory } from "@stamhoofd/models";
import { Address, Cart, CartItem, Country, Customer, OrderData, OrderStatus, PaymentConfiguration, PaymentMethod, PermissionLevel, Permissions, PrivateOrder, Product, ProductType, Token as TokenStruct, ValidatedAddress, WebshopDeliveryMethod, WebshopMetaData, WebshopOnSiteMethod, WebshopTakeoutMethod, WebshopTimeSlot } from "@stamhoofd/structures";

import { PatchWebshopOrdersEndpoint } from "../../src/endpoints/webshops/manage/PatchWebshopOrdersEndpoint";
import { PlaceOrderEndpoint } from '../../src/endpoints/webshops/PlaceOrderEndpoint';

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
    let personProduct: Product;
    let takeoutMethod: WebshopTakeoutMethod;
    let deliveryMethod: WebshopDeliveryMethod;
    let onSiteMethod: WebshopOnSiteMethod;
    let slot1: WebshopTimeSlot;
    let slot2: WebshopTimeSlot;
    let slot3: WebshopTimeSlot;
    let slot4: WebshopTimeSlot;

    async function refreshAll() {
        webshop = (await Webshop.getByID(webshop.id))!;
        product = webshop.products.find(p => p.id == product.id)!;
        personProduct = webshop.products.find(p => p.id == personProduct.id)!;
        takeoutMethod = webshop.meta.checkoutMethods.find(m => m.id == takeoutMethod.id)! as WebshopTakeoutMethod;
        deliveryMethod = webshop.meta.checkoutMethods.find(m => m.id == deliveryMethod.id)! as WebshopDeliveryMethod;
        onSiteMethod = webshop.meta.checkoutMethods.find(m => m.id == onSiteMethod.id)! as WebshopOnSiteMethod;
        slot1 = takeoutMethod.timeSlots.timeSlots.find(s => s.id == slot1.id)!;
        slot2 = takeoutMethod.timeSlots.timeSlots.find(s => s.id == slot2.id)!;
        slot3 = deliveryMethod.timeSlots.timeSlots.find(s => s.id == slot3.id)!;
        slot4 = onSiteMethod.timeSlots.timeSlots.find(s => s.id == slot4.id)!;
    }

    beforeAll(async () => {
        organization = await new OrganizationFactory({}).create()
    });

    beforeEach(async () => {
        let meta = WebshopMetaData.patch({});

        product = Product.create({
            name: 'Test product',
            stock: 100
        })

        personProduct = Product.create({
            name: 'Test product 2',
            type: ProductType.Person,
            stock: 100
        })

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
        
        const paymentConfigurationPatch = PaymentConfiguration.patch({})
        paymentConfigurationPatch.paymentMethods.addPut(PaymentMethod.PointOfSale)

        meta = meta.patch({
            paymentConfiguration: paymentConfigurationPatch
        })

        webshop = await new WebshopFactory({
            organizationId: organization.id,
            name: 'Test webshop',
            meta,
            products: [product, personProduct]
        }).create()
    });

    describe('Reserving stock', () => {
        //test.todo("Online payments reserve the stock", async () => {
        //    //
        //});
//
        //test.todo("Transfer payments reserve the stock", async () => {
        //    //
        //});

        test("POS payments reserve the stock", async () => {
            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.PointOfSale,
                checkoutMethod: takeoutMethod,
                timeSlot: slot1,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product,
                            productPrice: product.prices[0],
                            amount: 5
                        })
                    ]
                }),
                customer
            })
            
            const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);

            const response = await endpoint.test(r);
            expect(response.body).toBeDefined();
            const order = response.body.order;

            // Now check the stock has changed for the product
            await refreshAll();
            expect(product.usedStock).toBe(5);
            expect(product.prices[0].usedStock).toBe(5);
            expect(slot1.usedOrders).toBe(1);
            expect(slot1.usedPersons).toBe(0);

            // Check order reserved stock set correctly
            expect(order.data.cart.items[0].reservedAmount).toBe(5);
            expect(order.data.cart.items[0].reservedPrices.get(product.prices[0].id)).toBe(5);
        });

        test.todo("Orders placed by an admin reserve the stock");

        test.todo("Amount of persons and orders for a takeout method is calculated correctly");

        test.todo("Amount of persons and orders for a delivery method is calculated correctly");

    });

    describe('Full stock', () => {
        test.todo("Cannot place an order when product stock is full");

        test.todo("Cannot place an order when takeout persons stock is full");

        test.todo("Cannot place an order when takeout orders stock is full");

        test.todo("Cannot place an order for a reserved seat");
    });

    describe('Cleaning up stock', () => {
        test.todo("Stock is returned when a payment failed");

        test.todo("Stock is added again if a failed payment succeeds unexpectedly");
    });

    describe('Modifying orders', () => {
        let order: Order;
        let token:Token;
        let productCartItem: CartItem|undefined;
        let personCartItem: CartItem|undefined;

        async function refreshOrder() {
            order = (await Order.getByID(order.id))!;
            productCartItem = order.data.cart.items.find(i => i.product.id == product.id);
            personCartItem = order.data.cart.items.find(i => i.product.id == personProduct.id);
        }

        beforeEach(async () => {
            productCartItem = CartItem.create({
                product,
                productPrice: product.prices[0],
                amount: 5
            })
            personCartItem = CartItem.create({
                product: personProduct,
                productPrice: personProduct.prices[0],
                amount: 2
            })

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
            await refreshAll();
            expect(product.usedStock).toBe(5);
            expect(product.prices[0].usedStock).toBe(5);
            expect(personProduct.usedStock).toBe(2);
            expect(personProduct.prices[0].usedStock).toBe(2);
            expect(slot1.usedOrders).toBe(1);
            expect(slot1.usedPersons).toBe(2);

            // Check order reserved stock set correctly
            expect(orderStruct.data.cart.items[0].reservedAmount).toBe(5);
            expect(orderStruct.data.cart.items[0].reservedPrices.get(product.prices[0].id)).toBe(5);
            expect(orderStruct.data.cart.items[1].reservedAmount).toBe(2);
            expect(orderStruct.data.cart.items[1].reservedPrices.get(personProduct.prices[0].id)).toBe(2);

            // Get the order
            order = (await Order.getByID(orderStruct.id))!;
            await refreshOrder();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.Full
                })
            }).create()
            token = await Token.createToken(user)

        });

        test("Stock is removed when a product is removed or added", async () => {
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

                await refreshAll();
                expect(product.usedStock).toBe(0);
                expect(product.prices[0].usedStock).toBe(0);
                expect(personProduct.usedStock).toBe(2);
                expect(personProduct.prices[0].usedStock).toBe(2);
                expect(slot1.usedOrders).toBe(1);
                expect(slot1.usedPersons).toBe(2);

                // Check order
                await refreshOrder();
                expect(productCartItem).toBeUndefined();
                expect(personCartItem!.reservedAmount).toBe(2);
                expect(order.data.reservedOrder).toBe(true);
                expect(order.data.reservedPersons).toBe(2);
            }

            {
                const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

                const cartPatch = Cart.patch({})
                cartPatch.items.addDelete(personCartItem!.id)
                cartPatch.items.addPut(
                    CartItem.create({
                        product,
                        productPrice: product.prices[0],
                        amount: 30
                    })
                )

                const orderPatch = PrivateOrder.patch({id: order.id, data: OrderData.patch({cart: cartPatch})});
                patchArray.addPatch(orderPatch);

                // Send a patch
                const r = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
                r.headers.authorization = "Bearer " + token.accessToken

                await patchWebshopOrdersEndpoint.test(r);

                await refreshAll();
                expect(product.usedStock).toBe(30);
                expect(product.prices[0].usedStock).toBe(30);
                expect(personProduct.usedStock).toBe(0);
                expect(personProduct.prices[0].usedStock).toBe(0);
                expect(slot1.usedOrders).toBe(1);
                expect(slot1.usedPersons).toBe(0);

                // Check order
                await refreshOrder();
                expect(personCartItem).toBeUndefined();
                expect(productCartItem!.reservedAmount).toBe(30);
                expect(order.data.reservedOrder).toBe(true);
                expect(order.data.reservedPersons).toBe(0);
            }
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

            await refreshAll();
            expect(product.usedStock).toBe(6);
            expect(product.prices[0].usedStock).toBe(6);
            expect(personProduct.usedStock).toBe(13);
            expect(personProduct.prices[0].usedStock).toBe(13);
            expect(slot1.usedOrders).toBe(1);
            expect(slot1.usedPersons).toBe(13);

            // Check order
            await refreshOrder();
            expect(productCartItem!.reservedAmount).toBe(6);
            expect(personCartItem!.reservedAmount).toBe(13);
            expect(order.data.reservedOrder).toBe(true);
            expect(order.data.reservedPersons).toBe(13);
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

            await refreshAll();
            expect(product.usedStock).toBe(5);
            expect(product.prices[0].usedStock).toBe(5);
            expect(personProduct.usedStock).toBe(2);
            expect(personProduct.prices[0].usedStock).toBe(2);

            expect(slot1.usedOrders).toBe(0);
            expect(slot1.usedPersons).toBe(0);

            expect(slot2.usedOrders).toBe(1);
            expect(slot2.usedPersons).toBe(2);

            // Check order
            await refreshOrder();
            expect(personCartItem!.reservedAmount).toBe(2);
            expect(productCartItem!.reservedAmount).toBe(5);
            expect(order.data.reservedOrder).toBe(true);
            expect(order.data.reservedPersons).toBe(2);
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

            await refreshAll();
            expect(product.usedStock).toBe(5);
            expect(product.prices[0].usedStock).toBe(5);
            expect(personProduct.usedStock).toBe(2);
            expect(personProduct.prices[0].usedStock).toBe(2);

            expect(slot1.usedOrders).toBe(0);
            expect(slot1.usedPersons).toBe(0);

            expect(slot3.usedOrders).toBe(1);
            expect(slot3.usedPersons).toBe(2);

            // Check order
            await refreshOrder();
            expect(personCartItem!.reservedAmount).toBe(2);
            expect(productCartItem!.reservedAmount).toBe(5);
            expect(order.data.reservedOrder).toBe(true);
            expect(order.data.reservedPersons).toBe(2);
        });

        test.todo("Reserved seats are changed when seats are switched");

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

                await refreshAll();
                expect(product.usedStock).toBe(0);
                expect(product.prices[0].usedStock).toBe(0);
                expect(personProduct.usedStock).toBe(0);
                expect(personProduct.prices[0].usedStock).toBe(0);
                expect(slot1.usedOrders).toBe(0);
                expect(slot1.usedPersons).toBe(0);

                // Check order
                await refreshOrder();
                expect(personCartItem!.reservedAmount).toBe(0);
                expect(productCartItem!.reservedAmount).toBe(0);
                expect(order.data.reservedOrder).toBe(false);
                expect(order.data.reservedPersons).toBe(0);
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

                await refreshAll();
                expect(product.usedStock).toBe(5);
                expect(product.prices[0].usedStock).toBe(5);
                expect(personProduct.usedStock).toBe(2);
                expect(personProduct.prices[0].usedStock).toBe(2);
                expect(slot1.usedOrders).toBe(1);
                expect(slot1.usedPersons).toBe(2);

                // Check order
                await refreshOrder();
                expect(personCartItem!.reservedAmount).toBe(2);
                expect(productCartItem!.reservedAmount).toBe(5);
                expect(order.data.reservedOrder).toBe(true);
                expect(order.data.reservedPersons).toBe(2);
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

                await refreshAll();
                expect(product.usedStock).toBe(0);
                expect(product.prices[0].usedStock).toBe(0);
                expect(personProduct.usedStock).toBe(0);
                expect(personProduct.prices[0].usedStock).toBe(0);
                expect(slot1.usedOrders).toBe(0);
                expect(slot1.usedPersons).toBe(0);

                // Check order
                await refreshOrder();
                expect(personCartItem!.reservedAmount).toBe(0);
                expect(productCartItem!.reservedAmount).toBe(0);
                expect(order.data.reservedOrder).toBe(false);
                expect(order.data.reservedPersons).toBe(0);
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

                await refreshAll();
                expect(product.usedStock).toBe(5);
                expect(product.prices[0].usedStock).toBe(5);
                expect(personProduct.usedStock).toBe(2);
                expect(personProduct.prices[0].usedStock).toBe(2);
                expect(slot1.usedOrders).toBe(1);
                expect(slot1.usedPersons).toBe(2);

                // Check order
                await refreshOrder();
                expect(personCartItem!.reservedAmount).toBe(2);
                expect(productCartItem!.reservedAmount).toBe(5);
                expect(order.data.reservedOrder).toBe(true);
                expect(order.data.reservedPersons).toBe(2);
            }
        });
    });
});
