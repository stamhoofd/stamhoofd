import { Request } from "@simonbackx/simple-endpoints";
import { OrganizationFactory, Token, UserFactory } from "@stamhoofd/models";
import { Token as TokenStruct, Webshop } from "@stamhoofd/structures";

import { PlaceOrderEndpoint } from '../../src/endpoints/webshops/PlaceOrderEndpoint';

describe("E2E.Stock", () => {
    // Test endpoint
    const endpoint = new PlaceOrderEndpoint();

    describe('Reserving stock', () => {
        test("Online payments reserve the stock", async () => {
            const organization = await new OrganizationFactory({}).create()
            
            const webshop = new Webshop();


            const r = Request.buildJson("POST", "/webshop/@id/order", organization.getApiHost(), {
                grant_type: "password",
                username: user.email,
                password: password
            });

            const response = await endpoint.test(r);
            expect(response.body).toBeDefined();
        });

        test.todo("Transfer payments reserve the stock", async () => {
            //
        });

        test.todo("POS payments reserve the stock", async () => {
            //
        });

        test.todo("Orders placed by an admin reserve the stock", async () => {
            //
        });

        test.todo("Amount of persons and orders for a takeout method is calculated correctly", async () => {
            //
        });

    });

    describe('Full stock', () => {
        test.todo("Cannot place an order when product stock is full", async () => {
            //
        });

        test.todo("Cannot place an order when takeout persons stock is full", async () => {
            //
        });

        test.todo("Cannot place an order when takeout orders stock is full", async () => {
            //
        });
    });

    describe('Cleaning up stock', () => {
        test.todo("Stock is returned when a payment failed", async () => {
            // 
        });

        test.todo("Stock is added again if a failed payment succeeds unexpectedly", async () => {
            // 
        });
    });

    describe('Modifying orders', () => {
        test.todo("Stock is switched from one product to another", async () => {
            // 
        });

        test.todo("Stock is adjusted if product amount is changed", async () => {
            // 
        });

        test.todo("Reserved seats are changed when seats are switched", async () => {
            // 
        });

        test.todo("Stock is returned when an order is canceled", async () => {
            // 
        });

        test.todo("Stock is returned when an order is deleted", async () => {
            // 
        });

        test.todo("Stock is added again if orer is uncanceled", async () => {
            // 
        });
    });
});
