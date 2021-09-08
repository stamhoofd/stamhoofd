import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { KeychainItem, Organization } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { KeychainedResponse, KeychainItem as KeychainItemStruct, Organization as OrganizationStruct  } from "@stamhoofd/structures";
type Params = Record<string, never>;
type Query = undefined;
type Body = undefined
type ResponseBody = KeychainedResponse<OrganizationStruct>;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetOrganizationEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.optionalAuthenticate(request);
        const user = token?.user
        const organization = user?.organization ?? await Organization.fromApiHost(request.host);

        let keychainItems: KeychainItem[] = []

        // If the user has permission, we'll also search if he has access to the organization's key
        if (user && user.permissions !== null) {
            keychainItems = await KeychainItem.where({
                userId: user.id,
                publicKey: user.organization.publicKey
            })
        }
        return new Response(new KeychainedResponse({
            data: user ? await user.getOrganizatonStructure(user.organization) : await organization.getStructure(),
            keychainItems: keychainItems.map(m => KeychainItemStruct.create(m))
        }));
    }
}
