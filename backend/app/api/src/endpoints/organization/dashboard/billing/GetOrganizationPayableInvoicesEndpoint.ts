import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import type { Invoice as InvoiceStruct } from '@stamhoofd/structures';
import { DetailedPayableBalance, PaymentStatus } from '@stamhoofd/structures';

import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, Invoice, Organization, Payment } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../../helpers/Context.js';

type Params = { sellingOrganizationId: string };
type Query = undefined;
type ResponseBody = InvoiceStruct[];
type Body = undefined;

export class GetOrganizationPayableInvoicesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }
        const params = Endpoint.parseParameters(request.url, '/billing/@sellingOrganizationId/invoices', { sellingOrganizationId: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        // If the user has permission, we'll also search if he has access to the organization's key
        if (!await Context.auth.canManageFinances(organization.id)) {
            throw Context.auth.error();
        }

        const id = request.params.sellingOrganizationId;
        if (!id) {
            throw new SimpleError({
                code: 'unavailable',
                message: 'This is temporarily unavailable',
                human: $t('%1Rz'),
            });
        }

        const sellingOrganization = await Organization.getByID(id);
        if (!sellingOrganization || !sellingOrganization.active) {
            throw new SimpleError({
                statusCode: 404,
                code: 'not_found',
                message: 'Selling organization not found',
                human: $t('%1R5'),
                field: 'sellingOrganization',
            });
        }

        const invoices = await Invoice.select()
            .where('payingOrganizationId', organization.id)
            .where('organizationId', sellingOrganization.id)
            .where('number', '!=', null)
            .orderBy('invoicedAt', 'DESC')
            .fetch();

        return new Response(await AuthenticatedStructures.invoices(invoices));
    }
}
