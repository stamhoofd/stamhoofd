import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { GroupPrivateSettings, OrganizationRegistrationPeriod as OrganizationRegistrationPeriodStruct, PermissionLevel, PermissionsResourceType, ResourcePermissions, Version } from "@stamhoofd/structures";

import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from "@simonbackx/simple-encoding";
import { Context } from "../../../../helpers/Context";
import { Group, OrganizationRegistrationPeriod, Platform, RegistrationPeriod } from "@stamhoofd/models";
import { SimpleError } from "@simonbackx/simple-errors";

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<OrganizationRegistrationPeriodStruct>
type ResponseBody = OrganizationRegistrationPeriodStruct[]

/**
 * One endpoint to create, patch and delete members and their registrations and payments
 */

export class PatchRegistrationPeriodsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(OrganizationRegistrationPeriodStruct as Decoder<OrganizationRegistrationPeriodStruct>, OrganizationRegistrationPeriodStruct.patchType() as Decoder<AutoEncoderPatchType<OrganizationRegistrationPeriodStruct>>, StringDecoder)

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/registration-periods", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        const {user} = await Context.authenticate()

        if (!await Context.auth.hasFullAccess(organization.id)) {
            throw Context.auth.error()
        }

        const platform = await Platform.getShared()

        function validateDefaultGroupId(id: string|null): string|null {
            if (id === null) {
                return id;
            }

            if (platform.config.defaultAgeGroups.find(g => g.id === id)) {
                return id;
            }

            throw new SimpleError({
                code: "invalid_default_age_group",
                message: "Invalid default age group",
                human: "De standaard leeftijdsgroep is ongeldig",
                statusCode: 400
            })
        }

        const structs: OrganizationRegistrationPeriodStruct[] = [];

        for (const {put} of request.body.getPuts()) {
            if (!await Context.auth.hasFullAccess(organization.id)) {
                throw Context.auth.error()
            }
            const period = await RegistrationPeriod.getByID(put.period.id);

            if (!period) {
                throw new SimpleError({
                    code: "not_found",
                    message: "Period not found",
                    statusCode: 404
                })
            }

            const organizationPeriod = new OrganizationRegistrationPeriod();
            organizationPeriod.id = put.id;
            organizationPeriod.organizationId = organization.id;
            organizationPeriod.periodId = put.period.id;
            organizationPeriod.settings = put.settings;
            await organizationPeriod.save();

            for (const struct of put.groups) {
                const model = new Group()
                model.id = struct.id
                model.organizationId = organization.id
                model.defaultAgeGroupId = validateDefaultGroupId(struct.defaultAgeGroupId)
                model.periodId = organizationPeriod.periodId
                model.settings = struct.settings
                model.privateSettings = struct.privateSettings ?? GroupPrivateSettings.create({})
                model.status = struct.status
                await model.updateOccupancy()
                await model.save();
            }
            const groups = await Group.getAll(organization.id, organizationPeriod.periodId)

            // Delete unreachable categories first
            await organizationPeriod.cleanCategories(groups);
            await Group.deleteUnreachable(organization.id, organizationPeriod, groups)
            structs.push(organizationPeriod.getPrivateStructure(period, groups));
        }

        for (const patch of request.body.getPatches()) {
            const organizationPeriod = await OrganizationRegistrationPeriod.getByID(patch.id);
            if (!organizationPeriod || organizationPeriod.organizationId !== organization.id) {
                throw new SimpleError({
                    code: "not_found",
                    message: "Period not found",
                    statusCode: 404
                })
            }
            let deleteUnreachable = false
            const allowedIds: string[] = []

            if (await Context.auth.hasFullAccess(organization.id)) {
                if (patch.settings) {
                    organizationPeriod.settings.patchOrPut(patch.settings);
                }
            } else {
                /// Only allow editing category group ids
                if (patch.settings) {
                    // Only allow adding groups if we have create permissions in a given category group
                    if (patch.settings.categories && !Array.isArray(patch.settings.categories)) {
                        for (const pp of patch.settings.categories.getPatches()) {
                            const category = organizationPeriod.settings.categories.find(c => c.id === pp.id)
                            if (!category) {
                                // Fail silently
                                continue
                            }
    
                            if (!await Context.auth.canCreateGroupInCategory(organization.id, category)) {
                                throw Context.auth.error('Je hebt geen toegangsrechten om groepen toe te voegen in deze categorie')
                            }
                                
                            // Only process puts
                            const ids = pp.groupIds.getPuts().map(p => p.put)
                            allowedIds.push(...ids)
                            category.groupIds.push(...ids)
                        }
    
                        if (allowedIds.length > 0) {
                            deleteUnreachable = true
                        }
                    }
                }
            }

            await organizationPeriod.save();

            // Check changes to groups
            const deleteGroups = patch.groups.getDeletes()
            if (deleteGroups.length > 0) {
                for (const id of deleteGroups) {
                    const model = await Group.getByID(id)
                    if (!model || !await Context.auth.canAccessGroup(model, PermissionLevel.Full)) {
                        throw Context.auth.error('Je hebt geen toegangsrechten om deze groep te verwijderen')
                    }

                    model.deletedAt = new Date()
                    await model.save()
                    deleteUnreachable = true
                }
            }

            for (const groupPut of patch.groups.getPuts()) {
                if (!await Context.auth.hasFullAccess(organization.id) && !allowedIds.includes(groupPut.put.id)) {
                    throw Context.auth.error('Je hebt geen toegangsrechten om groepen toe te voegen')
                }

                const struct = groupPut.put
                const model = new Group()
                model.id = struct.id
                model.organizationId = organization.id
                model.defaultAgeGroupId = validateDefaultGroupId(struct.defaultAgeGroupId)
                model.periodId = organizationPeriod.periodId
                model.settings = struct.settings
                model.privateSettings = struct.privateSettings ?? GroupPrivateSettings.create({})
                model.status = struct.status

                if (!await Context.auth.canAccessGroup(model, PermissionLevel.Full)) {
                    // Create a temporary permission role for this user
                    const organizationPermissions = user.permissions?.organizationPermissions?.get(organization.id)
                    if (!organizationPermissions) {
                        throw new Error('Unexpected missing permissions')
                    }
                    const resourcePermissions = ResourcePermissions.create({
                        resourceName: model.settings.name,
                        level: PermissionLevel.Full
                    })
                    const patch = resourcePermissions.createInsertPatch(PermissionsResourceType.Groups, model.id, organizationPermissions)
                    user.permissions!.organizationPermissions.set(organization.id, organizationPermissions.patch(patch))
                    console.log('Automatically granted author full permissions to resource', 'group', model.id, 'user', user.id, 'patch', patch.encode({version: Version}))
                    await user.save()
                }

                // Check if current user has permissions to this new group -> else fail with error
                if (!await Context.auth.canAccessGroup(model, PermissionLevel.Full)) {
                    throw new SimpleError({
                        code: "missing_permissions",
                        message: "You cannot restrict your own permissions",
                        human: "Je kan geen inschrijvingsgroep maken zonder dat je zelf volledige toegang hebt tot de nieuwe groep"
                    })
                    continue;
                }

                await model.updateOccupancy()
                await model.save();
            }

            for (const struct of patch.groups.getPatches()) {
                const model = await Group.getByID(struct.id)

                if (!model || !await Context.auth.canAccessGroup(model, PermissionLevel.Full)) {
                    throw Context.auth.error('Je hebt geen toegangsrechten om deze groep te wijzigen')
                }

                if (struct.settings) {
                    model.settings.patchOrPut(struct.settings)
                }

                if (struct.status) {
                    model.status = struct.status
                }
                
                if (struct.privateSettings) {
                    model.privateSettings.patchOrPut(struct.privateSettings)

                    if (!await Context.auth.canAccessGroup(model, PermissionLevel.Full)) {
                        throw new SimpleError({
                            code: "missing_permissions",
                            message: "You cannot restrict your own permissions",
                            human: "Je kan je eigen volledige toegang tot deze inschrijvingsgroep niet verwijderen. Vraag aan een hoofdbeheerder om jouw toegang te verwijderen."
                        })
                    }
                }

                if (struct.cycle !== undefined) {
                    model.cycle = struct.cycle
                }

                if (struct.deletedAt !== undefined) {
                    model.deletedAt = struct.deletedAt
                }

                if (struct.defaultAgeGroupId !== undefined) {
                    model.defaultAgeGroupId = validateDefaultGroupId(struct.defaultAgeGroupId)
                }
                
                await model.updateOccupancy()
                await model.save();
            }

            const period = await RegistrationPeriod.getByID(organizationPeriod.periodId);
            const groups = await Group.getAll(organization.id, organizationPeriod.periodId)

            if (deleteUnreachable) {
                // Delete unreachable categories first
                await organizationPeriod.cleanCategories(groups);
                await Group.deleteUnreachable(organization.id, organizationPeriod, groups)
            }

            if (period) {
                structs.push(organizationPeriod.getPrivateStructure(period, groups));
            }
        }

        return new Response(
            structs
        );
    }

}
