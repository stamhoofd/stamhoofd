import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import type { BalanceItem as BalanceItemStruct, BalanceItemBreakdown } from '@stamhoofd/structures';
import { BalanceItemBreakdownBuilder, BreakdownRequest } from '@stamhoofd/structures';
import { loadOrdersForBreakdown, loadPaymentsForBreakdown, streamForBreakdown } from '../../../../breakdown/streamForBreakdown.js';
import { Context } from '../../../../helpers/Context.js';
import { GetBalanceItemsEndpoint } from './GetBalanceItemsEndpoint.js';

type Params = Record<string, never>;
type Query = BreakdownRequest;
type Body = undefined;
type ResponseBody = BalanceItemBreakdown;

/**
 * Breaks a selection of balance items down into what was charged, per category and per article.
 *
 * Reads the same balance items the Excel export would and groups them with the same rules the rest of
 * the app uses (see BalanceItemBreakdownBuilder in @stamhoofd/structures).
 */
export class GetBalanceItemBreakdownEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = BreakdownRequest as Decoder<BreakdownRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/balance-items/breakdown', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOrganizationScope();
        const { user } = await Context.authenticate();

        const organization = Context.organization;

        if (!organization) {
            throw Context.auth.error();
        }

        if (!await Context.auth.canManagePayments(organization.id)) {
            throw Context.auth.error();
        }

        const builder = new BalanceItemBreakdownBuilder(request.query.path);

        await streamForBreakdown<BalanceItemStruct>({
            userId: user.id,
            filter: request.query.filter,
            search: request.query.search,
            fetch: async (pageRequest) => {
                return await GetBalanceItemsEndpoint.buildData(pageRequest);
            },
            handle: async (items) => {
                builder.add(items, {
                    orders: await loadOrdersForBreakdown(items.map(item => item.orderId)),
                    balanceItemPayments: await loadPaymentsForBreakdown(items.map(item => item.id)),
                });
            },
        });

        return new Response(builder.build(request.query.filter));
    }
}
