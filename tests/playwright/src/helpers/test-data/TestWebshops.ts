import type { Organization, Webshop } from '@stamhoofd/models';
import { WebshopFactory } from '@stamhoofd/models';
import { PaymentConfiguration, PaymentMethod, PrivatePaymentConfiguration, Product, ProductPrice, ProductType, SeatingPlan, SeatingPlanRow, SeatingPlanSeat, SeatingPlanSection, TransferSettings, WebshopMetaData, WebshopPrivateMetaData } from '@stamhoofd/structures';
import { WorkerData } from '../worker/WorkerData.js';

export class TestWebshops {
    static async webshopWithTicketsAndSeatingPlan({organization, stripeAccountId, seatCount}:{organization: Organization, stripeAccountId?: string, seatCount?: number}): Promise<{webshop: Webshop}> {

        let meta = WebshopMetaData.patch({});

        const rows: SeatingPlanRow[] = [];

        if (seatCount === undefined) {
            seatCount = 8;
        }

        const abc = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

        for (let i = 0; i < seatCount; i++) {
            const seats: SeatingPlanSeat[] = [];

            // 8 seats per row
            let order = 1;
            while (i < seatCount && seats.length < 8) {
                const seat = SeatingPlanSeat.create({
                    label: order.toString(),
                })
                order++;
                i++;
                seats.push(seat);
            }

            const label = abc[rows.length];
            if (label === undefined) {
                throw new Error('Max seat count exceeded');
            }

            rows.push(SeatingPlanRow.create({
                label,
                seats,
            }));
        }

        const seatingPlan = SeatingPlan.create({
            name: 'plan1',
            sections: [
                SeatingPlanSection.create({
                        rows
                    })
                ]
        });

        meta.seatingPlans.addPut(seatingPlan);

        const productPrice1 = ProductPrice.create({
            name: 'productPrice1',
            price: 150000,
        })

        // products
        const product1 = Product.create({
            name: 'product1',
            prices: [productPrice1],
            type: ProductType.Ticket,
            seatingPlanId: seatingPlan.id
        })

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
            webshop
        };
    }
    
}
