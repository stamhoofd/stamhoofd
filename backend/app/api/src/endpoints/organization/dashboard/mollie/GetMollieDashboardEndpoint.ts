
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { isSimpleError, isSimpleErrors,SimpleError } from '@simonbackx/simple-errors';
import { MollieToken } from '@stamhoofd/models';
import { PermissionLevel } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context';

type Params = Record<string, never>;
type Body = undefined
type Query = undefined
type ResponseBody = string

export class GetMollieDashboardEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {    
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/mollie/dashboard", {});

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
        
        const mollie = await MollieToken.getTokenFor(organization.id)
        if (!mollie) {
            throw new SimpleError({
                code: "not_yet_linked",
                message: "Mollie is nog niet gekoppeld. Koppel Mollie eerst voor je de gegevens aanvult"
            })
        }

        try {
            const url = await mollie.getOnboardingLink() as string

            const response = new Response(url)
            response.headers['Content-Type'] = "text/plain"
            return response
        } catch (e) {
            if (isSimpleErrors(e) || isSimpleError(e)) {
                throw e;
            }
            await mollie.delete()
            throw new SimpleError({
                code: "not_yet_linked",
                message: "Mollie is nog niet gekoppeld. Koppel Mollie eerst voor je de gegevens aanvult"
            })
        }
    }
}
