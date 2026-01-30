import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, patchObject, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, BalanceItemPayment, Payment, User } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { PaymentCustomer, PaymentGeneral, PaymentMethod, PaymentStatus, Payment as PaymentStruct, PaymentType, PermissionLevel } from '@stamhoofd/structures';

import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../../helpers/Context.js';
import { BalanceItemService } from '../../../../services/BalanceItemService.js';
import { PaymentService } from '../../../../services/PaymentService.js';
import { ViesHelper } from '../../../../helpers/ViesHelper.js';

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
                    human: $t(`8b093b22-3e43-484d-b28c-da7f8db46aa0`),
                    field: 'balanceItemPayments',
                });
            }

            if (![PaymentMethod.Unknown, PaymentMethod.Transfer, PaymentMethod.PointOfSale].includes(put.method)) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Invalid payment method',
                    human: $t(`27b3013c-af5d-4c8e-9363-415c56b138b6`),
                    field: 'method',
                });
            }

            const payment = new Payment();
            payment.organizationId = organization.id;
            payment.status = PaymentStatus.Created;
            payment.method = put.method;
            payment.customer = put.customer;

            const payingOrganizationId = put.payingOrganizationId ?? put.payingOrganization?.id ?? null;

            if (payingOrganizationId) {
                if (Context.auth.hasSomePlatformAccess()) {
                    if (await Context.auth.hasFullAccess(payingOrganizationId, PermissionLevel.Full)) {
                        payment.payingOrganizationId = payingOrganizationId;
                    }
                    else {
                        // silently ignore
                    }
                }
            }

            if (put.payingUserId) {
                const user = await User.getByID(put.payingUserId);
                if (!user) {
                    throw new SimpleError({
                        code: 'user_not_found',
                        message: 'User not found',
                        field: 'payingUserId',
                    });
                }
                if (await Context.auth.canAccessUser(user, PermissionLevel.Full)) {
                    // Allowed
                    payment.payingUserId = put.payingUserId;
                }
            }

            if (put.customer?.company) {
                await ViesHelper.checkCompany(put.customer.company, put.customer.company);
            }
            payment.type = put.type;

            if (payment.type === PaymentType.Reallocation) {
                payment.method = PaymentMethod.Unknown;
            }

            if (payment.method === PaymentMethod.Transfer) {
                if (!put.transferSettings) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Transfer settings are required',
                        human: $t(`c6cdb321-3eb3-4689-aaed-0626e7ea0844`),
                        field: 'transferSettings',
                    });
                }

                payment.transferSettings = put.transferSettings;

                if (!put.transferDescription) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Transfer description is required',
                        human: $t(`16e792b1-bb90-4d09-b9c8-a1e382a2eafe`),
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
                    throw Context.auth.notFoundOrNoAccess($t(`701966b1-07e0-4ce6-9779-2193c1596825`));
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
                throw Context.auth.error($t(`19bc226c-2b4b-49bf-94a5-28e3d679ecc7`));
            }

            // Check total price
            const totalPrice = balanceItemPayments.reduce((total, item) => total + item.price, 0);
            payment.price = totalPrice;
            PaymentService.round(payment);

            switch (payment.type) {
                case PaymentType.Payment: {
                    if (totalPrice <= 0) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'The price should be greater than zero',
                            human: $t(`f4070936-7a8f-4373-af03-ca53200bb11b`),
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
                            human: $t(`9ebba3e9-d126-4e87-971e-1563c17a122e`),
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
                            human: $t(`5b5ec7ff-d48f-4943-80c3-f3d0e4b32989`),
                            field: 'price',
                        });
                    }

                    if (balanceItemPayments.length < 2) {
                        throw new SimpleError({
                            code: 'missing_items',
                            message: 'At least two items are required for a reallocation',
                            human: $t(`7b2fb731-37d9-4601-82c4-162abb2803f9`),
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
                        human: $t(`29e79d32-8805-4458-84db-c90e591f9727`),
                    });
                }

                if (patch.method || patch.paidAt !== undefined || patch.status !== undefined) {
                    if (payment.method && ![PaymentMethod.Unknown, PaymentMethod.Transfer, PaymentMethod.PointOfSale].includes(payment.method)) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'Invalid payment method',
                            human: $t(`6afcf043-3ccf-41e3-a840-36a18a8af809`),
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
                            human: $t(`eb03febc-d83b-4789-bb4d-0d97d542edfa`),
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

                if (patch.customer) {
                    payment.customer = patchObject(payment.customer, patch.customer, { defaultValue: PaymentCustomer.create({}) });
                }

                const payingOrganizationId = patch.payingOrganizationId ?? patch.payingOrganization?.id ?? null;

                if (payingOrganizationId) {
                    if (Context.auth.hasSomePlatformAccess()) {
                        if (await Context.auth.hasFullAccess(payingOrganizationId, PermissionLevel.Full)) {
                            payment.payingOrganizationId = payingOrganizationId;
                        }
                        else {
                            // silently ignore
                        }
                    }
                }

                if (patch.payingUserId) {
                    const user = await User.getByID(patch.payingUserId);
                    if (!user) {
                        throw new SimpleError({
                            code: 'user_not_found',
                            message: 'User not found',
                            field: 'payingUserId',
                        });
                    }
                    if (await Context.auth.canAccessUser(user, PermissionLevel.Full)) {
                        // Allowed
                        payment.payingUserId = patch.payingUserId;
                    }
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

        // Update balances before we return the up to date versions
        await BalanceItemService.flushCaches(organization.id);

        return new Response(
            await AuthenticatedStructures.paymentsGeneral(changedPayments, true),
        );
    }
}
