import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { StripeAccount } from '@stamhoofd/models';
import type { PaymentGeneral,
    PaymentBreakdown } from '@stamhoofd/structures';
import {
    BreakdownRequest,
    PaymentBreakdownBuilder,
    StripeAccount as StripeAccountStruct,
} from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { loadOrdersForBreakdown, streamForBreakdown } from '../../../../breakdown/streamForBreakdown.js';
import { Context } from '../../../../helpers/Context.js';
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
    private accounts = new Map<string, StripeAccountStruct>();

    async load(payments: PaymentGeneral[]): Promise<StripeAccountStruct[]> {
        const missing = Formatter.uniqueArray(
            payments.flatMap(p => p.stripeAccountId && !this.accounts.has(p.stripeAccountId) ? [p.stripeAccountId] : []),
        );

        if (missing.length > 0) {
            for (const account of await StripeAccount.getByIDs(...missing)) {
                this.accounts.set(account.id, StripeAccountStruct.create(account));
            }
        }

        return [...this.accounts.values()];
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
            filter: request.query.filter,
            search: request.query.search,
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
