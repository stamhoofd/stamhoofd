import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { StripeAccount } from '@stamhoofd/models';
import { AuditLogSource, PermissionLevel, StripeAccount as StripeAccountStruct } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context';
import { StripeHelper } from '../../../../helpers/StripeHelper';
import { AuditLogService } from '../../../../services/AuditLogService';

type Params = { id: string };
type Body = undefined;
type Query = undefined;
type ResponseBody = StripeAccountStruct;

export class UpdateStripeAccountEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
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
        if (!await Context.auth.canManagePaymentAccounts(organization.id, PermissionLevel.Read)) {
            throw Context.auth.error();
        }

        // Search account in database
        const model = await StripeAccount.getByID(request.params.id);
        if (!model || model.organizationId !== organization.id) {
            throw Context.auth.notFoundOrNoAccess($t(`e5f6d64c-b3fe-4c8a-a711-ebdb14098c98`));
        }

        // Get account
        const stripe = StripeHelper.getInstance();
        const account = await stripe.accounts.retrieve(model.accountId);

        await AuditLogService.setContext({ userId: null, source: AuditLogSource.System }, async () => {
            model.setMetaFromStripeAccount(account);
            await model.save();
        });
        return new Response(StripeAccountStruct.create(model));
    }
}
