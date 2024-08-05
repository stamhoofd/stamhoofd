
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { StripeAccount } from '@stamhoofd/models';
import { PermissionLevel, StripeAccount as StripeAccountStruct } from "@stamhoofd/structures";
import Stripe from 'stripe';

import { Context } from '../../../../helpers/Context';
import { StripeHelper } from '../../../../helpers/StripeHelper';
type Params = Record<string, never>;
type Body = undefined;
type Query = undefined
type ResponseBody = StripeAccountStruct

export class ConnectMollieEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {    
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/stripe/connect", {});

        if (params) {
            return [true, params as Params];
        }

        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!await Context.auth.canManagePaymentAccounts(organization.id, PermissionLevel.Full)) {
            throw Context.auth.error()
        }

        const models = await StripeAccount.where({ organizationId: organization.id, status: "active" })

        const canCreateMultipleStripeAccounts = models.every(a => (a.meta.charges_enabled && a.meta.payouts_enabled) || (a.meta.details_submitted))
        if (models.length > 0 && !canCreateMultipleStripeAccounts) {
            throw new SimpleError({
                code: "already_connected",
                message: "Je hebt al een Stripe account gekoppeld"
            })
        }

        const type = STAMHOOFD.STRIPE_CONNECT_METHOD

        const sharedData: Stripe.AccountCreateParams = {
             capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
                bancontact_payments: { requested: true },
                ideal_payments: { requested: true },
            },
        }

        let expressData: Stripe.AccountCreateParams = {
            country: organization.address.country,
            controller: {
                requirement_collection: 'application',
            },
            settings: {
                payouts: {
                    schedule: {
                        delay_days: 'minimum',
                        interval: 'weekly',
                        weekly_anchor: 'monday',
                    }
                }
            }
        };

        if (type !== 'express') {
            expressData = {};
        }

        // Create a new Stripe account
        const stripe = StripeHelper.getInstance()
        const account = await stripe.accounts.create({
            type,
            ...sharedData,
            ...expressData
        });

        // Save the Stripe account in the database
        const model = new StripeAccount();
        model.organizationId = organization.id;
        model.accountId = account.id;
        model.setMetaFromStripeAccount(account)
        await model.save();

        // Return information about the Stripe Account
        
        return new Response(StripeAccountStruct.create(model));
    }
}
