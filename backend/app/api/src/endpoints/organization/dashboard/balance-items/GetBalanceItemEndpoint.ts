import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem } from '@stamhoofd/models';
import { BalanceItemWithPayments } from '@stamhoofd/structures';

import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../../helpers/Context.js';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = BalanceItemWithPayments;

export class GetBalanceItemEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/balance-items/@id', { id: String });

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

        const balanceItem = await BalanceItem.getByID(request.params.id);

        if (!balanceItem || balanceItem.organizationId !== organization.id) {
            throw new SimpleError({
                code: 'not_found',
                statusCode: 404,
                message: 'Balance item not found',
                human: $t('Deze aanrekening bestaat niet (meer)'),
            });
        }

        if (!await Context.auth.canAccessBalanceItems([balanceItem])) {
            throw Context.auth.error();
        }

        return new Response(
            (await AuthenticatedStructures.balanceItemsWithPayments([balanceItem]))[0],
        );
    }
}
