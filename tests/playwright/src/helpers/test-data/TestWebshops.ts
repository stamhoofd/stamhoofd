import type { Organization, Webshop } from '@stamhoofd/models';
import { WebshopFactory } from '@stamhoofd/models';
import { PaymentConfiguration, PaymentMethod, PrivatePaymentConfiguration, Product, ProductPrice, ProductType, SeatingPlan, SeatingPlanRow, SeatingPlanSeat, SeatingPlanSection, TransferSettings, WebshopDeliveryMethod, WebshopMetaData, WebshopPrivateMetaData, WebshopTicketType, WebshopType } from '@stamhoofd/structures';
import type { Country } from '@stamhoofd/types/Country';
import { CaddyConfigHelper } from '../../setup/helpers/CaddyConfigHelper.js';
import { WorkerData } from '../worker/WorkerData.js';

export interface CreateWebshopOptions {
    organization: Organization;
    /** None = normal shop, SingleTicket = one ticket per order, Tickets = one ticket per item */
    ticketType?: WebshopTicketType;
    /** Number of distinct products in the shop */
    productCount?: number;
    /** Whether a cart is used (multiple items) or each product goes straight to checkout */
    cartEnabled?: boolean;
    /** Add a seating plan to the products (only meaningful for Tickets per item) */
    withSeatingPlan?: boolean;
    /** Price per product in cents (default € 15,00). Use 0 for a free shop. */
    price?: number;
    /** Allowed payment methods on the webshop */
    paymentMethods?: PaymentMethod[];
    /** Link a Stripe account so online payments route to Stripe */
    stripeAccountId?: string;
    /** Host the webshop on a custom domain (prefix.<custom-tld>) instead of the default domain */
    customDomainPrefix?: string;
    /** Optional uri suffix on the custom domain (tickets.domain.com/<domainUri>) */
    domainUri?: string;
    name?: string;
    /** Ask for the customer's birth day during checkout */
    birthDayEnabled?: boolean;
    /** Ask for the customer's address during checkout */
    addressEnabled?: boolean;
    /** Ask for the customer's gender during checkout */
    genderEnabled?: boolean;
    /** Add a delivery checkout method covering the given countries (enables the delivery address step) */
    deliveryCountries?: Country[];
    /** Raw HTML injected into the document head on custom domains (script/style tags) */
    customCode?: string | null;
}

export class TestWebshops {
    /**
     * Flexible builder used by the order tests. Covers all combinations of ticket type, cart style,
     * seating, payment methods and hosting domain.
     */
    static async create(options: CreateWebshopOptions): Promise<{ webshop: Webshop }> {
        const {
            organization,
            ticketType = WebshopTicketType.None,
            productCount = 1,
            cartEnabled = true,
            withSeatingPlan = false,
            price = 15_0000,
            paymentMethods = [PaymentMethod.PointOfSale],
            stripeAccountId,
            customDomainPrefix,
            domainUri,
            name = `Testwebshop ${WorkerData.id}`,
            birthDayEnabled = false,
            addressEnabled = false,
            genderEnabled = false,
            deliveryCountries,
            customCode,
        } = options;

        let meta = WebshopMetaData.patch({});

        let seatingPlanId: string | null = null;
        if (withSeatingPlan) {
            const seatingPlan = this.buildSeatingPlan(16);
            meta.seatingPlans.addPut(seatingPlan);
            seatingPlanId = seatingPlan.id;
        }

        const products: Product[] = [];
        const productType = ticketType === WebshopTicketType.Tickets ? ProductType.Ticket : ProductType.Product;
        for (let i = 0; i < productCount; i++) {
            products.push(Product.create({
                name: `Product ${i + 1}`,
                prices: [ProductPrice.create({ name: `Price ${i + 1}`, price })],
                type: productType,
                seatingPlanId: withSeatingPlan ? seatingPlanId : null,
            }));
        }

        const paymentConfigurationPatch = PaymentConfiguration.patch({
            transferSettings: TransferSettings.create({
                iban: 'BE56587127952688', // = random IBAN
            }),
        });
        for (const method of paymentMethods) {
            paymentConfigurationPatch.paymentMethods.addPut(method);
        }

        meta = meta.patch({
            paymentConfiguration: paymentConfigurationPatch,
            ticketType,
            type: withSeatingPlan ? WebshopType.Performance : (ticketType === WebshopTicketType.None ? WebshopType.Webshop : WebshopType.Event),
            cartEnabled,
            // Keep the customer step minimal so the order flow doesn't require a phone number
            phoneEnabled: false,
            birthDayEnabled,
            addressEnabled,
            genderEnabled,
            customCode,
        });

        if (deliveryCountries) {
            meta.checkoutMethods.addPut(WebshopDeliveryMethod.create({
                name: 'Levering',
                countries: deliveryCountries,
            }));
        }

        const privateMeta = WebshopPrivateMetaData.patch({
            paymentConfiguration: PrivatePaymentConfiguration.patch({ stripeAccountId }),
        });

        const webshop = await new WebshopFactory({
            organizationId: organization.id,
            name,
            meta,
            privateMeta,
            products,
        }).create();

        if (customDomainPrefix) {
            if (WorkerData.id === undefined) {
                throw new Error('Worker id is not set');
            }
            webshop.domain = CaddyConfigHelper.getWebshopCustomDomain(customDomainPrefix, WorkerData.id);
            webshop.domainUri = domainUri ?? null;
            // domainActive is required, otherwise the frontend redirects to the default domain
            webshop.meta.domainActive = true;
            await webshop.save();
        }

        return { webshop };
    }

