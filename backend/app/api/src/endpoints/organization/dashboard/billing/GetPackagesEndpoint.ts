import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { OrganizationPackagesStatus, STPackage as STPackageStruct } from '@stamhoofd/structures';
import { Context } from '../../../../helpers/Context.js';
import { STPackageService } from '../../../../services/STPackageService.js';
import type { Decoder } from '@simonbackx/simple-encoding';
import { AutoEncoder, BooleanDecoder, field } from '@simonbackx/simple-encoding';

type Params = Record<string, never>;
class Query extends AutoEncoder {
    @field({ decoder: BooleanDecoder })
    includeExpired = false;
}

type ResponseBody = OrganizationPackagesStatus;
type Body = undefined;

export class GetPackagesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/packages', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle({ query }: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        // If the user has permission, we'll also search if he has access to the organization's key
        if (!await Context.auth.canManageFinances(organization.id)) {
            throw Context.auth.error();
        }

        const packages = query.includeExpired ? await STPackageService.getValidPackagesWithExpired(organization.id) : await STPackageService.getActivePackages(organization.id);

        return new Response(OrganizationPackagesStatus.create({
            packages: packages.map(p => STPackageStruct.create(p)),
        }));
    }
}
