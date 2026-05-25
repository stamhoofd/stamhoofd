import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { BalanceItem, Organization, RegisterCode, UsedRegisterCode } from '@stamhoofd/models';
import { RegisterCodeStatus, UsedRegisterCode as UsedRegisterCodeStruct } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = RegisterCodeStatus;

export class GetRegisterCodeEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/billing/register-code', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error()
        }

        const codes = await RegisterCode.where({ organizationId: organization.id })
        let code = codes[0]

        if (codes.length === 0) {
            code = new RegisterCode()
            code.organizationId = organization.id
            code.description = 'Doorverwezen door '+ organization.name
            code.value = 25_00_00
            await code.generateCode()
            await code.save()
        }

        const usedCodes = await UsedRegisterCode.getAll(code.code)
        const allOrganizations = await Organization.getByIDs(...usedCodes.flatMap(u => u.organizationId ? [u.organizationId] : []))
        const allBalances = await BalanceItem.getByIDs(...usedCodes.flatMap(u => u.balanceItemId ? [u.balanceItemId] : []))

        return new Response(RegisterCodeStatus.create({
            code: code.code,
            value: code.value,
            invoiceValue: code.invoiceValue,
            usedCodes: usedCodes.map(c => {
                const creditValue = (c.balanceItemId ? (allBalances.find(credit => credit.id === c.balanceItemId)?.priceWithoutVAT) : null) ?? null;
                return UsedRegisterCodeStruct.create({ 
                    id: c.id,
                    organizationName: allOrganizations.find(o => o.id === c.organizationId)?.name ?? 'Onbekend',
                    createdAt: c.createdAt,
                    creditValue: creditValue !== null ? -creditValue : null
                })
            })
        }))
    }
}
