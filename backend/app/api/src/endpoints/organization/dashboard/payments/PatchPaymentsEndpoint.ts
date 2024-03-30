import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { BalanceItem, BalanceItemPayment, Payment, Token } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { Payment as PaymentStruct, PaymentGeneral, PaymentMethod, PaymentStatus, PermissionLevel } from "@stamhoofd/structures";

import { ExchangePaymentEndpoint } from '../../shared/ExchangePaymentEndpoint';

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<PaymentGeneral>
type ResponseBody = PaymentGeneral[]

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class PatchPaymentsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(PaymentGeneral as Decoder<PaymentGeneral>, PaymentStruct.patchType() as Decoder<AutoEncoderPatchType<PaymentGeneral>>, StringDecoder)

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/payments", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        // If the user has permission, we'll also search if he has access to the organization's key
        if (!user.permissions) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You don't have permissions to access payments",
                human: "Je hebt geen toegang tot betalingen"
            })
        }

        const changedPayments: PaymentGeneral[] = []

        // Modify payments
        for (const {put} of request.body.getPuts()) {
            // Create a new payment
            if (put.balanceItemPayments.length == 0) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "You need to add at least one balance item payment",
                    human: "Een betaling moet ten minste één afrekening bevatten voor een openstaande rekening.",
                    field: "balanceItemPayments"
                })
            }

            if (![PaymentMethod.Unknown, PaymentMethod.Transfer, PaymentMethod.PointOfSale].includes(put.method)) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Invalid payment method",
                    human: "Je kan zelf geen online betalingen aanmaken",
                    field: "method"
                })
            }

            const payment = new Payment()
            payment.organizationId = user.organizationId
            payment.status = PaymentStatus.Created
            payment.method = put.method

            if (payment.method == PaymentMethod.Transfer) {
                if (!put.transferSettings) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Transfer settings are required",
                        human: "Je moet de overschrijvingsdetails invullen",
                        field: "transferSettings"
                    })
                }

                payment.transferSettings = put.transferSettings

                if (!put.transferDescription) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Transfer description is required",
                        human: "Je moet een mededeling invullen voor de overschrijving",
                        field: "transferDescription"
                    })
                }

                payment.transferDescription = put.transferDescription
            }

            const balanceItems: BalanceItem[] = []
            const balanceItemPayments: BalanceItemPayment[] = [];

            for (const item of put.balanceItemPayments) {
                const balanceItem = await BalanceItem.getByID(item.balanceItem.id)
                if (!balanceItem || balanceItem.organizationId !== user.organizationId) {
                    throw new SimpleError({
                        code: "not_found",
                        message: "Balance item not found",
                        human: "Eén van de afrekeningen die je wilde markeren als betaald bestaat niet (meer).",
                        field: "balanceItem"
                    })
                }
                balanceItems.push(balanceItem)

                // Check permissions

                // Create payment
                const balanceItemPayment = new BalanceItemPayment()
                balanceItemPayment.organizationId = user.organizationId
                balanceItemPayment.balanceItemId = balanceItem.id
                balanceItemPayment.price = item.price
                balanceItemPayments.push(balanceItemPayment)
            }

            // Check permissions
            await Payment.checkBalanceItemPermissions({user, permissionLevel: PermissionLevel.Write}, balanceItems)

            // Check total price
            const totalPrice = balanceItemPayments.reduce((total, item) => total + item.price, 0)

            if (totalPrice !== put.price) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Total price doesn't match",
                    human: "De totale prijs komt niet overeen met de som van de afrekeningen",
                    field: "price"
                })
            }            

            payment.price = totalPrice

            // Save payment
            await payment.save();

            // Save balance item payments
            for (const balanceItemPayment of balanceItemPayments) {
                balanceItemPayment.paymentId = payment.id
                await balanceItemPayment.save()
            }

            // Mark paid or failed
            if (put.status !== PaymentStatus.Created && put.status !== PaymentStatus.Pending) {
                await ExchangePaymentEndpoint.handlePaymentStatusUpdate(payment, user.organization, put.status)

                if (put.status === PaymentStatus.Succeeded) {
                    payment.paidAt = put.paidAt
                    await payment.save()
                }
            } else {
                for (const balanceItem of balanceItems) {
                    await balanceItem.markUpdated(payment, user.organization)
                }
            }

            const paymentGeneral = await payment.getGeneralStructure();
            changedPayments.push(paymentGeneral)
        }

        // Modify payments
        for (const patch of request.body.getPatches()) {
            await QueueHandler.schedule("payments/"+patch.id, async () => {
                const payment = await Payment.getByID(patch.id);
                if (!payment || payment.organizationId !== user.organizationId) {
                    throw new SimpleError({
                        code: "not_found",
                        message: "Payment not found",
                        human: "Deze betaling werd niet gevonden."
                    })
                }

                // Check permissions
                const paymentGeneral = await payment.getGeneralStructure({user, permissionLevel: PermissionLevel.Write});

                if (patch.status) {
                    await ExchangePaymentEndpoint.handlePaymentStatusUpdate(payment, user.organization, patch.status)
                }

                if (patch.method || patch.paidAt !== undefined) {
                    if (payment.method && ![PaymentMethod.Unknown, PaymentMethod.Transfer, PaymentMethod.PointOfSale].includes(payment.method)) {
                        throw new SimpleError({
                            code: "invalid_field",
                            message: "Invalid payment method",
                            human: "Je kan online betalingen niet wijzigen"
                        })
                    }
                }

                if (patch.transferSettings && payment.method == PaymentMethod.Transfer) {
                    if (patch.transferSettings.isPut()) {
                        payment.transferSettings = patch.transferSettings
                    } else if (payment.transferSettings !== null) {
                        payment.transferSettings = payment.transferSettings.patch(patch.transferSettings)
                    }
                }

                if (patch.method) {
                    if (![PaymentMethod.Unknown, PaymentMethod.Transfer, PaymentMethod.PointOfSale].includes(patch.method)) {
                        throw new SimpleError({
                            code: "invalid_field",
                            message: "Invalid payment method",
                            human: "De betaalmethode die je wilt gebruiken is niet toegestaan",
                            field: "method"
                        })
                    }
                    payment.method = patch.method

                    if (payment.method === PaymentMethod.Transfer && patch.transferDescription === undefined && !payment.transferDescription) {
                        payment.transferSettings = payment.transferSettings ?? user.organization.meta.transferSettings
                        // TODO: fill in description!
                        payment.generateDescription(user.organization, "")
                    }
                }

                if (patch.transferDescription && payment.method == PaymentMethod.Transfer) {
                    payment.transferDescription = patch.transferDescription
                }

                if (patch.paidAt && payment.paidAt !== null) {
                    // Only allow to set the date if it is already set
                    payment.paidAt = patch.paidAt
                }

                await payment.save()

                // Copy changes to struct without refetching everything again
                paymentGeneral.set(payment)

                changedPayments.push(paymentGeneral)
            });
        }

        return new Response(
            changedPayments
        );
    }
}
