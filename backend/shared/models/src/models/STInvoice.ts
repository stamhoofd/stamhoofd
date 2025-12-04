import { createMollieClient } from '@mollie/api-client';
import { column } from '@simonbackx/simple-database';
import { SimpleError } from '@simonbackx/simple-errors';
import { QueryableModel } from '@stamhoofd/sql';
import { OrganizationPaymentMandate, OrganizationPaymentMandateDetails, STInvoiceMeta } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { Organization } from './index.js';

export class STInvoice extends QueryableModel {
    static table = 'stamhoofd_invoices';

    private static numberCache: number | null = null;

    // Columns
    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    /**
     * Organization that made the invoice. Can be null if the organization was deleted and for the migration from V1 -> V2
     */
    @column({ type: 'string', nullable: true })
    organizationId: string | null;

    /**
     * Organization that is associated with this invoice (can be null if deleted or unknown)
     */
    @column({ type: 'string', nullable: true })
    payingOrganizationId: string | null;

    /**
     * An associated STCredit, that was used to remove credits from the user's credits.
     * If the invoice is marked as failed, we need to delete this one
     */
    @column({ type: 'string', nullable: true })
    creditId: string | null = null;

    /**
     * Note: always create a new invoice for failed payments. We never create an actual invoice until we received the payment
     */
    @column({ type: 'string', nullable: true })
    paymentId: string | null = null;

    @column({ type: 'json', decoder: STInvoiceMeta })
    meta: STInvoiceMeta;

    /**
     * If the number is null, no invoice is generated yet. Its still a WIP invoice (not an official one!)
     */
    @column({ type: 'integer', nullable: true })
    number: number | null = null;

    @column({ type: 'datetime', nullable: true })
    paidAt: Date | null = null;

    @column({
        type: 'datetime', beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    @column({ type: 'string', nullable: true })
    reference: string | null = null;

    @column({ type: 'boolean' })
    didSendPeppol = false;

    // static organization = new ManyToOneRelation(Organization, 'organization');
    // static payment = new ManyToOneRelation(Payment, 'payment');

    static async getMollieMandates(organization: Organization) {
        // Poll mollie status
        // Mollie payment is required
        const mandates: OrganizationPaymentMandate[] = [];

        try {
            const apiKey = STAMHOOFD.MOLLIE_API_KEY;
            if (!apiKey) {
                throw new SimpleError({
                    code: '',
                    message: 'Mollie niet correct gekoppeld',
                });
            }

            const mollieClient = createMollieClient({ apiKey });

            if (organization.serverMeta.mollieCustomerId) {
                const m = await mollieClient.customerMandates.page({ customerId: organization.serverMeta.mollieCustomerId, limit: 250 });
                for (const mandate of m) {
                    try {
                        const details = mandate.details;
                        mandates.push(OrganizationPaymentMandate.create({
                            ...mandate,
                            isDefault: mandate.id === organization.serverMeta.mollieMandateId,
                            createdAt: new Date(mandate.createdAt),
                            details: OrganizationPaymentMandateDetails.create({
                                consumerName: ('consumerName' in details ? details.consumerName : details.cardHolder) ?? undefined,
                                consumerAccount: ('consumerAccount' in details ? details.consumerAccount : details.cardNumber) ?? undefined,
                                consumerBic: ('consumerBic' in details ? details.consumerBic : details.cardExpiryDate) ?? undefined,
                                cardExpiryDate: ('cardExpiryDate' in details ? details.cardExpiryDate : null),
                                cardLabel: ('cardLabel' in details ? details.cardLabel : null),
                            }),
                        }));
                    }
                    catch (e) {
                        console.error(e);
                    }
                }
            }
        }
        catch (e) {
            console.error(e);
        }
        return mandates;
    }
}
