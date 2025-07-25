import { createMollieClient } from '@mollie/api-client';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { STInvoice } from "@stamhoofd/models";
import { STBillingStatus } from "@stamhoofd/structures";

import { Context } from "../../../../helpers/Context";

type Params = {id: string}
type Query = undefined;
type ResponseBody = STBillingStatus;
type Body = undefined;

export class GetBillingStatusEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "DELETE") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/billing/mandate/@id", {
            id: String
        });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        // If the user has permission, we'll also search if he has access to the organization's key
        if (!Context.auth.canManageFinances()) {
            throw Context.auth.error()
        }

        if (request.params.id === organization.serverMeta.mollieMandateId) {
            // Check if all packes are disabled
            if (organization.meta.packages.useMembers || organization.meta.packages.useWebshops) {
                throw new SimpleError({
                    code: "cannot_delete_mandate",
                    message: "Cannot delete the current mandate",
                    human: "Je kan de huidige betaalmethode niet verwijderen. Wissel eerst naar een nieuwe betaalmethode voor je deze verwijdert, of deactiveer eerst alle pakketten."
                })
            }

            organization.serverMeta.mollieMandateId = null;
            await organization.save();
        }

        if (!organization.serverMeta.mollieCustomerId) {
            throw new SimpleError({
                code: "no_mollie_customer",
                message: "No Mollie customer found",
                human: "Er is geen opgeslagen betaalmethode gevonden."
            })
        }

        // Mollie payment is required
        const apiKey = STAMHOOFD.MOLLIE_API_KEY
        if (!apiKey) {
            throw new SimpleError({
                code: "",
                message: "Betalingen zijn tijdelijk onbeschikbaar"
            })
        }
        const mollieClient = createMollieClient({ apiKey });

        // Validate mandate
        try {
            const mandate = await mollieClient.customerMandates.get(
                request.params.id,
                {customerId: organization.serverMeta.mollieCustomerId}
            )
            
            console.log("Deleting mandate", request.params.id, "for organization", organization.id);

            // Delete the mandate
            await mollieClient.customerMandates.revoke(
                request.params.id,
                {customerId: organization.serverMeta.mollieCustomerId}
            );

            // Search other mandates with the same account name
            const allMandates = await mollieClient.customerMandates.page({
                customerId: organization.serverMeta.mollieCustomerId,
                limit: 100,
            });

            for (const m of allMandates) {
                if (m.method === mandate.method && (('consumerAccount' in m.details && 'consumerAccount' in mandate.details) && m.details.consumerAccount === mandate.details.consumerAccount) || ('cardNumber' in m.details && 'cardNumber' in mandate.details && m.details.cardNumber === mandate.details.cardNumber && m.details.cardExpiryDate === mandate.details.cardExpiryDate)) {
                     if (m.id === organization.serverMeta.mollieMandateId) {
                        // Check if all packes are disabled
                        if (organization.meta.packages.useMembers || organization.meta.packages.useWebshops) {
                            throw new SimpleError({
                                code: "cannot_delete_mandate",
                                message: "Cannot delete the current mandate",
                                human: "Je kan de huidige betaalmethode niet verwijderen. Wissel eerst naar een nieuwe betaalmethode voor je deze verwijdert, of deactiveer eerst alle pakketten."
                            })
                        }

                        organization.serverMeta.mollieMandateId = null;
                        await organization.save();
                    }

                    console.log("Deleting mandate", m.id, "for organization", organization.id);

                    // Delete the mandate
                    await mollieClient.customerMandates.revoke(
                        m.id,
                        {customerId: organization.serverMeta.mollieCustomerId}
                    );
                }
            }

        } catch (e) {
            console.error("Error getting mandate", e)
            throw new SimpleError({
                code: "invalid_mandate",
                message: "Invalid mandate",
                human: "De gekozen betaalmethode die je wilt verwijderen, bestaat niet (meer).",
                field: "mandateId"
            })
        }

        return new Response(await STInvoice.getBillingStatus(organization));
    }
}
