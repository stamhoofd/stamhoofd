import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request} from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import {  CountFilteredRequest, CountResponse, PaymentCustomer, PaymentMethod, PermissionLevel, ReceivableBalanceType } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context.js';
import { GetReceivableBalancesEndpoint } from './GetReceivableBalancesEndpoint.js';
import type { BalanceItem} from '@stamhoofd/models';
import { Organization, User} from '@stamhoofd/models';
import { CachedBalance } from '@stamhoofd/models';
import { PaymentService } from '../../../../services/PaymentService.js';
import { SimpleError } from '@simonbackx/simple-errors';
import { PaymentMandateService } from '../../../../services/PaymentMandateService.js';
import { BalanceItemService } from '../../../../services/BalanceItemService.js';

type Params = Record<string, never>;
type Query = CountFilteredRequest;
type Body = undefined;
type ResponseBody = undefined;

export class ChargeReceivableBalancesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = CountFilteredRequest as Decoder<CountFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/receivable-balances/charge', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const sellingOrganization = await Context.setOrganizationScope();
        await Context.authenticate();
        const query = await GetReceivableBalancesEndpoint.buildQuery(request.query);

        for await (const cachedBalance of query.all()) {
            if (cachedBalance.organizationId !== sellingOrganization.id) {
                throw new SimpleError({
                    code: 'wrong_organization',
                    message: 'Cannot charge a cached balance from a different organization'
                })
            }
            // todo
            const items = await CachedBalance.balanceForObjects(cachedBalance.organizationId, [cachedBalance.objectId], cachedBalance.objectType);

            if (items.length === 0) {
                console.log('Nothing to charge for', cachedBalance.id)
                continue;
            }

            const map: Map<BalanceItem, number> = new Map();
            for (const i of items) {
                map.set(i, i.priceOpen)
            }
            let payingOrganization: Organization | null = null;
            let user: User | null = null;
            if (cachedBalance.objectType === ReceivableBalanceType.organization) {
                const p = await Organization.getByID(cachedBalance.objectId);
                if (!p || !(await Context.auth.hasFullAccess(p))) {
                    console.error('Unexpected missing paying organization id', cachedBalance)
                    continue
                }
                payingOrganization = p;
            }

            if (cachedBalance.objectType === ReceivableBalanceType.user || cachedBalance.objectType === ReceivableBalanceType.userWithoutMembers) {
                const p = await User.getByID(cachedBalance.objectId);
                if (!p || !(Context.auth.checkScope(p.organizationId))) {
                    console.error('Unexpected missing user id', cachedBalance)
                    continue
                }
                user = p
            }

            const mandates = await PaymentMandateService.getMandates({
                sellingOrganization,
                user,
                payingOrganization
            });

            const mandate = mandates.find(m => m.isDefault)

            if (!mandate) {
                // Not possible
                console.error('No mandates found for', cachedBalance.id)
                continue;
            }

            const customerUser = user ?? (payingOrganization ? (await payingOrganization.getFullAdmins())[0] : null)
            const customer = PaymentCustomer.create({
                firstName: customerUser?.firstName,
                lastName: customerUser?.lastName,
                email: customerUser?.email ?? (payingOrganization ? (await payingOrganization.getReplyEmails())[0].email : null),
                company: payingOrganization?.defaultCompanies[0]
            })
            
            await PaymentService.createPayment({
                balanceItems: map,
                checkout: {
                    paymentMethod: PaymentMethod.Unknown,
                    totalPrice: null,
                    customer,
                    cancelUrl: null,
                    redirectUrl: null
                },
                user,
                organization: sellingOrganization,
                payingOrganization,
                serviceFeeType: 'system',
                createMandate: null,
                useMandate: mandate,
                paymentConfiguration: sellingOrganization.meta.registrationPaymentConfiguration,
                privatePaymentConfiguration: sellingOrganization.privateMeta.registrationPaymentConfiguration
            })
        }

        // Make sure the user can refresh data and see the updated cached amounts
        await BalanceItemService.flushCaches(sellingOrganization.id)
        return new Response(undefined, 201);
    }
}
