import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, BalanceItemPayment, Payment } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { PaymentGeneral, PaymentMethod, PaymentStatus, Payment as PaymentStruct, PaymentType, PermissionLevel } from '@stamhoofd/structures';

import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures';
import { Context } from '../../../../helpers/Context';
import { BalanceItemService } from '../../../../services/BalanceItemService';
import { PaymentService } from '../../../../services/PaymentService';

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<PaymentGeneral>;
type ResponseBody = PaymentGeneral[];

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class PatchPaymentsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(PaymentGeneral as Decoder<PaymentGeneral>, PaymentStruct.patchType() as Decoder<AutoEncoderPatchType<PaymentGeneral>>, StringDecoder);

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/payments', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error();
        }

        const changedPayments: Payment[] = [];

        // Modify payments
        for (const { put } of request.body.getPuts()) {
            // Create a new payment
            if (put.balanceItemPayments.length === 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'You need to add at least one balance item payment',
                    human: $t(`Een betaling moet ten minste één item bestaan`),
                    field: 'balanceItemPayments',
                });
            }

            if (![PaymentMethod.Unknown, PaymentMethod.Transfer, PaymentMethod.PointOfSale].includes(put.method)) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Invalid payment method',
                    human: $t(`Je kan zelf geen online betalingen aanmaken`),
                    field: 'method',
                });
            }

            const payment = new Payment();
            payment.organizationId = organization.id;
            payment.status = PaymentStatus.Created;
            payment.method = put.method;
            payment.customer = put.customer;
            payment.type = put.type;

            if (payment.method === PaymentMethod.Transfer) {
                if (!put.transferSettings) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Transfer settings are required',
                        human: $t(`Je moet de overschrijvingsdetails invullen`),
                        field: 'transferSettings',
                    });
                }

                payment.transferSettings = put.transferSettings;

                if (!put.transferDescription) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Transfer description is required',
                        human: $t(`Je moet een mededeling invullen voor de overschrijving`),
                        field: 'transferDescription',
                    });
                }

                payment.transferDescription = put.transferDescription;
            }

            const balanceItems: BalanceItem[] = [];
            const balanceItemPayments: BalanceItemPayment[] = [];

            for (const item of put.balanceItemPayments) {
                const balanceItem = await BalanceItem.getByID(item.balanceItem.id);
                if (!balanceItem || balanceItem.organizationId !== organization.id) {
                    throw Context.auth.notFoundOrNoAccess($t(`Eén van de afrekeningen die je wilde markeren als betaald bestaat niet (meer).`));
                }
                balanceItems.push(balanceItem);

                // Create payment
                const balanceItemPayment = new BalanceItemPayment();
                balanceItemPayment.organizationId = organization.id;
                balanceItemPayment.balanceItemId = balanceItem.id;
                balanceItemPayment.price = item.price;

                if (item.price !== 0) {
                    // Otherwise skip
                    balanceItemPayments.push(balanceItemPayment);
                }
            }

            // Check permissions
            if (!(await Context.auth.canAccessBalanceItems(balanceItems, PermissionLevel.Write))) {
                throw Context.auth.error($t(`Je hebt geen toegangsrechten tot één van de gekozen afrekeningen voor de betaling die je wilt aanmaken`));
            }

            // Check total price
            const totalPrice = balanceItemPayments.reduce((total, item) => total + item.price, 0);
            payment.price = totalPrice;

            switch (payment.type) {
                case PaymentType.Payment: {
                    if (totalPrice <= 0) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'The price should be greater than zero',
                            human: $t(`Het totaalbedrag moet groter zijn dan 0 euro`),
                            field: 'price',
                        });
                    }
                    break;
                }

                case PaymentType.Chargeback:
                case PaymentType.Refund: {
                    if (totalPrice >= 0) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'The price should be smaller than zero',
                            human: $t(`Het totaalbedrag moet kleiner zijn dan 0 euro`),
                            field: 'price',
                        });
                    }
                    break;
                }

                case PaymentType.Reallocation:
                {
                    if (totalPrice !== 0) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Total price should be zero',
                            human: $t(`Het totaalbedrag moet 0 euro zijn`),
                            field: 'price',
                        });
                    }

                    if (balanceItemPayments.length < 2) {
                        throw new SimpleError({
                            code: 'missing_items',
                            message: 'At least two items are required for a reallocation',
                            human: $t(`Er moeten minstens twee items in een verrekening zitten`),
                        });
                    }
                    break;
                }
            }

            // Save payment
            await payment.save();

            // Save balance item payments
            for (const balanceItemPayment of balanceItemPayments) {
                balanceItemPayment.paymentId = payment.id;
                await balanceItemPayment.save();
            }

            // Mark paid or failed
            if (put.status !== PaymentStatus.Created && put.status !== PaymentStatus.Pending) {
                await PaymentService.handlePaymentStatusUpdate(payment, organization, put.status);

                if (put.status === PaymentStatus.Succeeded) {
                    payment.paidAt = put.paidAt;
                    await payment.save();
                }
            }
            else {
                for (const balanceItem of balanceItems) {
                    await BalanceItemService.markUpdated(balanceItem, payment, organization);
                }

                await BalanceItem.updateOutstanding(balanceItems);

                // Reallocate
                await BalanceItemService.reallocate(balanceItems, organization.id);
            }

            changedPayments.push(payment);
        }

        // Modify payments
        for (const patch of request.body.getPatches()) {
            await QueueHandler.schedule('payments/' + patch.id, async () => {
                const payment = await Payment.getByID(patch.id);
                if (!payment || !(await Context.auth.canAccessPayment(payment, PermissionLevel.Write))) {
                    throw new SimpleError({
                        code: 'not_found',
                        message: 'Payment not found',
                        human: $t(`Deze betaling werd niet gevonden.`),
                    });
                }

                if (patch.method || patch.paidAt !== undefined || patch.status !== undefined) {
                    if (payment.method && ![PaymentMethod.Unknown, PaymentMethod.Transfer, PaymentMethod.PointOfSale].includes(payment.method)) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid payment method',
                            human: $t(`Je kan online betalingen niet wijzigen`),
                        });
                    }
                }

                if (patch.transferSettings && payment.method == PaymentMethod.Transfer) {
                    if (patch.transferSettings.isPut()) {
                        payment.transferSettings = patch.transferSettings;
                    }
                    else if (payment.transferSettings !== null) {
                        payment.transferSettings = payment.transferSettings.patch(patch.transferSettings);
                    }
                }

                if (patch.method) {
                    if (![PaymentMethod.Unknown, PaymentMethod.Transfer, PaymentMethod.PointOfSale].includes(patch.method)) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid payment method',
                            human: $t(`De betaalmethode die je wilt gebruiken is niet toegestaan`),
                            field: 'method',
                        });
                    }
                    payment.method = patch.method;

                    if (payment.method === PaymentMethod.Transfer && patch.transferDescription === undefined && !payment.transferDescription) {
                        payment.transferSettings = payment.transferSettings ?? organization.meta.transferSettings;
                        // TODO: fill in description!
                        payment.generateDescription(organization, '');
                    }
                }

                if (patch.transferDescription && payment.method == PaymentMethod.Transfer) {
                    payment.transferDescription = patch.transferDescription;
                }

                if (patch.paidAt && payment.paidAt !== null) {
                    // Only allow to set the date if it is already set
                    payment.paidAt = patch.paidAt;
                }

                await payment.save();

                if (patch.status) {
                    await PaymentService.handlePaymentStatusUpdate(payment, organization, patch.status);
                }

                changedPayments.push(
                    payment,
                );
            });
        }

        return new Response(
            await AuthenticatedStructures.paymentsGeneral(changedPayments, true),
        );
    }
}
