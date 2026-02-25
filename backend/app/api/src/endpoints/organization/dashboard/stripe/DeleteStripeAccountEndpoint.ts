import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { StripeAccount } from '@stamhoofd/models';
import { AuditLogType, PermissionLevel } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context.js';
import { StripeHelper } from '../../../../helpers/StripeHelper.js';
import { SimpleError } from '@simonbackx/simple-errors';
import { AuditLogService } from '../../../../services/AuditLogService.js';

type Params = { id: string };
type Body = undefined;
type Query = undefined;
type ResponseBody = undefined;

export class DeleteStripeAccountEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'DELETE') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/stripe/accounts/@id', { id: String });

        if (params) {
            return [true, params as Params];
        }

        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        // Fast throw first (more in depth checking for patches later)
        if (!await Context.auth.canManagePaymentAccounts(organization.id, PermissionLevel.Full)) {
            throw Context.auth.error();
        }

        // Search account in database
        const model = await StripeAccount.getByID(request.params.id);
        if (!model || model.organizationId !== organization.id || model.status !== 'active') {
            throw Context.auth.notFoundOrNoAccess($t(`e5f6d64c-b3fe-4c8a-a711-ebdb14098c98`));
        }

        if (STAMHOOFD.STRIPE_ACCOUNT_ID && model.accountId === STAMHOOFD.STRIPE_ACCOUNT_ID) {
            throw new SimpleError({
                code: 'invalid_request',
                message: 'Je kan het hoofdaccount van het platform niet verwijderen.',
                statusCode: 400,
            });
        }

        // For now we don't delete them in Stripe because this causes issues with data access
        const stripe = StripeHelper.getInstance();

        try {
            await stripe.accounts.del(model.accountId);
        }
        catch (e) {
            console.error('Tried deleting account but failed', e);
        }

        // If that succeeded
        model.status = 'deleted';
        await model.save();

        return new Response(undefined);
    }
}
