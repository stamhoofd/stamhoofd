import { Database } from '@simonbackx/simple-database';
import { AutoEncoderPatchType,Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { GroupPrivateSettings,Organization as OrganizationStruct, OrganizationPatch, PaymentMethod } from "@stamhoofd/structures";
import { v4 as uuidv4 } from "uuid";

import { Group } from '../models/Group';
import { PayconiqPayment } from '../models/PayconiqPayment';
import { Payment } from '../models/Payment';
import { Token } from '../models/Token';

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

        if (!user.permissions || !user.permissions.hasReadAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You do not have permissions for this endpoint",
                statusCode: 403
            })
        }

        const errors = new SimpleErrors()

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

            if (request.body.meta) {
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
            }


            // Save the organization
            await organization.save()
        } else {
            if (request.body.name || request.body.address || request.body.meta) {
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
            if (!user.permissions.hasFullAccess()) {
                throw new SimpleError({ code: "permission_denied", message: "You do not have permissions to delete groups", statusCode: 403 })
            }
            await Database.update("DELETE FROM `" + Group.table + "` WHERE id IN (?) and organizationId = ?", [deleteGroups, organization.id]);
        }

        for (const groupPut of request.body.groups.getPuts()) {
            if (!user.permissions.hasFullAccess()) {
                throw new SimpleError({ code: "permission_denied", message: "You do not have permissions to create groups", statusCode: 403 })
            }

            const struct = groupPut.put
            const model = new Group()
            model.id = struct.id
            model.organizationId = organization.id
            model.settings = struct.settings
            model.privateSettings = struct.privateSettings ?? GroupPrivateSettings.create({})
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


            if (!user.permissions.hasFullAccess(model.id)) {
                throw new SimpleError({ code: "permission_denied", message: "You do not have permissions to edit the settings of this group", statusCode: 403 })
            }

            if (struct.settings) {
                model.settings.patchOrPut(struct.settings)
            }
            
            if (struct.privateSettings) {
                model.privateSettings.patchOrPut(struct.privateSettings)
            }
            
            await model.save();
        }

        errors.throwIfNotEmpty()
        return new Response(await user.getOrganizatonStructure(organization));
    }
}
