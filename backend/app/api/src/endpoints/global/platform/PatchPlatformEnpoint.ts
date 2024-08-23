import { AutoEncoderPatchType, Decoder, patchObject } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Organization, Platform, RegistrationPeriod } from "@stamhoofd/models";
import { MemberResponsibility, PlatformConfig, PlatformPremiseType, Platform as PlatformStruct } from "@stamhoofd/structures";

import { SimpleError } from "@simonbackx/simple-errors";
import { Context } from "../../../helpers/Context";
import { SetupStepUpdater } from "../../../helpers/SetupStepsUpdater";

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
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/platform", {});

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

        const platform = await Platform.getShared();

        if (request.body.privateConfig) {
            // Did we patch roles?
            if (request.body.privateConfig.roles) {
                if (!Context.auth.canManagePlatformAdmins()) {
                    throw Context.auth.error();
                }

                // Update roles
                platform.privateConfig.roles = patchObject(
                    platform.privateConfig.roles,
                    request.body.privateConfig.roles
                );
            }

            if (request.body.privateConfig.emails) {
                if (!Context.auth.hasPlatformFullAccess()) {
                    throw Context.auth.error();
                }

                // Update roles
                platform.privateConfig.emails = patchObject(
                    platform.privateConfig.emails,
                    request.body.privateConfig.emails
                );
            }
        }

        if (request.body.config) {
            if (!Context.auth.hasPlatformFullAccess()) {
                throw Context.auth.error();
            }

            const newConfig = request.body.config;

            // Update config
            if (newConfig) {
                if (newConfig.premiseTypes || newConfig.responsibilities) {
                    const oldConfig = platform.config.clone();
                    platform.config = patchObject(platform.config, newConfig);
                    const currentConfig = platform.config;

                    this.updateSetupSteps(
                        currentConfig,
                        newConfig,
                        oldConfig
                    );
                } else {
                    platform.config = patchObject(platform.config, newConfig);
                }
            }
        }

        if (
            request.body.period &&
            request.body.period.id !== platform.periodId
        ) {
            const period = await RegistrationPeriod.getByID(
                request.body.period.id
            );
            if (!period || period.organizationId) {
                throw new SimpleError({
                    code: "invalid_period",
                    message: "Invalid period",
                });
            }
            platform.periodId = period.id;
        }

        if (request.body.membershipOrganizationId !== undefined) {
            if (!Context.auth.hasPlatformFullAccess()) {
                throw Context.auth.error()
            }

            if (request.body.membershipOrganizationId) {
                const organization = await Organization.getByID(request.body.membershipOrganizationId)
                if (!organization) {
                    throw new SimpleError({
                        code: "invalid_organization",
                        message: "Invalid organization"
                    })
                }
                platform.membershipOrganizationId = organization.id
            } else {
                platform.membershipOrganizationId = null
            }
        }

        if (request.body.membershipOrganizationId !== undefined) {
            if (!Context.auth.hasPlatformFullAccess()) {
                throw Context.auth.error()
            }

            if (request.body.membershipOrganizationId) {
                const organization = await Organization.getByID(request.body.membershipOrganizationId)
                if (!organization) {
                    throw new SimpleError({
                        code: "invalid_organization",
                        message: "Invalid organization"
                    })
                }
                platform.membershipOrganizationId = organization.id
            } else {
                platform.membershipOrganizationId = null
            }
        }

        await platform.save();
        return new Response(await Platform.getSharedPrivateStruct());
    }

    private updateSetupSteps(
        currentConfig: PlatformConfig,
        newConfig: PlatformConfig | AutoEncoderPatchType<PlatformConfig>,
        oldConfig: PlatformConfig
    ) {
        let shouldUpdate = false;
        const premiseTypes: PlatformPremiseType[] = currentConfig.premiseTypes;
        const responsibilities: MemberResponsibility[] =
            currentConfig.responsibilities;

        if (
            newConfig.premiseTypes &&
            this.shouldUpdateSetupStepPremise(
                premiseTypes,
                oldConfig.premiseTypes
            )
        ) {
            shouldUpdate = true;
        }

        if (
            !shouldUpdate &&
            newConfig.responsibilities &&
            this.shouldUpdateSetupStepFunctions(
                responsibilities,
                oldConfig.responsibilities
            )
        ) {
            shouldUpdate = true;
        }

        if (shouldUpdate) {
            SetupStepUpdater.updateSetupStepsForAllOrganizationsInCurrentPeriod(
                { premiseTypes, responsibilities }
            ).catch(console.error);
        }
    }

    private shouldUpdateSetupStepPremise(
        newPremiseTypes: PlatformPremiseType[],
        oldPremiseTypes: PlatformPremiseType[]
    ) {
        for (const premiseType of newPremiseTypes) {
            const id = premiseType.id;
            const oldVersion = oldPremiseTypes.find((x) => x.id === id);

            // if premise type is not new
            if (oldVersion) {
                if (
                    oldVersion.min !== premiseType.min ||
                    oldVersion.max !== premiseType.max
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
            if (!newPremiseTypes.some((x) => x.id === id)) {
                if (oldPremiseType.min || oldPremiseType.max) {
                    return true;
                }
            }
        }
    }

    private shouldUpdateSetupStepFunctions(
        newResponsibilities: MemberResponsibility[],
        oldResponsibilities: MemberResponsibility[]
    ) {
        for (const responsibility of newResponsibilities) {
            const id = responsibility.id;
            const oldVersion = oldResponsibilities.find((x) => x.id === id);

            // if responsibility is not new
            if (oldVersion) {
                if (
                    oldVersion.minimumMembers !==
                        responsibility.minimumMembers ||
                    oldVersion.maximumMembers !== responsibility.maximumMembers
                ) {
                    return true;
                }
                continue;
            }

            // if responsibility is new
            if (
                responsibility.minimumMembers ||
                responsibility.maximumMembers
            ) {
                return true;
            }
        }

        for (const oldResponsibility of oldResponsibilities) {
            const id = oldResponsibility.id;

            // if responsibility is removed
            if (!newResponsibilities.some((x) => x.id === id)) {
                if (
                    oldResponsibility.minimumMembers ||
                    oldResponsibility.maximumMembers
                ) {
                    return true;
                }
            }
        }
    }
}
