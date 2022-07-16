import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Invite } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { User } from '@stamhoofd/models';
import { Invite as InviteStruct, NewInvite, OrganizationSimple,User as UserStruct } from "@stamhoofd/structures";
import basex from "base-x";
import crypto from "crypto";
type Params = Record<string, never>;
type Query = undefined;
type Body = NewInvite
type ResponseBody = InviteStruct
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const bs58 = basex(ALPHABET)

async function randomBytes(size: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(size, (err: Error | null, buf: Buffer) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(buf);
        });
    });
}

/**
 * Return a list of users and invites for the given organization with admin permissions
 */
export class CreateInviteEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = NewInvite as Decoder<NewInvite>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/invite", {});

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
                message: "Het is nog niet mogelijk om uitnodigingen te maken als gewone gebruiker"
            })
        }

        let receiver: User | null = null

        // Create the invite
        const invite = new Invite()
        invite.senderId = user.id
        invite.userDetails = request.body.userDetails
        invite.organizationId = user.organizationId
        invite.key = bs58.encode(await randomBytes(32)).toLowerCase();

        // RESTRICTED FOR ADMINS
        if (user.permissions.hasFullAccess()) {
            if (request.body.receiverId) {
                const receivers = await User.where({ organizationId: user.organizationId, id: request.body.receiverId }, { limit: 1 })
                if (receivers.length != 1) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Invalid user",
                        field: "receiverId"
                    }) 
                }
                receiver = receivers[0]
                invite.receiverId = receiver.id

                // Longer valid than the default, because the keychain items are encrypted with the public key of the receiver, which is stored safely
                // 2 months valid (is needed for this use case as this happens in the background)
                const date = new Date(new Date().getTime() + 1000*60*60*24*31*2)
                date.setMilliseconds(0)
                invite.validUntil = date
            }
            invite.permissions = request.body.permissions
            invite.memberIds = request.body.memberIds
        } else {
            if (request.body.receiverId || request.body.permissions) {
                throw new SimpleError({
                    code: "permission_denied",
                    message: "You don't have permissions to set permissions and/or receiver"
                })
            }
        }

        if (!request.body.receiverId && request.body.userDetails?.email) {
            // 7 days valid, because validation is required
            const date = new Date(new Date().getTime() + 1000*60*60*24*7)
            date.setMilliseconds(0)
            invite.validUntil = date
        }
        
        await invite.save()

        return new Response(InviteStruct.create(Object.assign({}, invite, {
            receiver: receiver ? UserStruct.create({...receiver, hasAccount: receiver.hasAccount()}) : null,
            sender: UserStruct.create({...user, hasAccount: user.hasAccount()}),
            organization: OrganizationSimple.create(user.organization)
        })));
    }
}
