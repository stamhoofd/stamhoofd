import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, Member, Order, User } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { BalanceItemStatus, BalanceItemType, BalanceItemWithPayments, PermissionLevel } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context.js';
import { BalanceItemService } from '../../../../services/BalanceItemService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<BalanceItemWithPayments>;
type ResponseBody = BalanceItemWithPayments[];

export class PatchBalanceItemsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(BalanceItemWithPayments as Decoder<BalanceItemWithPayments>, BalanceItemWithPayments.patchType() as Decoder<AutoEncoderPatchType<BalanceItemWithPayments>>, StringDecoder);

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/balance', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error();
        }

        if (request.body.changes.length === 0) {
            return new Response([]);
        }

        const returnedModels: BalanceItem[] = [];

        // Tracking changes
        const additionalItems: { memberId: string; organizationId: string }[] = [];

        await QueueHandler.schedule('balance-item-update/' + organization.id, async () => {
            for (const { put } of request.body.getPuts()) {
                // Create a new balance item
                const model = new BalanceItem();
                model.description = put.description;
                model.amount = put.amount;
                model.type = BalanceItemType.Other;
                model.unitPrice = put.unitPrice;
                model.amount = put.amount;
                model.organizationId = organization.id;
                model.createdAt = put.createdAt;
                model.dueAt = put.dueAt;
                model.status = put.status === BalanceItemStatus.Hidden ? BalanceItemStatus.Hidden : BalanceItemStatus.Due;
                model.VATIncluded = put.VATIncluded;
                model.VATPercentage = put.VATPercentage;
                model.VATExcempt = put.VATExcempt;

                if (put.userId) {
                    model.userId = (await this.validateUserId(model, put.userId)).id;
                }

                if (put.memberId) {
                    model.memberId = (await this.validateMemberId(put.memberId)).id;
                }

                if (put.payingOrganizationId) {
                    // Not allowed if not full admin
                    if (!Context.auth.hasPlatformFullAccess()) {
                        throw Context.auth.error($t(`fafaf0c2-cbf4-4f5b-8669-eb09303efe1e`));
                    }
                    if (put.payingOrganizationId === model.organizationId) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'payingOrganizationId cannot be the same as organizationId',
                            human: $t(`7b181446-ef56-4957-ad13-54644e6d0987`),
                            field: 'payingOrganizationId',
                        });
                    }

                    model.payingOrganizationId = put.payingOrganizationId;
                }

                if (model.dueAt && model.price < 0) {
                    throw new SimpleError({
                        code: 'invalid_price',
                        message: 'Cannot create negative balance in the future',
                        human: $t(`ad8ee48a-8176-4b5f-b6fc-54bc615c2564`),
                    });
                }

                if (model.createdAt > new Date()) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'createdAt cannot be in the future',
                        human: $t(`8bdc9bf1-1d05-4579-9cc4-7fe11c1f031b`),
                        field: 'createdAt',
                    });
                }

                if (!model.userId && !model.memberId && !model.payingOrganizationId) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'No user or member provided',
                        field: 'userId',
                    });
                }

                await model.save();
                returnedModels.push(model);
            }

            for (const patch of request.body.getPatches()) {
                // Create a new balance item
                const model = await BalanceItem.getByID(patch.id);
                if (!model || !(await Context.auth.canAccessBalanceItems([model], PermissionLevel.Write))) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'BalanceItem not found',
                    });
                }

                if (patch.payingOrganizationId !== undefined) {
                    // Not allowed if not full admin
                    if (!Context.auth.hasPlatformFullAccess()) {
                        throw Context.auth.error($t(`fafaf0c2-cbf4-4f5b-8669-eb09303efe1e`));
                    }
                    if (patch.payingOrganizationId === model.organizationId) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'payingOrganizationId cannot be the same as organizationId',
                            human: $t(`7b181446-ef56-4957-ad13-54644e6d0987`),
                            field: 'payingOrganizationId',
                        });
                    }

                    model.payingOrganizationId = patch.payingOrganizationId;
                }

                if (patch.userId) {
                    model.userId = (await this.validateUserId(model, patch.userId)).id;
                }

                if (patch.memberId !== undefined) {
                    if (model.memberId) {
                        // Also update old member id outstanding balances
                        additionalItems.push({ memberId: model.memberId, organizationId: model.organizationId });
                    }
                    if (patch.memberId === null) {
                        if (model.userId === null) {
                            throw new SimpleError({
                                code: 'invalid_field',
                                message: 'No user or member provided',
                                human: $t(`ace2c298-5b2a-42cd-900d-624e1e375aeb`),
                                field: 'memberId',
                            });
                        }
                        model.memberId = null;
                    }
                    else {
                        model.memberId = (await this.validateMemberId(patch.memberId)).id;
                    }
                }

                if (patch.createdAt) {
                    model.createdAt = patch.createdAt;

                    if (model.createdAt > new Date()) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'createdAt cannot be in the future',
                            human: $t(`8bdc9bf1-1d05-4579-9cc4-7fe11c1f031b`),
                            field: 'createdAt',
                        });
                    }
                }

                model.description = patch.description ?? model.description;
                model.unitPrice = patch.unitPrice ?? model.unitPrice;
                model.amount = patch.amount ?? model.amount;
                model.dueAt = patch.dueAt === undefined ? model.dueAt : patch.dueAt;
                model.VATIncluded = patch.VATIncluded === undefined ? model.VATIncluded : patch.VATIncluded;
                model.VATPercentage = patch.VATPercentage === undefined ? model.VATPercentage : patch.VATPercentage;
                model.VATExcempt = patch.VATExcempt === undefined ? model.VATExcempt : patch.VATExcempt;

                if ((patch.dueAt !== undefined || patch.unitPrice !== undefined) && model.dueAt && model.price < 0) {
                    throw new SimpleError({
                        code: 'invalid_price',
                        message: 'Cannot create negative balance in the future',
                        human: $t(`ad8ee48a-8176-4b5f-b6fc-54bc615c2564`),
                        field: 'dueAt',
                    });
                }

                if (model.orderId) {
                    // Not allowed to change this
                    const order = await Order.getByID(model.orderId);
                    if (order) {
                        model.unitPrice = order.totalToPay;
                        model.amount = 1;
                    }
                }

                if (patch.status && patch.status === BalanceItemStatus.Hidden) {
                    if (model.pricePaid === 0) {
                        model.status = BalanceItemStatus.Hidden;
                    }
                }
                else if (patch.status) {
                    model.status = patch.status;
                }

                if (!model.userId && !model.memberId && !model.payingOrganizationId) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'No user or member provided',
                        field: 'userId',
                    });
                }

                await model.save();
                returnedModels.push(model);
            }
        });

        // Update balances before we return the up to date versions
        await BalanceItemService.flushCaches(organization.id);

        // Reload returnedModels
        const returnedModelsReloaded = await BalanceItem.getByIDs(...returnedModels.map(m => m.id));

        return new Response(
            await BalanceItem.getStructureWithPayments(returnedModelsReloaded),
        );
    }

    async validateMemberId(memberId: string) {
        const member = (await Member.getWithRegistrations(memberId));

        if (!member || !(await Context.auth.canLinkBalanceItemToMember(member))) {
            throw new SimpleError({
                code: 'permission_denied',
                message: 'No permission to link balance items to this member',
                human: $t(`59197811-88ca-423c-b3b1-940d3c42704d`),
                field: 'memberId',
            });
        }

        return member;
    }

    async validateUserId(balanceItem: BalanceItem, userId: string) {
        const user = await User.getByID(userId);
        if (!user || !await Context.auth.canLinkBalanceItemToUser(balanceItem, user)) {
            throw new SimpleError({
                code: 'permission_denied',
                message: 'No permission to link balance items to this user',
                human: $t(`2ca03c93-d221-4a02-93be-9f187426f563`),
                field: 'userId',
            });
        }

        return user;
    }
}
