import { Database } from '@simonbackx/simple-database';
import { AutoEncoderPatchType,Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { GroupPrivateSettings,Organization as OrganizationStruct, OrganizationPatch, PaymentMethod, PermissionLevel, Permissions } from "@stamhoofd/structures";

import { GroupBuilder } from '../helpers/GroupBuilder';
import { Group } from '../models/Group';
import { Invite } from '../models/Invite';
import { PayconiqPayment } from '../models/PayconiqPayment';
import { Token } from '../models/Token';
import { User } from '../models/User';
import { Webshop } from '../models/Webshop';

type Params = {};
type Query = undefined;
type Body = AutoEncoderPatchType<OrganizationStruct>;
type ResponseBody = OrganizationStruct;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class PatchOrganizationEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = OrganizationPatch as Decoder<AutoEncoderPatchType<OrganizationStruct>>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);

        // check if organization ID matches
        if (request.body.id !== token.user.organization.id) {
            throw new SimpleError({
                code: "invalid_id",
                message: "You cannot modify an organization with a different ID than the organization you are signed in for",
                statusCode: 403
            })
        }

        const user = token.user

        if (!user.permissions) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You do not have permissions for this endpoint",
                statusCode: 403
            })
        }

        const errors = new SimpleErrors()
        const allowedIds: string[] = []

        const organization = token.user.organization
        if (user.permissions.hasFullAccess()) {
            organization.name = request.body.name ?? organization.name
            if (request.body.website !== undefined) {
                organization.website = request.body.website;
            }

            if (request.body.address) {
                organization.address = organization.address.patch(request.body.address)
            }

            if (request.body.privateMeta && request.body.privateMeta.isPatch()) {
                organization.privateMeta.emails = request.body.privateMeta.emails.applyTo(organization.privateMeta.emails)
                organization.privateMeta.roles = request.body.privateMeta.roles.applyTo(organization.privateMeta.roles)

                if (request.body.privateMeta.payconiqApiKey !== undefined) {
                    if (request.body.privateMeta.payconiqApiKey === null) {
                        organization.privateMeta.payconiqApiKey = null;
                    } else {
                        organization.privateMeta.payconiqApiKey = request.body.privateMeta.payconiqApiKey ?? organization.privateMeta.payconiqApiKey

                    if (!(await PayconiqPayment.createTest(organization))) {
                        
                            throw new SimpleError({
                                code: "invalid_field",
                                message: "De API key voor Payconiq is niet geldig. Kijk eens na of je wel de juiste key hebt ingevuld.",
                                field: "payconiqApiKey"
                            })
                        }
                    }
                }
                
            }

            // Allow admin patches (permissions only atm). No put atm
            if (request.body.admins) {
                for (const patch of request.body.admins.getPatches()) {
                    if (patch.permissions) {
                        const admin = await User.getByID(patch.id)
                        if (!admin || admin.organizationId !== user.organizationId) {
                            throw new SimpleError({
                                code: "invalid_field",
                                message: "De beheerder die je wilt wijzigen bestaat niet (meer)",
                                field: "admins"
                            })
                        }

                        if (patch.permissions.isPatch()) {
                            admin.permissions = admin.permissions ? admin.permissions.patch(patch.permissions) : Permissions.create({}).patch(patch.permissions)
                        } else {
                            admin.permissions = patch.permissions
                        }
                        await admin.save()
                    }
                }
            }

            // Allow admin patches (permissions only atm). No put atm
            if (request.body.invites) {
                for (const patch of request.body.invites.getPatches()) {
                    if (patch.permissions) {
                        const invite = await Invite.getByID(patch.id)
                        if (!invite || invite.organizationId !== invite.organizationId) {
                            throw new SimpleError({
                                code: "invalid_field",
                                message: "De beheerder die je wilt wijzigen bestaat niet (meer)",
                                field: "invites"
                            })
                        }

                        if (patch.permissions.isPatch()) {
                            invite.permissions = invite.permissions ? invite.permissions.patch(patch.permissions) : Permissions.create({}).patch(patch.permissions)
                        } else {
                            invite.permissions = patch.permissions
                        }
                        await invite.save()
                    }
                }
            }

            if (request.body.meta) {
                const didUseMembers = organization.meta.modules.useMembers
                organization.meta.patchOrPut(request.body.meta)

                // check payconiq + mollie
                if (!organization.privateMeta.payconiqApiKey) {
                    const i = organization.meta.paymentMethods.findIndex(p => p == PaymentMethod.Payconiq)
                    if (i != -1) {
                        throw new SimpleError({
                            code: "invalid_field",
                            message: "Je kan Payconiq niet activeren omdat je geen Payconiq API Key hebt ingesteld. Schakel Payconiq uit voor je verder gaat.",
                            field: "paymentMethods"
                        })
                    }
                }

                 // check payconiq + mollie
                if (!organization.privateMeta.mollieOnboarding || !organization.privateMeta.mollieOnboarding.canReceivePayments) {
                    const i = organization.meta.paymentMethods.findIndex(p => p == PaymentMethod.Bancontact)
                    if (i != -1) {
                        throw new SimpleError({
                            code: "invalid_field",
                            message: "Je kan Bancontact niet activeren omdat Mollie niet correct gekoppeld is. Schakel Bancontact uit voor je verder gaat.",
                            field: "paymentMethods"
                        })
                    }
                }

                if (!didUseMembers && organization.meta.modules.useMembers) {
                    const builder = new GroupBuilder(organization)
                    await builder.build()
                }
            }


            // Save the organization
            await organization.save()
        } else {
            if (request.body.meta) {
                // Only allow adding groups if we have create permissions in a given category group
                if (request.body.meta.categories && !Array.isArray(request.body.meta.categories)) {
                    for (const patch of request.body.meta.categories.getPatches()) {
                        const category = organization.meta.categories.find(c => c.id === patch.id)
                        if (!category) {
                            // Fail silently
                            continue
                        }

                        if (category.settings.permissions.getPermissionLevel(user.permissions) !== "Create") {
                            throw new SimpleError({ code: "permission_denied", message: "You do not have permissions to add new groups", statusCode: 403 })
                        }

                        // Only process puts
                        const ids = patch.groupIds.getPuts().map(p => p.put)
                        allowedIds.push(...ids)
                        category.groupIds.push(...ids)
                    }

                    if (allowedIds.length > 0) {
                        await organization.save()
                    }
                }
            }

            if (request.body.name || request.body.address) {
                throw new SimpleError({
                    code: "permission_denied",
                    message: "You do not have permissions to edit the organization settings",
                    statusCode: 403
                })
            }
        }

        // Check changes to groups
        const deleteGroups = request.body.groups.getDeletes()
        if (deleteGroups.length > 0) {
            const validIds: string[] = []
            for (const id of deleteGroups) {
                const model = await Group.getByID(id)
                if (!model || model.organizationId != organization.id) {
                    errors.addError(new SimpleError({
                        code: "invalid_id",
                        message: "No group found with id " + id
                    }))
                    continue;
                }

                if (model.privateSettings.permissions.getPermissionLevel(user.permissions) !== PermissionLevel.Full) {
                    throw new SimpleError({ code: "permission_denied", message: "You do not have permissions to delete this group", statusCode: 403 })
                }
                validIds.push(id)
            }

            if (validIds.length > 0) {
                await Database.update("DELETE FROM `" + Group.table + "` WHERE id IN (?) and organizationId = ?", [validIds, organization.id]);
            }
        }

        for (const groupPut of request.body.groups.getPuts()) {
            if (!user.permissions.hasFullAccess() && !allowedIds.includes(groupPut.put.id)) {
                throw new SimpleError({ code: "permission_denied", message: "You do not have permissions to create groups", statusCode: 403 })
            }

            const struct = groupPut.put
            const model = new Group()
            model.id = struct.id
            model.organizationId = organization.id
            model.settings = struct.settings
            model.privateSettings = struct.privateSettings ?? GroupPrivateSettings.create({})

            // Check if current user has permissions to this new group -> else fail with error
            if (model.privateSettings.permissions.getPermissionLevel(user.permissions) !== PermissionLevel.Full) {
                throw new SimpleError({
                    code: "missing_permissions",
                    message: "You cannot restrict your own permissions",
                    human: "Je kan geen inschrijvingsgroep maken zonder dat je zelf volledige toegang hebt tot de nieuwe groep (stel dit in via het tabblad toegang)"
                })
            }

            await model.save();
        }

        for (const struct of request.body.groups.getPatches()) {
            const model = await Group.getByID(struct.id)
            if (!model || model.organizationId != organization.id) {
                errors.addError(new SimpleError({
                    code: "invalid_id",
                    message: "No group found with id " + struct.id
                }))
                continue;
            }

            if (model.privateSettings.permissions.getPermissionLevel(user.permissions) !== PermissionLevel.Full) {
                throw new SimpleError({ code: "permission_denied", message: "You do not have permissions to edit the settings of this group", statusCode: 403 })
            }

            if (struct.settings) {
                model.settings.patchOrPut(struct.settings)
            }
            
            if (struct.privateSettings) {
                model.privateSettings.patchOrPut(struct.privateSettings)

                if (model.privateSettings.permissions.getPermissionLevel(user.permissions) !== PermissionLevel.Full) {
                    throw new SimpleError({
                        code: "missing_permissions",
                        message: "You cannot restrict your own permissions",
                        human: "Je kan je eigen volledige toegang tot deze inschrijvingsgroep niet verwijderen (stel dit in via het tabblad toegang). Vraag aan een hoofdbeheerder om jouw toegang te verwijderen."
                    })
                }
            }
            
            await model.save();
        }

        // Only needed for permissions atm, so no put or delete here
        for (const struct of request.body.webshops.getPatches()) {
            const model = await Webshop.getByID(struct.id)
            if (!model || model.organizationId != organization.id) {
                errors.addError(new SimpleError({
                    code: "invalid_id",
                    message: "No webshop found with id " + struct.id
                }))
                continue;
            }


            if (model.privateMeta.permissions.getPermissionLevel(user.permissions) !== PermissionLevel.Full) {
                throw new SimpleError({ code: "permission_denied", message: "You do not have permissions to edit the settings of this webshop", statusCode: 403 })
            }

            if (struct.meta) {
                model.meta.patchOrPut(struct.meta)
            }
            
            if (struct.privateMeta) {
                model.privateMeta.patchOrPut(struct.privateMeta)
            }
            
            await model.save();
        }

        errors.throwIfNotEmpty()
        return new Response(await user.getOrganizatonStructure(organization));
    }
}