    static async webshopWithTicketsAndSeatingPlan({ organization, stripeAccountId, seatCount, ticketType }: { organization: Organization; stripeAccountId?: string; seatCount?: number; ticketType?: WebshopTicketType }): Promise<{ webshop: Webshop }> {
        if (!ticketType) {
            ticketType = WebshopTicketType.SingleTicket;
        }

        let meta = WebshopMetaData.patch({});

        const seatingPlan = this.buildSeatingPlan(seatCount ?? 8);
        meta.seatingPlans.addPut(seatingPlan);

        const productPrice1 = ProductPrice.create({
            name: 'productPrice1',
            price: 150000,
        });

        // products
        const product1 = Product.create({
            name: 'product1',
            prices: [productPrice1],
            type: ProductType.Ticket,
            seatingPlanId: seatingPlan.id,
        });

        const paymentConfigurationPatch = PaymentConfiguration.patch({
            transferSettings: TransferSettings.create({
                iban: 'BE56587127952688', // = random IBAN
            }),
        });
        paymentConfigurationPatch.paymentMethods.addPut(PaymentMethod.PointOfSale);
        paymentConfigurationPatch.paymentMethods.addPut(PaymentMethod.Transfer);
        paymentConfigurationPatch.paymentMethods.addPut(PaymentMethod.Bancontact);

        meta = meta.patch({
            paymentConfiguration: paymentConfigurationPatch,
            type: WebshopType.Performance,
            ticketType,
        });

        const privatePaymentConfiguration = PrivatePaymentConfiguration.patch({
            stripeAccountId,
        });

        const privateMeta = WebshopPrivateMetaData.patch({
            paymentConfiguration: privatePaymentConfiguration,
        });

        // webshop
        const webshop = await new WebshopFactory({
            organizationId: organization.id,
            name: `Testwebshop ${WorkerData.id}`,
            meta,
            privateMeta,
            products: [product1],
        }).create();

        return {
            webshop,
        };
    }

    /**
     * Build a seating plan with one section, 8 seats per row.
     */
    private static buildSeatingPlan(seatCount: number): SeatingPlan {
        const abc = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
        const rows: SeatingPlanRow[] = [];

        for (let i = 0; i < seatCount; i++) {
            const seats: SeatingPlanSeat[] = [];

            // 8 seats per row
            let order = 1;
            while (i < seatCount && seats.length < 8) {
                seats.push(SeatingPlanSeat.create({ label: order.toString() }));
                order++;
                i++;
            }

            const label = abc[rows.length];
            if (label === undefined) {
                throw new Error('Max seat count exceeded');
            }

            rows.push(SeatingPlanRow.create({ label, seats }));
        }

        return SeatingPlan.create({
            name: 'plan1',
            sections: [SeatingPlanSection.create({ rows })],
        });
    }
}
