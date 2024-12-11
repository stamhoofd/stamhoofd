import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, Member, Order, User } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { BalanceItemStatus, BalanceItemType, BalanceItemWithPayments, PermissionLevel } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context';

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

        if (request.body.changes.length == 0) {
            return new Response([]);
        }

        const returnedModels: BalanceItem[] = [];
        const updateOutstandingBalance: BalanceItem[] = [];

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
                model.status = put.status === BalanceItemStatus.Hidden ? BalanceItemStatus.Hidden : BalanceItemStatus.Pending;

                if (put.userId) {
                    model.userId = (await this.validateUserId(model, put.userId)).id;
                }

                if (put.memberId) {
                    model.memberId = (await this.validateMemberId(put.memberId)).id;
                }

                if (put.payingOrganizationId) {
                    // Not allowed if not full admin
                    if (!Context.auth.hasPlatformFullAccess()) {
                        throw Context.auth.error('Je moet volledige platform beheerder zijn om schulden tussen verenigingen te wijzigen of toe te voegen');
                    }
                    if (put.payingOrganizationId === model.organizationId) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'payingOrganizationId cannot be the same as organizationId',
                            human: 'Dit is een ongeldige situatie. Een schuld moet tussen verschillende verenigingen zijn.',
                            field: 'payingOrganizationId',
                        });
                    }

                    model.payingOrganizationId = put.payingOrganizationId;
                }

                if (model.dueAt && model.price < 0) {
                    throw new SimpleError({
                        code: 'invalid_price',
                        message: 'Cannot create negative balance in the future',
                        human: 'Het is niet mogelijk om een negatief openstaand bedrag toe te voegen in de toekomst',
                    });
                }

                if (model.createdAt > new Date()) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'createdAt cannot be in the future',
                        human: 'De datum kan niet in de toekomst liggen',
                        field: 'createdAt',
                    });
                }

                if (!model.userId && !model.memberId) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'No user or member provided',
                        field: 'userId',
                    });
                }

                await model.save();
                returnedModels.push(model);

                updateOutstandingBalance.push(model);
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
                        throw Context.auth.error('Je moet volledige platform beheerder zijn om schulden tussen verenigingen te wijzigen of toe te voegen');
                    }
                    if (patch.payingOrganizationId === model.organizationId) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'payingOrganizationId cannot be the same as organizationId',
                            human: 'Dit is een ongeldige situatie. Een schuld moet tussen verschillende verenigingen zijn.',
                            field: 'payingOrganizationId',
                        });
                    }

                    model.payingOrganizationId = patch.payingOrganizationId;
                }

                if (patch.memberId) {
                    model.memberId = (await this.validateMemberId(patch.memberId)).id;
                }

                if (patch.createdAt) {
                    model.createdAt = patch.createdAt;

                    if (model.createdAt > new Date()) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'createdAt cannot be in the future',
                            human: 'De datum kan niet in de toekomst liggen',
                            field: 'createdAt',
                        });
                    }
                }

                model.description = patch.description ?? model.description;
                model.unitPrice = patch.unitPrice ?? model.unitPrice;
                model.amount = patch.amount ?? model.amount;
                model.dueAt = patch.dueAt === undefined ? model.dueAt : patch.dueAt;

                if ((patch.dueAt !== undefined || patch.unitPrice !== undefined) && model.dueAt && model.price < 0) {
                    throw new SimpleError({
                        code: 'invalid_price',
                        message: 'Cannot create negative balance in the future',
                        human: 'Het is niet mogelijk om een negatief openstaand bedrag toe te voegen in de toekomst',
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
                    model.status = model.pricePaid >= model.price ? BalanceItemStatus.Paid : BalanceItemStatus.Pending;
                }

                await model.save();
                returnedModels.push(model);

                if (patch.unitPrice || patch.amount || patch.status || patch.dueAt !== undefined) {
                    updateOutstandingBalance.push(model);
                }
            }
        });

        await BalanceItem.updateOutstanding(updateOutstandingBalance);

        return new Response(
            await BalanceItem.getStructureWithPayments(returnedModels),
        );
    }

    async validateMemberId(memberId: string) {
        const member = (await Member.getWithRegistrations(memberId));

        if (!member || !(await Context.auth.canLinkBalanceItemToMember(member))) {
            throw new SimpleError({
                code: 'permission_denied',
                message: 'No permission to link balanace items to this member',
                human: 'Je hebt geen toegang om aanrekeningen te maken verbonden met dit lid',
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
                message: 'No permission to link balanace items to this user',
                human: 'Je hebt geen toegang om aanrekeningen te maken verbonden met deze gebruiker',
                field: 'userId',
            });
        }

        return user;
    }
}
