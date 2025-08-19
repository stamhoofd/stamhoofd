import { ConvertArrayToPatchableArray, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder, patchObject } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { AuditLogSource, RegistrationPeriod as RegistrationPeriodStruct } from '@stamhoofd/structures';

import { SimpleError } from '@simonbackx/simple-errors';
import { Organization, Platform, RegistrationPeriod } from '@stamhoofd/models';
import { Context } from '../../../helpers/Context';
import { PeriodHelper } from '../../../helpers/PeriodHelper';
import { AuditLogService } from '../../../services/AuditLogService';

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<RegistrationPeriodStruct>;
type ResponseBody = RegistrationPeriodStruct[];

/**
 * One endpoint to create, patch and delete members and their registrations and payments
 */

export class PatchRegistrationPeriodsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    bodyDecoder = new PatchableArrayDecoder(RegistrationPeriodStruct as any, RegistrationPeriodStruct.patchType(), StringDecoder) as any as Decoder<ConvertArrayToPatchableArray<RegistrationPeriodStruct[]>>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/registration-periods', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async isCurrentRegistrationPeriod(organizationId: string | null, periodId: string) {
        if (organizationId === null) {
            const platform = await Platform.getSharedStruct();
            return platform.periodIdIfPlatform === periodId;
        }

        const organization = await Organization.getByID(organizationId);
        if (!organization) {
            throw new SimpleError({
                code: 'not_found',
                statusCode: 404,
                message: 'Organization not found',
            });
        }

        return organization.periodId === periodId;
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setUserOrganizationScope();
        await Context.authenticate();

        // Fast throw first (more in depth checking for patches later)
        if (organization) {
            if (!await Context.auth.hasFullAccess(organization.id)) {
                throw Context.auth.error();
            }
        }
        else {
            if (!Context.auth.hasPlatformFullAccess()) {
                throw Context.auth.error();
            }
        }

        const periods: RegistrationPeriod[] = [];

        for (const { put } of request.body.getPuts()) {
            const period = new RegistrationPeriod();
            period.id = put.id;
            period.startDate = put.startDate;
            period.endDate = put.endDate;
            period.locked = put.locked;
            period.settings = put.settings;
            period.organizationId = organization?.id ?? null;

            if (put.locked === true) {
                // current period cannot be locked
                const isCurrentRegistrationPeriod = await PatchRegistrationPeriodsEndpoint.isCurrentRegistrationPeriod(period.organizationId, period.id);

                if (isCurrentRegistrationPeriod) {
                    throw new SimpleError({
                        code: 'cannot_lock_current_period',
                        message: 'Current registration period cannot be locked',
                        human: $t(`1401fb57-4172-4211-acdb-0afbc87af86e`),
                    });
                }
            }

            await period.setPreviousPeriodId();

            await period.save();
            periods.push(period);
        }

        for (const patch of request.body.getPatches()) {
            const model = await RegistrationPeriod.getByID(patch.id);

            if (!model || model.organizationId !== (organization?.id ?? null)) {
                throw new SimpleError({
                    code: 'not_found',
                    statusCode: 404,
                    message: 'Registration period not found',
                });
            }

            if (patch.locked === true) {
                // current period cannot be locked
                const isCurrentRegistrationPeriod = await PatchRegistrationPeriodsEndpoint.isCurrentRegistrationPeriod(model.organizationId, model.id);

                if (isCurrentRegistrationPeriod) {
                    throw new SimpleError({
                        code: 'cannot_lock_current_period',
                        message: 'Current registration period cannot be locked',
                        human: $t(`1401fb57-4172-4211-acdb-0afbc87af86e`),
                    });
                }
            }

            if (patch.startDate !== undefined) {
                model.startDate = patch.startDate;
            }

            if (patch.endDate !== undefined) {
                model.endDate = patch.endDate;
            }

            if (patch.locked !== undefined) {
                model.locked = patch.locked;
            }

            if (patch.settings !== undefined) {
                model.settings = patchObject(model.settings, patch.settings);
            }

            await model.setPreviousPeriodId();
            await model.save();

            // Schedule patch of all groups in this period
            PeriodHelper.updateGroupsInPeriod(model).catch(console.error);
        }

        for (const id of request.body.getDeletes()) {
            const model = await RegistrationPeriod.getByID(id);

            if (!model || model.organizationId !== (organization?.id ?? null)) {
                throw new SimpleError({
                    code: 'not_found',
                    statusCode: 404,
                    message: 'Registration period not found',
                });
            }

            // Get before deleting the model
            const updateWhere = await RegistrationPeriod.where({ previousPeriodId: model.id });

            // Now delete the model
            await model.delete();

            // Update all previous period ids
            await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
                for (const period of updateWhere) {
                    await period.setPreviousPeriodId();
                    await period.save();
                }
            });
        }

        // Clear platform cache
        Platform.clearCache();

        return new Response(
            periods.map(p => p.getStructure()),
        );
    }
}
