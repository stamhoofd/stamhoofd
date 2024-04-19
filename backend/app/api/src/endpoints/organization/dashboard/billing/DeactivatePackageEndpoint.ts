import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { STPackage, Token } from "@stamhoofd/models";
import { QueueHandler } from '@stamhoofd/queues';

import { Context } from "../../../../helpers/Context";
type Params = {id: string};
type Query = undefined;
type ResponseBody = undefined;
type Body = undefined

export class DeactivatePackageEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/billing/deactivate-package/@id", {id: String});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        // If the user has permission, we'll also search if he has access to the organization's key
        if (!Context.auth.canDeactivatePackages()) {
            throw Context.auth.error()
        }        

        await QueueHandler.schedule("billing/invoices-"+organization.id, async () => {
            const packages = await STPackage.getForOrganization(organization.id)

            const pack = packages.find(p => p.id === request.params.id)
            if (!pack) {
                throw new SimpleError({
                    code: "not_found",
                    message: "Package not found",
                    human: "De functie die je wilt deactiveren is al gedeactiveerd of bestaat niet",
                    statusCode: 404
                })
            }

            if (!pack.meta.canDeactivate) {
                throw new SimpleError({
                    code: "not_allowed",
                    message: "Can't deactivate this package",
                    human: "Je kan deze functie niet zelf deactiveren. Neem contact met ons op.",
                })
            }

            // Deactivate
            pack.removeAt = new Date()
            pack.removeAt.setTime(pack.removeAt.getTime() - 1000)
            await pack.save()

            await STPackage.updateOrganizationPackages(organization.id)
        });

        return new Response(undefined)
    }
}

