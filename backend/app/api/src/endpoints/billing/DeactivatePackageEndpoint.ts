import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { STPackage, Token } from "@stamhoofd/models";
import { QueueHandler } from '@stamhoofd/queues';
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
        const token = await Token.authenticate(request);
        const user = token.user

        // If the user has permission, we'll also search if he has access to the organization's key
        if (user.permissions === null || !user.permissions.hasFullAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You don't have permissions for this endpoint",
                statusCode: 403
            })
        }

        await QueueHandler.schedule("billing/invoices-"+user.organizationId, async () => {
            const packages = await STPackage.getForOrganization(user.organizationId)

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

            await STPackage.updateOrganizationPackages(user.organizationId)
        });

        return new Response(undefined)
    }
}

