
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { StripeAccount, Token } from '@stamhoofd/models';
import { StripeAccount as StripeAccountStruct, StripeMetaData } from "@stamhoofd/structures";
import Stripe from 'stripe';

import { StripeHelper } from '../../helpers/StripeHelper';
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

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.hasFullAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je moet hoofdbeheerder zijn om Stripe te kunnen connecteren"
            })
        }

        const models = await StripeAccount.where({ organizationId: user.organizationId, status: "active" })
        if (models.length > 0 && !user.organization.privateMeta.featureFlags.includes('stripe-multiple')) {
            throw new SimpleError({
                code: "already_connected",
                message: "Je hebt al een Stripe account gekoppeld"
            })
        }

        const type = 'express'

        let expressData: Stripe.AccountCreateParams = {
            country: user.organization.address.country,
            // Problem: we cannot set company or business_type, because then it defaults the structure of the company to one that requires a company number
            /*
            business_type: 'non_profit',
            company: {
                name: user.organization.meta.companyName ?? undefined,
                tax_id: user.organization.meta.companyNumber ?? undefined,
                vat_id: user.organization.meta.VATNumber ?? undefined,
                structure: 'unincorporated_non_profit',
                address: {
                    line1: user.organization.address.street + " " + user.organization.address.number,
                    city: user.organization.address.city,
                    postal_code: user.organization.address.postalCode,
                    country: user.organization.address.country
                },
            },*/
            business_profile: {
                mcc: '8398', // charitable_and_social_service_organizations_fundraising <-> 8641 civic_social_fraternal_associations
                name: user.organization.name,
                url: user.organization.website ?? undefined,
            },
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
                bancontact_payments: { requested: true },
                ideal_payments: { requested: true },
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
            ...expressData
        });

        // Save the Stripe account in the database
        const model = new StripeAccount();
        model.organizationId = user.organizationId;
        model.accountId = account.id;
        model.setMetaFromStripeAccount(account)
        await model.save();

        // Return information about the Stripe Account
        
        return new Response(StripeAccountStruct.create(model));
    }
}
