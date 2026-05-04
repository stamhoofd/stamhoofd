import type { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { STPackage } from '@stamhoofd/models';
import { OrganizationPackagesStatus, STPackage as STPackageStruct } from '@stamhoofd/structures';
import { Context } from '../../../helpers/Context.js';
import { STPackageService } from '../../../services/STPackageService.js';

type Params = Record<string, never>;
type Query = undefined;
type ResponseBody = OrganizationPackagesStatus;
type Body = AutoEncoderPatchType<OrganizationPackagesStatus>;

export class PatchPackagesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = OrganizationPackagesStatus.patchType() as Decoder<AutoEncoderPatchType<OrganizationPackagesStatus>>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/packages', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        // If the user has permission, we'll also search if he has access to the organization's key
        if (!Context.auth.hasPlatformFullAccess()) {
            throw Context.auth.error();
        }
        let updatePackages = false
        const packages = await STPackageService.getValidPackagesWithExpired(organization.id);

        // Do patches
        if (request.body.packages) {
            for (const patch of request.body.packages.getPatches()) {
                const pack = packages.find(p => p.id === patch.id)
                if (!pack) {
                    throw new SimpleError({
                        code: 'not_found',
                        message: 'Package not found with id '+patch.id
                    })
                }

                if (patch.meta !== undefined) {
                    pack.meta.patchOrPut(patch.meta)
                }

                if (patch.validUntil !== undefined) {
                    pack.validUntil = patch.validUntil
                }

                if (patch.removeAt !== undefined) {
                    pack.removeAt = patch.removeAt
                }

                await pack.save()
                updatePackages = true
            }

            for (const put of request.body.packages.getPuts()) {
                const pack = new STPackage()
                pack.id = put.put.id;
                pack.validAt = new Date()
                pack.organizationId = organization.id

                pack.meta = put.put.meta
                pack.validUntil = put.put.validUntil
                pack.removeAt = put.put.removeAt

                await pack.save()
                updatePackages = true

                packages.push(pack);
            }
        }

        if (updatePackages) {
            await STPackageService.updateOrganizationPackages(organization.id)
        }

        return new Response(OrganizationPackagesStatus.create({
            packages: packages.map(p => STPackageStruct.create(p)),
        }));
    }
}
