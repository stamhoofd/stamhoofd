import { AutoEncoder, BooleanDecoder,Decoder,field, IntegerDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Group } from "@stamhoofd/models";
import { KeychainItem } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { EncryptedMemberWithRegistrations, KeychainedResponse, KeychainItem as KeychainItemStruct, PermissionLevel } from "@stamhoofd/structures";

type Params = { id: string };
class Query extends AutoEncoder {
    @field({ decoder: BooleanDecoder, optional: true })
    waitingList = false

    @field({ decoder: IntegerDecoder, optional: true })
    cycleOffset = 0
}
type Body = undefined
type ResponseBody = EncryptedMemberWithRegistrations[] | KeychainedResponse<EncryptedMemberWithRegistrations[]>;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetGroupMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/group/@id/members", { id: String});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang tot deze groep"
            })
        }

        const groups = await Group.where({ id: request.params.id, organizationId: user.organizationId}, { limit: 1})
        if (groups.length != 1) {
            throw new SimpleError({
                code: "group_not_found",
                message: "De groep die je opvraagt bestaat niet (meer)"
            })
        }
        const [group] = groups

        if (group.privateSettings.permissions.getPermissionLevel(user.permissions) === PermissionLevel.None) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang tot deze groep"
            })
        }

        const members = await group.getMembersWithRegistration(request.query.waitingList, request.query.cycleOffset)

        if (request.request.getVersion() <= 35) {
            // Old
            return new Response(members.map(m => m.getStructureWithRegistrations(true)));
        }

        // New
        const otherKeys: Set<string> = new Set();
        for (const member of members) {
            for (const details of member.encryptedDetails) {
                if (details.publicKey != user.organization.publicKey && details.forOrganization === true) {
                    // Only keys for organization, because else this might be too big
                    otherKeys.add(details.publicKey)
                }
            }
        }

        if (otherKeys.size > 0) {
            // Load the needed keychains the user has access to
            const keychainItems = await KeychainItem.where({
                userId: user.id,
                publicKey: {
                    sign: "IN",
                    value: [...otherKeys.values()]
                }
            }) 

            return new Response(new KeychainedResponse({ data: members.map(m => m.getStructureWithRegistrations(true)), keychainItems: keychainItems.map(m => KeychainItemStruct.create(m)) }));
        }
        
        return new Response(new KeychainedResponse({ data: members.map(m => m.getStructureWithRegistrations(true)), keychainItems: [] }));
    }
}
