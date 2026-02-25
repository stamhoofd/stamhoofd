import { AutoEncoderPatchType, Decoder, isPatchableArray, patchObject } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Organization, Platform, RegistrationPeriod } from '@stamhoofd/models';
import { MemberResponsibility, PlatformConfig, PlatformPremiseType, Platform as PlatformStruct } from '@stamhoofd/structures';

import { SimpleError } from '@simonbackx/simple-errors';
import { QueueHandler } from '@stamhoofd/queues';
import { Context } from '../../../helpers/Context.js';
import { MembershipCharger } from '../../../helpers/MembershipCharger.js';
import { MemberUserSyncer } from '../../../helpers/MemberUserSyncer.js';
import { PeriodHelper } from '../../../helpers/PeriodHelper.js';
import { SetupStepUpdater } from '../../../helpers/SetupStepUpdater.js';
import { TagHelper } from '../../../helpers/TagHelper.js';
import { PlatformMembershipService } from '../../../services/PlatformMembershipService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = AutoEncoderPatchType<PlatformStruct>;
type ResponseBody = PlatformStruct;

export class PatchPlatformEndpoint extends Endpoint<
    Params,
    Query,
    Body,
    ResponseBody
> {
    bodyDecoder = PlatformStruct.patchType() as Decoder<
        AutoEncoderPatchType<PlatformStruct>
    >;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/platform', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.authenticate();

        // Fast throw first (more in depth checking for patches later)
        if (!Context.auth.hasPlatformFullAccess()) {
            throw Context.auth.error();
        }

        const platform = await Platform.getForEditing();
        let shouldUpdateUserPermissions = false;

        if (request.body.privateConfig) {
            // Did we patch roles?
            if (request.body.privateConfig.roles) {
                if (!Context.auth.canManagePlatformAdmins()) {
                    throw Context.auth.error();
                }

                // Update roles
                platform.privateConfig.roles = patchObject(
                    platform.privateConfig.roles,
                    request.body.privateConfig.roles,
                );
                shouldUpdateUserPermissions = true;
            }

            if (request.body.privateConfig.emails) {
                if (!Context.auth.hasPlatformFullAccess()) {
                    throw Context.auth.error();
                }

                // Update roles
                platform.privateConfig.emails = patchObject(
                    platform.privateConfig.emails,
                    request.body.privateConfig.emails,
                );
            }
        }

        let shouldUpdateSetupSteps = false;
        let shouldMoveToPeriod: RegistrationPeriod | null = null;
        let shouldUpdateMemberships = false;
        let shouldUpdateTags = false;

        if (request.body.config) {
            if (!Context.auth.hasPlatformFullAccess()) {
                throw Context.auth.error();
            }

            if (request.body.config.organizationLevelRecordsConfiguration) {
                shouldUpdateSetupSteps = true;
            }

            const newConfig = request.body.config;

            // Update config
            if (newConfig) {
                const oldConfig: PlatformConfig = platform.config.clone();
                const shouldCheckSteps = newConfig.premiseTypes || newConfig.responsibilities;
                if (shouldCheckSteps) {
                    platform.config = patchObject(platform.config, newConfig);
                    const currentConfig: PlatformConfig = platform.config;

                    shouldUpdateSetupSteps = shouldUpdateSetupSteps || this.shouldUpdateSetupSteps(
                        currentConfig,
                        newConfig,
                        oldConfig,
                    );
                }
                else {
                    platform.config = patchObject(platform.config, newConfig);
                }
            }

            if (newConfig.tags && isPatchableArray(newConfig.tags) && newConfig.tags.changes.length > 0) {
                let newTags = (platform.config as PlatformConfig).tags;
                newTags = TagHelper.getCleanedUpTags(newTags);
                platform.config.tags = newTags;
                const areTagsValid = TagHelper.validateTags(newTags);
                if (!areTagsValid) {
                    throw new SimpleError({
                        code: 'invalid_tags',
                        message: 'Invalid tags',
                    });
                }
                shouldUpdateTags = true;
            }

            if (newConfig.membershipTypes && isPatchableArray(newConfig.membershipTypes) && newConfig.membershipTypes.changes.length > 0) {
                shouldUpdateMemberships = true;
            }

            if (newConfig.defaultAgeGroups && isPatchableArray(newConfig.defaultAgeGroups) && newConfig.defaultAgeGroups.changes.length > 0) {
                for (const d of newConfig.defaultAgeGroups.getPatches()) {
                    if (d.defaultMembershipTypeId !== undefined) {
                        shouldUpdateMemberships = true;
                    }

                    if (d.minimumRequiredMembers !== undefined) {
                        shouldUpdateSetupSteps = true;
                    }
                }
            }
        }

        if (
            request.body.period
            && request.body.period.id !== platform.periodId
        ) {
            const period = await RegistrationPeriod.getByID(
                request.body.period.id,
            );
            if (!period || period.organizationId) {
                throw new SimpleError({
                    code: 'invalid_period',
                    message: 'Invalid period',
                });
            }
            if (period.locked) {
                throw new SimpleError({
                    code: 'cannot_set_locked_period',
                    message: 'Platform period cannot be set to a locked period',
                    human: $t(`fdd15119-b950-4282-9413-fd6973afde07`),
                });
            }
            platform.periodId = period.id;
            shouldUpdateSetupSteps = true;
            shouldMoveToPeriod = period;

            await platform.setPreviousPeriodId();
        }

        if (request.body.membershipOrganizationId !== undefined) {
            if (!Context.auth.hasPlatformFullAccess()) {
                throw Context.auth.error();
            }

            if (request.body.membershipOrganizationId) {
                const organization = await Organization.getByID(request.body.membershipOrganizationId);
                if (!organization) {
                    throw new SimpleError({
                        code: 'invalid_organization',
                        message: 'Invalid organization',
                    });
                }
                platform.membershipOrganizationId = organization.id;
            }
            else {
                platform.membershipOrganizationId = null;
            }
        }

        if (request.body.membershipOrganizationId !== undefined) {
            if (!Context.auth.hasPlatformFullAccess()) {
                throw Context.auth.error();
            }

            if (request.body.membershipOrganizationId) {
                const organization = await Organization.getByID(request.body.membershipOrganizationId);
                if (!organization) {
                    throw new SimpleError({
                        code: 'invalid_organization',
                        message: 'Invalid organization',
                    });
                }
                platform.membershipOrganizationId = organization.id;
            }
            else {
                platform.membershipOrganizationId = null;
            }
        }

        await platform.save();

        if (shouldUpdateMemberships) {
            if (!QueueHandler.isRunning('update-membership-prices')) {
                QueueHandler.schedule('update-membership-prices', async () => {
                    // Update all membership prices (required to update temporary memberships)
                    await MembershipCharger.updatePrices();

                    // Update memberships of all members (note: this only updates non-day memberships)
                    await PlatformMembershipService.updateAll();
                }).catch(console.error);
            }
        }

        if (shouldUpdateTags) {
            await TagHelper.updateOrganizations();
        }

        if (shouldMoveToPeriod) {
            PeriodHelper.moveAllOrganizationsToPeriod(shouldMoveToPeriod).catch(console.error);
        }
        else if (shouldUpdateSetupSteps) {
            // Do not call this right away when moving to a period, because this needs to happen AFTER moving to the period
            SetupStepUpdater.updateSetupStepsForAllOrganizationsInCurrentPeriod().catch(console.error);
        }

        if (shouldUpdateUserPermissions) {
            await MemberUserSyncer.updatePermissionsForPlatform();
        }

        return new Response(await Platform.getSharedPrivateStruct());
    }

    private shouldUpdateSetupSteps(
        currentConfig: PlatformConfig,
        newConfig: PlatformConfig | AutoEncoderPatchType<PlatformConfig>,
        oldConfig: PlatformConfig,
    ): boolean {
        let shouldUpdate = false;
        const premiseTypes: PlatformPremiseType[] = currentConfig.premiseTypes;
        const responsibilities: MemberResponsibility[]
            = currentConfig.responsibilities;

        if (
            newConfig.premiseTypes
            && this.shouldUpdateSetupStepPremise(
                premiseTypes,
                oldConfig.premiseTypes,
            )
        ) {
            shouldUpdate = true;
        }

        if (
            !shouldUpdate
            && newConfig.responsibilities
            && this.shouldUpdateSetupStepFunctions(
                responsibilities,
                oldConfig.responsibilities,
            )
        ) {
            shouldUpdate = true;
        }

        return shouldUpdate;
    }

    private shouldUpdateSetupStepPremise(
        newPremiseTypes: PlatformPremiseType[],
        oldPremiseTypes: PlatformPremiseType[],
    ) {
        // should be updated because the step will be removed
        if (newPremiseTypes.length === 0 && oldPremiseTypes.length !== 0) {
            return true;
        }

        // should be updated because the step will be added
        if (newPremiseTypes.length !== 0 && oldPremiseTypes.length === 0) {
            return true;
        }

        for (const premiseType of newPremiseTypes) {
            const id = premiseType.id;
            const oldVersion = oldPremiseTypes.find(x => x.id === id);

            // if premise type is not new
            if (oldVersion) {
                if (
                    oldVersion.min !== premiseType.min
                    || oldVersion.max !== premiseType.max
                ) {
                    return true;
                }
                continue;
            }

            // if premise type is new
            if (premiseType.min || premiseType.max) {
                return true;
            }
        }

        for (const oldPremiseType of oldPremiseTypes) {
            const id = oldPremiseType.id;

            // if premise type is removed
            if (!newPremiseTypes.some(x => x.id === id)) {
                if (oldPremiseType.min || oldPremiseType.max) {
                    return true;
                }
            }
        }
    }

    private shouldUpdateSetupStepFunctions(
        newResponsibilities: MemberResponsibility[],
        oldResponsibilities: MemberResponsibility[],
    ) {
        for (const responsibility of newResponsibilities) {
            const id = responsibility.id;
            const oldVersion = oldResponsibilities.find(x => x.id === id);

            // if responsibility is not new
            if (oldVersion) {
                // if restrictions changed
                if (
                    oldVersion.minimumMembers
                    !== responsibility.minimumMembers
                    || oldVersion.maximumMembers !== responsibility.maximumMembers
                ) {
                    return true;
                }
                continue;
            }

            // if responsibility is new
            if (
                responsibility.minimumMembers
                || responsibility.maximumMembers
            ) {
                return true;
            }
        }

        for (const oldResponsibility of oldResponsibilities) {
            const id = oldResponsibility.id;

            // if responsibility is removed
            if (!newResponsibilities.some(x => x.id === id)) {
                // if responsibility had restrictions
                if (
                    oldResponsibility.minimumMembers
                    || oldResponsibility.maximumMembers
                ) {
                    return true;
                }
            }
        }
    }
}
