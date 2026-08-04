import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { StripeAccount } from '@stamhoofd/models';
import type { PaymentGeneral } from '@stamhoofd/structures';
import { StripeAccount as StripeAccountStruct } from '@stamhoofd/structures';
import { BreakdownRequest } from '@stamhoofd/structures/breakdown/BreakdownRequest.js';
import { PaymentBreakdownBuilder } from '@stamhoofd/structures/breakdown/PaymentBreakdownBuilder.js';
import type { PaymentBreakdown } from '@stamhoofd/structures/PaymentBreakdown.js';
import { Formatter } from '@stamhoofd/utility';
import { loadOrdersForBreakdown } from '../../../../helpers/breakdownRelations.js';
import { Context } from '../../../../helpers/Context.js';
import { streamForBreakdown } from '../../../../helpers/streamForBreakdown.js';
import { GetPaymentsEndpoint } from './GetPaymentsEndpoint.js';

type Params = Record<string, never>;
type Query = BreakdownRequest;
type Body = undefined;
type ResponseBody = PaymentBreakdown;

/**
 * The Stripe accounts the payments arrived on, so they can be named after their holder. There are only
 * a few of them, so they are kept for as long as the breakdown runs.
 */
class StripeAccountCache {
    // An account that no longer exists is remembered as null, so it is not looked up again on every page
    private accounts = new Map<string, StripeAccountStruct | null>();

    async load(payments: PaymentGeneral[]): Promise<StripeAccountStruct[]> {
        const missing = Formatter.uniqueArray(
            payments.flatMap(p => p.stripeAccountId && !this.accounts.has(p.stripeAccountId) ? [p.stripeAccountId] : []),
        );

        if (missing.length > 0) {
            for (const id of missing) {
                this.accounts.set(id, null);
            }

            for (const account of await StripeAccount.getByIDs(...missing)) {
                this.accounts.set(account.id, StripeAccountStruct.create(account));
            }
        }

        return [...this.accounts.values()].filter(account => account !== null);
    }
}

/**
 * Breaks a selection of payments down into where the money arrived, what it was for and which articles
 * were paid.
 *
 * Reads the same payments the Excel export would and groups them with the same rules the rest of the
 * app uses (see PaymentBreakdownBuilder in @stamhoofd/structures), so the numbers always describe
 * exactly the payments that end up in the file.
 */
export class GetPaymentBreakdownEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = BreakdownRequest as Decoder<BreakdownRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/payments/breakdown', {});

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

        const builder = new PaymentBreakdownBuilder(request.query.path);
        const stripeAccounts = new StripeAccountCache();

        await streamForBreakdown<PaymentGeneral>({
            userId: user.id,
            filter: request.query.readFilter,
            search: request.query.search,
            count: async (countRequest) => {
                return await (await GetPaymentsEndpoint.buildQuery(countRequest)).count();
            },
            fetch: async (pageRequest) => {
                return await GetPaymentsEndpoint.buildData(pageRequest);
            },
            handle: async (payments) => {
                builder.add(payments, {
                    stripeAccounts: await stripeAccounts.load(payments),
                    orders: await loadOrdersForBreakdown(
                        payments.flatMap(p => p.balanceItemPayments.map(bp => bp.balanceItem.orderId)),
                    ),
                });
            },
        });

        return new Response(builder.build(request.query.filter));
    }
}
