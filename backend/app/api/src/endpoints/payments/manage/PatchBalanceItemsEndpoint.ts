import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { BalanceItem, Group, Member, Token, User, UserWithOrganization } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { MemberBalanceItem } from "@stamhoofd/structures";

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<MemberBalanceItem>
type ResponseBody = MemberBalanceItem[]

export class PatchBalanceItemsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(MemberBalanceItem as Decoder<MemberBalanceItem>, MemberBalanceItem.patchType() as Decoder<AutoEncoderPatchType<MemberBalanceItem>>, StringDecoder)

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/balance", {});

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
                message: "Je hebt geen toegang tot deze functie"
            })
        }

        if (request.body.changes.length == 0) {
            return new Response([]);
        }

        const returnedModels: BalanceItem[] = []

        await QueueHandler.schedule("balance-item-update/"+user.organization.id, async () => {
            for (const {put} of request.body.getPuts()) {
                // Create a new balance item
                const model = new BalanceItem();
                model.description = put.description;
                model.price = put.price;
                model.organizationId = user.organizationId;
                if (put.userId) {
                    model.userId = (await this.validateUserId(put.userId, user)).id;
                }

                if (put.memberId) {
                    model.memberId = (await this.validateMemberId(put.memberId, user)).id;
                }

                // todo: support registration and order

                await model.save();
                returnedModels.push(model);
            }

            for (const patch of request.body.getPatches()) {
                // Create a new balance item
                const model = await BalanceItem.getByID(patch.id)
                if (!model || model.organizationId !== user.organizationId) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'BalanceItem not found'
                    })
                }
                // Check permissions
                if (model.memberId) {
                    await this.validateMemberId(model.memberId, user);
                }
                if (model.userId) {
                    await this.validateUserId(model.userId, user);
                }

                model.description = patch.description ?? model.description;
                model.price = patch.price ?? model.price;
                
                await model.save();
                returnedModels.push(model);
            }
        });

         return new Response(
            await BalanceItem.getMemberStructure(returnedModels)
        );
    }

    async validateMemberId(memberId: string, adminUser: UserWithOrganization) {
        if (!adminUser.permissions) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Member not found',
                field: 'memberId'
            })
        }
        const member = (await Member.getWithRegistrations(memberId))
        const groups = await Group.where({ organizationId: adminUser.organizationId })

        if (!member || member.organizationId != adminUser.organizationId) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Member not found',
                field: 'memberId'
            })
        }

        if (await member.hasWriteAccess(adminUser, groups)) {
            // Can write all
            return member;
        }


        if (adminUser.permissions.canManagePayments(adminUser.organization.privateMeta.roles)) {
            // Can manage all payments in the organization
            return member;
        }

        throw new SimpleError({
            code: "permission_denied",
            message: "No permission to create balance items for this member",
            human: "Je hebt geen bewerk rechten voor dit lid en kan daardoor geen aanrekeningen toevoegen bij dit lid.",
            field: 'memberId'
        })
    }

    async validateUserId(userId: string, adminUser: UserWithOrganization) {
        if (!adminUser.permissions) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'User not found',
                field: 'userId'
            })
        }
        const user = await User.getByID(userId);
        if (!user || user.organizationId !== adminUser.organizationId) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'User not found',
                field: 'userId'
            })
        }

        if (adminUser.permissions.hasFullAccess()) {
            // Can manage all
            return user;
        }

        if (adminUser.permissions.hasWriteAccess()) {
            // Can write all
            return user;
        }

        if (adminUser.permissions.canManagePayments(adminUser.organization.privateMeta.roles)) {
            // Can manage all payments in the organization
            return user;
        }

        throw new SimpleError({
            code: 'permission_denied',
            message: 'No permission to link balanace items to users',
            human: 'Je hebt geen toegang om aanrekeningen te maken die verbonden zijn met accounts.',
            field: 'userId'
        })
    }
}
