/* eslint-disable jest/expect-expect */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable jest/no-standalone-expect */
import { PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-endpoints";
import { Organization, OrganizationFactory, StripeAccount, Ticket, Token, UserFactory, Webshop, WebshopFactory } from "@stamhoofd/models";
import { Cart, CartItem, CartReservedSeat, Customer, OrderData, OrderStatus, PaymentConfiguration, PaymentMethod, PermissionLevel, Permissions, PrivateOrder, PrivatePaymentConfiguration, Product, ProductType, SeatingPlan, SeatingPlanRow, SeatingPlanSeat, SeatingPlanSection, TransferSettings, WebshopMetaData, WebshopPrivateMetaData, WebshopTicketType } from "@stamhoofd/structures";

import { PatchWebshopOrdersEndpoint } from "../../src/endpoints/organization/dashboard/webshops/PatchWebshopOrdersEndpoint";
import { PlaceOrderEndpoint } from '../../src/endpoints/organization/webshops/PlaceOrderEndpoint';
import { StripeMocker } from "../helpers/StripeMocker";

const customer = Customer.create({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '+32412345678'
});

function mapTicketChangedAmount(ticket: Ticket) {
    return {
        id: ticket.id,
        seat: ticket.seat,
        originalSeat: ticket.originalSeat,
        orderId: ticket.orderId,
        itemId: ticket.itemId,
        index: ticket.index,
        secret: ticket.secret,
    }
}

function mapTicketCreation(ticket: Ticket) {
    return {
        seat: ticket.seat,
        originalSeat: ticket.originalSeat,
        itemId: ticket.itemId,
        index: ticket.index,
        total: ticket.total
    }
}

describe("E2E.Tickets", () => {
    // Test endpoint
    const endpoint = new PlaceOrderEndpoint();
    const patchWebshopOrdersEndpoint = new PatchWebshopOrdersEndpoint();

    let organization: Organization;
    let webshop: Webshop;
    let ticket1: Product;
    let ticket2: Product;
    let seatProduct: Product;
    let seatingPlan: SeatingPlan;
    let stripeMocker: StripeMocker
    let stripeAccount: StripeAccount
    let token: Token;

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

        ticket1 = Product.create({
            name: 'ticket1',
            type: ProductType.Ticket
        })

        ticket2 = Product.create({
            name: 'ticket2',
            type: ProductType.Ticket
        })

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
            paymentConfiguration: paymentConfigurationPatch,
            ticketType: WebshopTicketType.Tickets
        })

        const privateMeta = WebshopPrivateMetaData.patch({
            paymentConfiguration: privatePaymentConfiguration
        })

        webshop = await new WebshopFactory({
            organizationId: organization.id,
            name: 'Test webshop',
            meta,
            privateMeta,
            products: [ticket1, ticket2, seatProduct]
        }).create()
    });

    test("POS payments create tickets", async () => {
        const item1 = CartItem.create({
            product: ticket1,
            productPrice: ticket1.prices[0],
            amount: 5
        });

        const item2 = CartItem.create({
            product: ticket2,
            productPrice: ticket2.prices[0],
            amount: 2
        });

        const orderData = OrderData.create({
            paymentMethod: PaymentMethod.PointOfSale,
            cart: Cart.create({
                items: [
                    item1,
                    item2
                ]
            }),
            customer
        })
        
        const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        const order = response.body.order;

        // Check tickets
        const tickets = await Ticket.where({orderId: order.id});
        expect(tickets).toHaveLength(7);

        const item1Tickets = tickets.filter(t => t.itemId === item1.id);
        const item2Tickets = tickets.filter(t => t.itemId === item2.id);

        expect(item1Tickets).toHaveLength(5);
        expect(item2Tickets).toHaveLength(2);
        
        // Check indexes present
        expect(item1Tickets.map(i => i.index).sort()).toEqual([1, 2, 3, 4, 5])
        expect(item2Tickets.map(i => i.index).sort()).toEqual([1, 2])

        // Check total present
        expect(item1Tickets.map(i => i.total).sort()).toEqual([5, 5, 5, 5, 5])
        expect(item2Tickets.map(i => i.total).sort()).toEqual([2, 2])

        expect(tickets.map(mapTicketCreation)).toIncludeSameMembers([
            {
                seat: null,
                originalSeat: null,
                itemId: item1.id,
                index: 1,
                total: 5
            },
            {
                seat: null,
                originalSeat: null,
                itemId: item1.id,
                index: 2,
                total: 5
            },
            {
                seat: null,
                originalSeat: null,
                itemId: item1.id,
                index: 3,
                total: 5
            },
            {
                seat: null,
                originalSeat: null,
                itemId: item1.id,
                index: 4,
                total: 5
            },
            {
                seat: null,
                originalSeat: null,
                itemId: item1.id,
                index: 5,
                total: 5
            },
            {
                seat: null,
                originalSeat: null,
                itemId: item2.id,
                index: 1,
                total: 2
            },
            {
                seat: null,
                originalSeat: null,
                itemId: item2.id,
                index: 2,
                total: 2
            }
        ])
    });

    test("Adding new items keeps all tickets in place", async () => {
        const item1 = CartItem.create({
            product: ticket1,
            productPrice: ticket1.prices[0],
            amount: 5
        });

        const item2 = CartItem.create({
            product: ticket2,
            productPrice: ticket2.prices[0],
            amount: 2
        });

        const orderData = OrderData.create({
            paymentMethod: PaymentMethod.PointOfSale,
            cart: Cart.create({
                items: [
                    item1,
                    item2
                ]
            }),
            customer
        })
        
        const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        const order = response.body.order;

        // Check tickets
        const tickets = await Ticket.where({orderId: order.id});
        expect(tickets).toHaveLength(7);

        // Now add an extra item

        const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

        const cartPatch = Cart.patch({})
        cartPatch.items.addPatch(CartItem.patch({
            id: item1.id,
            amount: 7
        }));

        const orderPatch = PrivateOrder.patch({id: order.id, data: OrderData.patch({cart: cartPatch})});
        patchArray.addPatch(orderPatch);

        // Send a patch
        const r2 = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
        r2.headers.authorization = "Bearer " + token.accessToken

        await patchWebshopOrdersEndpoint.test(r2);

        const ticketsAfter = await Ticket.where({orderId: order.id});
        expect(ticketsAfter).toHaveLength(9);

        // Didn't change old tickets:
        expect(ticketsAfter.map(mapTicketChangedAmount)).toIncludeAllMembers(tickets.map(mapTicketChangedAmount));

        // Added 2 new items with index 6 and 7
        const newTickets = ticketsAfter.filter(t => !tickets.find(tt => tt.id === t.id))
        expect(newTickets).toHaveLength(2);

        expect(newTickets.map(mapTicketCreation)).toIncludeSameMembers([
            {
                seat: null,
                originalSeat: null,
                itemId: item1.id,
                index: 6,
                total: 7
            },
            {
                seat: null,
                originalSeat: null,
                itemId: item1.id,
                index: 7,
                total: 7
            }
        ])

        expect(ticketsAfter.map(mapTicketCreation)).toIncludeSameMembers([
            {
                seat: null,
                originalSeat: null,
                itemId: item1.id,
                index: 1,
                total: 7
            },
            {
                seat: null,
                originalSeat: null,
                itemId: item1.id,
                index: 2,
                total: 7
            },
            {
                seat: null,
                originalSeat: null,
                itemId: item1.id,
                index: 3,
                total: 7
            },
            {
                seat: null,
                originalSeat: null,
                itemId: item1.id,
                index: 4,
                total: 7
            },
            {
                seat: null,
                originalSeat: null,
                itemId: item1.id,
                index: 5,
                total: 7
            },
            {
                seat: null,
                originalSeat: null,
                itemId: item1.id,
                index: 6,
                total: 7
            },
            {
                seat: null,
                originalSeat: null,
                itemId: item1.id,
                index: 7,
                total: 7
            },
            {
                seat: null,
                originalSeat: null,
                itemId: item2.id,
                index: 1,
                total: 2
            },
            {
                seat: null,
                originalSeat: null,
                itemId: item2.id,
                index: 2,
                total: 2
            }
        ])
        
    });

    test("Deleting items deletes tickets", async () => {
        const item1 = CartItem.create({
            product: ticket1,
            productPrice: ticket1.prices[0],
            amount: 5
        });

        const item2 = CartItem.create({
            product: ticket2,
            productPrice: ticket2.prices[0],
            amount: 2
        });

        const orderData = OrderData.create({
            paymentMethod: PaymentMethod.PointOfSale,
            cart: Cart.create({
                items: [
                    item1,
                    item2
                ]
            }),
            customer
        })
        
        const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        const order = response.body.order;

        // Check tickets
        const tickets = await Ticket.where({orderId: order.id});
        expect(tickets).toHaveLength(7);

        // Now add an extra item

        const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

        const cartPatch = Cart.patch({})
        cartPatch.items.addDelete(item2.id);

        const orderPatch = PrivateOrder.patch({id: order.id, data: OrderData.patch({cart: cartPatch})});
        patchArray.addPatch(orderPatch);

        // Send a patch
        const r2 = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
        r2.headers.authorization = "Bearer " + token.accessToken

        await patchWebshopOrdersEndpoint.test(r2);

        const ticketsAfter = await Ticket.where({orderId: order.id});
        expect(ticketsAfter).toHaveLength(7);
        const deletedTickets = ticketsAfter.filter(t => t.isDeleted)
        const remainingTickets = ticketsAfter.filter(t => !t.isDeleted)
        expect(deletedTickets).toHaveLength(2);
        expect(remainingTickets).toHaveLength(5);

        // Didn't change old tickets:
        expect(deletedTickets.map(mapTicketChangedAmount)).toIncludeSameMembers(tickets.filter(t => t.itemId === item2.id).map(mapTicketChangedAmount));
        expect(remainingTickets.map(mapTicketChangedAmount)).toIncludeSameMembers(tickets.filter(t => t.itemId === item1.id).map(mapTicketChangedAmount));
    });

    test("Deleting an order deletes tickets", async () => {
        const item1 = CartItem.create({
            product: ticket1,
            productPrice: ticket1.prices[0],
            amount: 5
        });

        const item2 = CartItem.create({
            product: ticket2,
            productPrice: ticket2.prices[0],
            amount: 2
        });

        const orderData = OrderData.create({
            paymentMethod: PaymentMethod.PointOfSale,
            cart: Cart.create({
                items: [
                    item1,
                    item2
                ]
            }),
            customer
        })
        
        const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        const order = response.body.order;

        // Check tickets
        const tickets = await Ticket.where({orderId: order.id});
        expect(tickets).toHaveLength(7);

        // Now add an extra item

        const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

        const orderPatch = PrivateOrder.patch({id: order.id, status: OrderStatus.Deleted});
        patchArray.addPatch(orderPatch);

        // Send a patch
        const r2 = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
        r2.headers.authorization = "Bearer " + token.accessToken

        await patchWebshopOrdersEndpoint.test(r2);

        const ticketsAfter = await Ticket.where({orderId: order.id});
        expect(ticketsAfter).toHaveLength(7);
        
        const deletedTickets = ticketsAfter.filter(t => t.isDeleted)
        const remainingTickets = ticketsAfter.filter(t => !t.isDeleted)
        expect(deletedTickets).toHaveLength(7);
        expect(remainingTickets).toHaveLength(0);
    });

    test("Reducing amount deletes tickets and reuses them again when added again", async () => {
        const item1 = CartItem.create({
            product: ticket1,
            productPrice: ticket1.prices[0],
            amount: 5
        });

        const item2 = CartItem.create({
            product: ticket2,
            productPrice: ticket2.prices[0],
            amount: 2
        });

        const orderData = OrderData.create({
            paymentMethod: PaymentMethod.PointOfSale,
            cart: Cart.create({
                items: [
                    item1,
                    item2
                ]
            }),
            customer
        })
        
        const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        const order = response.body.order;

        // Check tickets
        const tickets = await Ticket.where({orderId: order.id});
        expect(tickets).toHaveLength(7);

        // Now add an extra item
        {
            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

            const cartPatch = Cart.patch({})
            cartPatch.items.addPatch(CartItem.patch({
                id: item1.id,
                amount: 1
            }));

            const orderPatch = PrivateOrder.patch({id: order.id, data: OrderData.patch({cart: cartPatch})});
            patchArray.addPatch(orderPatch);

            // Send a patch
            const r2 = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r2.headers.authorization = "Bearer " + token.accessToken

            await patchWebshopOrdersEndpoint.test(r2);
        }

        let ticketsAfter = await Ticket.where({orderId: order.id});
        expect(ticketsAfter).toHaveLength(7);

        let deletedTickets = ticketsAfter.filter(t => t.isDeleted)
        let remainingTickets = ticketsAfter.filter(t => !t.isDeleted)
        expect(deletedTickets).toHaveLength(4);
        expect(remainingTickets).toHaveLength(3);

        // Didn't change tickets
        expect(ticketsAfter.map(mapTicketChangedAmount)).toIncludeSameMembers(tickets.map(mapTicketChangedAmount));

        // Now add an extra item

        {
            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()
            const cartPatch = Cart.patch({})
            cartPatch.items.addPatch(CartItem.patch({
                id: item1.id,
                amount: 5
            }));

            const orderPatch = PrivateOrder.patch({id: order.id, data: OrderData.patch({cart: cartPatch})});
            patchArray.addPatch(orderPatch);

            // Send a patch
            const r2 = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r2.headers.authorization = "Bearer " + token.accessToken

            await patchWebshopOrdersEndpoint.test(r2);
        }

        ticketsAfter = await Ticket.where({orderId: order.id});
        expect(ticketsAfter).toHaveLength(7);

        deletedTickets = ticketsAfter.filter(t => t.isDeleted)
        remainingTickets = ticketsAfter.filter(t => !t.isDeleted)
        expect(deletedTickets).toHaveLength(0);
        expect(remainingTickets).toHaveLength(7);

        // Didn't change tickets
        expect(ticketsAfter.map(mapTicketChangedAmount)).toIncludeSameMembers(tickets.map(mapTicketChangedAmount));
    });

    test("Seats are assigned to each ticket as expected", async () => {
        const item1 = CartItem.create({
            product: ticket1,
            productPrice: ticket1.prices[0],
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

        const orderData = OrderData.create({
            paymentMethod: PaymentMethod.PointOfSale,
            cart: Cart.create({
                items: [
                    item1
                ]
            }),
            customer
        })
        
        const r = Request.buildJson("POST", `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        const order = response.body.order;

        // Check tickets
        const tickets = await Ticket.where({orderId: order.id});
        expect(tickets).toHaveLength(3);

        expect(tickets.map(mapTicketCreation)).toIncludeSameMembers([
            {
                itemId: item1.id,
                index: 1,
                seat: item1.seats[0],
                originalSeat: item1.seats[0],
                total: 3,
            },
            {
                itemId: item1.id,
                index: 2,
                seat: item1.seats[1],
                originalSeat: item1.seats[1],
                total: 3
            },
            {
                itemId: item1.id,
                index: 3,
                seat: item1.seats[2],
                originalSeat: item1.seats[2],
                total: 3
            }
        ])

        // Now move a seat
        {
            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

            const cartPatch = Cart.patch({})
            cartPatch.items.addPatch(CartItem.patch({
                id: item1.id,
                seats: [
                    CartReservedSeat.create({
                        section: seatingPlan.sections[0].id,
                        row: 'A',
                        seat: '2'
                    }),
                    CartReservedSeat.create({
                        section: seatingPlan.sections[0].id,
                        row: 'A',
                        seat: '3'
                    }),
                    CartReservedSeat.create({
                        section: seatingPlan.sections[0].id,
                        row: 'A',
                        seat: '4'
                    }),
                ]
            }));

            const orderPatch = PrivateOrder.patch({id: order.id, data: OrderData.patch({cart: cartPatch})});
            patchArray.addPatch(orderPatch);

            // Send a patch
            const r2 = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r2.headers.authorization = "Bearer " + token.accessToken

            await patchWebshopOrdersEndpoint.test(r2);
        }

        let ticketsAfter = await Ticket.where({orderId: order.id});
        expect(ticketsAfter).toHaveLength(3);

        let deletedTickets = ticketsAfter.filter(t => t.isDeleted)
        let remainingTickets = ticketsAfter.filter(t => !t.isDeleted)
        expect(deletedTickets).toHaveLength(0);
        expect(remainingTickets).toHaveLength(3);

        expect(ticketsAfter.map(mapTicketChangedAmount)).toIncludeSameMembers([
            {
                ...mapTicketChangedAmount(tickets.find(t => t.index === 1)!),
                index: 3,
                seat: CartReservedSeat.create({
                    section: seatingPlan.sections[0].id,
                    row: 'A',
                    seat: '4'
                }),
                originalSeat: item1.seats[0]
            },
            {
                ...mapTicketChangedAmount(tickets.find(t => t.index === 2)!),
                index: 1,
                seat: item1.seats[1],
                originalSeat: item1.seats[1]
            },
            {
                ...mapTicketChangedAmount(tickets.find(t => t.index === 3)!),
                index: 2,
                seat: item1.seats[2],
                originalSeat: item1.seats[2]
            }
        ])

        // Move it back and also delete a different seat
        {
            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

            const cartPatch = Cart.patch({})
            cartPatch.items.addPatch(CartItem.patch({
                id: item1.id,
                amount: 2,
                seats: [
                    CartReservedSeat.create({
                        section: seatingPlan.sections[0].id,
                        row: 'A',
                        seat: '2'
                    }),
                    CartReservedSeat.create({
                        section: seatingPlan.sections[0].id,
                        row: 'A',
                        seat: '1'
                    }),
                ]
            }));

            const orderPatch = PrivateOrder.patch({id: order.id, data: OrderData.patch({cart: cartPatch})});
            patchArray.addPatch(orderPatch);

            // Send a patch
            const r2 = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r2.headers.authorization = "Bearer " + token.accessToken

            await patchWebshopOrdersEndpoint.test(r2);
        }

        ticketsAfter = await Ticket.where({orderId: order.id});
        expect(ticketsAfter).toHaveLength(3);

        deletedTickets = ticketsAfter.filter(t => t.isDeleted)
        remainingTickets = ticketsAfter.filter(t => !t.isDeleted)
        expect(deletedTickets).toHaveLength(1);
        expect(remainingTickets).toHaveLength(2);

        // Note we correctly reused the tickets here
        expect(remainingTickets.map(mapTicketChangedAmount)).toIncludeSameMembers([
            {
                ...mapTicketChangedAmount(tickets.find(t => t.index === 1)!),
                index: 2
            },
            {
                ...mapTicketChangedAmount(tickets.find(t => t.index === 2)!),
                index: 1
            }
        ])

        expect(deletedTickets.map(mapTicketChangedAmount)).toIncludeSameMembers([
            {
                ...mapTicketChangedAmount(tickets.find(t => t.index === 3)!),
                index: 2
            }
        ])

        // Add two total new different seats
        {
            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

            const cartPatch = Cart.patch({})
            cartPatch.items.addPatch(CartItem.patch({
                id: item1.id,
                amount: 4,
                seats: [
                    CartReservedSeat.create({
                        section: seatingPlan.sections[0].id,
                        row: 'A',
                        seat: '2'
                    }),
                    CartReservedSeat.create({
                        section: seatingPlan.sections[0].id,
                        row: 'A',
                        seat: '1'
                    }),
                    CartReservedSeat.create({
                        section: seatingPlan.sections[0].id,
                        row: 'B',
                        seat: '1'
                    }),
                    CartReservedSeat.create({
                        section: seatingPlan.sections[0].id,
                        row: 'B',
                        seat: '2'
                    }),
                ]
            }));

            const orderPatch = PrivateOrder.patch({id: order.id, data: OrderData.patch({cart: cartPatch})});
            patchArray.addPatch(orderPatch);

            // Send a patch
            const r2 = Request.buildJson("PATCH", `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r2.headers.authorization = "Bearer " + token.accessToken

            await patchWebshopOrdersEndpoint.test(r2);
        }

        ticketsAfter = await Ticket.where({orderId: order.id});
        expect(ticketsAfter).toHaveLength(4);

        deletedTickets = ticketsAfter.filter(t => t.isDeleted)
        remainingTickets = ticketsAfter.filter(t => !t.isDeleted)
        expect(deletedTickets).toHaveLength(0);
        expect(remainingTickets).toHaveLength(4);

        // Note we correctly reused the tickets here
        expect(remainingTickets.map(mapTicketChangedAmount)).toIncludeAllMembers([
            {
                ...mapTicketChangedAmount(tickets.find(t => t.index === 1)!),
                index: 2
            },
            {
                ...mapTicketChangedAmount(tickets.find(t => t.index === 2)!),
                index: 1
            },
            {
                ...mapTicketChangedAmount(tickets.find(t => t.index === 3)!),
                index: 3,
                seat: CartReservedSeat.create({
                    section: seatingPlan.sections[0].id,
                    row: 'B',
                    seat: '1'
                })
            }
        ])

        // One new one
        expect(remainingTickets.map(mapTicketCreation)).toIncludeAllMembers([
            {
                // new one!
                index: 4,
                itemId: item1.id,
                total: 4,

                seat: CartReservedSeat.create({
                    section: seatingPlan.sections[0].id,
                    row: 'B',
                    seat: '2'
                }),
                originalSeat: CartReservedSeat.create({
                    section: seatingPlan.sections[0].id,
                    row: 'B',
                    seat: '2'
                })
            }
        ]);

    });
});
