import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { KeychainItem, Token, User } from '@stamhoofd/models';
import { KeychainedResponse, KeychainItem as KeychainItemStruct, OrganizationKeyUser } from "@stamhoofd/structures";
type Params = { id: string };
type Query = undefined;
type Body = undefined
type ResponseBody = KeychainedResponse<OrganizationKeyUser[]>

/**
 * Return a list of the organizatino keys the user has or is missing
 */
export class GetOrganizationAdminKeysEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/admins/@id/keys", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions || !user.permissions.hasFullAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang tot dit onderdeel"
            })
        }

        // Get all admins
        const admins = await User.where({id: request.params.id, organizationId: user.organizationId }, { limit: 1 })
        if (admins.length == 0 || admins[0].permissions === null) {
             throw new SimpleError({
                code: "not_found",
                message: "This admin doesn't exist"
            })
        }
        const admin = admins[0]

        // Get all organization keys
        const keys = await user.organization.getKeyHistory()

        // Now check all the keys of this admin + the current user
        // Load the needed keychains the user has access to
        const keychainItems = await KeychainItem.where({
            userId: admin.id,
            publicKey: {
                sign: "IN",
                value: keys.map(m => m.publicKey)
            }
        })

        const foundKeys = keys.map(k => OrganizationKeyUser.create({
            ...k,
            hasAccess: !!keychainItems.find(k2 => k2.publicKey == k.publicKey)
        }));
            
            
        const currentKeychainItems = await KeychainItem.where({
            userId: user.id,
            publicKey: {
                sign: "IN",
                value: keys.map(m => m.publicKey)
            }
        })

        return new Response(new KeychainedResponse({
            data: foundKeys,
            keychainItems: currentKeychainItems.map(m => KeychainItemStruct.create(m))
        }));
    }
}
