import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Token } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { Payment as PaymentStruct, PaymentGeneral, PaymentMethod, PermissionLevel } from "@stamhoofd/structures";

import { ExchangePaymentEndpoint } from '../ExchangePaymentEndpoint';
import { GetPaymentEndpoint } from './GetPaymentEndpoint';

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<PaymentStruct>
type ResponseBody = PaymentGeneral[]

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class PatchPaymentsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(PaymentStruct as Decoder<PaymentStruct>, PaymentStruct.patchType() as Decoder<AutoEncoderPatchType<PaymentStruct>>, StringDecoder)

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
        for (const patch of request.body.getPatches()) {
            await QueueHandler.schedule("payments/"+patch.id, async () => {
                
                const {payment, struct} = await GetPaymentEndpoint.getPayment(patch.id, user, PermissionLevel.Write)

                if (patch.status) {
                    await ExchangePaymentEndpoint.handlePaymentStatusUpdate(payment, user.organization, patch.status)
                }

                if (patch.price || patch.method || patch.paidAt !== undefined) {
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
                    payment.paidAt = patch.paidAt
                }

                if (patch.price) {
                    payment.price = patch.price
                }

                await payment.save()

                // Make sure we update the updatedAt timestamp of orders, so the frontend can load these orders again
                /*payment.order?.markUpdated()*/

                changedPayments.push(PaymentGeneral.create({...struct, ...payment}))
            });
        }

        return new Response(
            changedPayments
        );
    }
}
