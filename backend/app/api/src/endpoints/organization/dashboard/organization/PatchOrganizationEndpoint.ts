import { AutoEncoderPatchType, Decoder, ObjectData, patchObject } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Group, Organization,PayconiqPayment, StripeAccount, Token, User, Webshop } from '@stamhoofd/models';
import { BuckarooSettings, Company,GroupPrivateSettings, Organization as OrganizationStruct, OrganizationPatch, PayconiqAccount, PaymentMethod, PaymentMethodHelper, PermissionLevel, Permissions } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';

import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures';
import { BuckarooHelper } from '../../../../helpers/BuckarooHelper';
import { Context } from '../../../../helpers/Context';
import { ViesHelper } from '../../../../helpers/ViesHelper';

type Params = Record<string, never>;
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
        const organization = await Context.setOrganizationScope();
       const {user} = await Context.authenticate()

        if (!Context.auth.hasSomeAccess()) {
            throw Context.auth.error()
        }
        
        // check if organization ID matches
        if (request.body.id !== organization.id) {
            throw new SimpleError({
                code: "invalid_id",
                message: "You cannot modify an organization with a different ID than the organization you are signed in for",
                statusCode: 403
            })
        }

        let deleteUnreachable = false

        const errors = new SimpleErrors()
        const allowedIds: string[] = []

        if (Context.auth.hasFullAccess()) {
            organization.name = request.body.name ?? organization.name
            if (request.body.website !== undefined) {
                organization.website = request.body.website;
            }

            if (request.body.address) {
                organization.address = organization.address.patch(request.body.address)
            }

            if (request.body.uri && request.body.uri !== organization.uri) {
                const slugified = Formatter.slug(request.body.uri);
                if (slugified.length > 100) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Field is too long",
                        human: "De URI van de vereniging is te lang",
                        field: "uri"
                    })
                }

                if (slugified.length < 3) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Field is too short",
                        human: "De URI van de vereniging is te kort",
                        field: "uri"
                    })
                }
                const alreadyExists = await Organization.getByURI(slugified);

                if (alreadyExists) {
                    throw new SimpleError({
                        code: "name_taken",
                        message: "An organization with the same URI already exists",
                        human: "Er bestaat al een vereniging met dezelfde URI. Voeg bijvoorbeeld de naam van je gemeente toe.",
                        field: "uri",
                    });
                }

                organization.uri = slugified
            }

            if (request.body.privateMeta && request.body.privateMeta.isPatch()) {
                organization.privateMeta.emails = request.body.privateMeta.emails.applyTo(organization.privateMeta.emails)
                organization.privateMeta.roles = request.body.privateMeta.roles.applyTo(organization.privateMeta.roles)
                organization.privateMeta.privateKey = request.body.privateMeta.privateKey ?? organization.privateMeta.privateKey
                organization.privateMeta.featureFlags = patchObject(organization.privateMeta.featureFlags, request.body.privateMeta.featureFlags);
                organization.privateMeta.externalSyncData = patchObject(organization.privateMeta.externalSyncData, request.body.privateMeta.externalSyncData);
                organization.privateMeta.externalGroupNumber = patchObject(organization.privateMeta.externalGroupNumber, request.body.privateMeta.externalGroupNumber);

                if (request.body.privateMeta.mollieProfile !== undefined) {
                    organization.privateMeta.mollieProfile = patchObject(organization.privateMeta.mollieProfile, request.body.privateMeta.mollieProfile)
                }

                if (request.body.privateMeta.useTestPayments !== undefined) {
                    organization.privateMeta.useTestPayments = request.body.privateMeta.useTestPayments
                }

                // Apply payconiq patch
                if (request.body.privateMeta.payconiqAccounts !== undefined) {
                    organization.privateMeta.payconiqAccounts = patchObject(organization.privateMeta.payconiqAccounts, request.body.privateMeta.payconiqAccounts)

                    for (const account of organization.privateMeta.payconiqAccounts) {
                        if (account.merchantId === null) {
                            const payment = await PayconiqPayment.createTest(organization, account)
                            
                            if (!payment) {
                                throw new SimpleError({
                                    code: "invalid_field",
                                    message: "De API-key voor Payconiq is niet geldig. Kijk eens na of je wel de juiste key hebt ingevuld.",
                                    field: "payconiqAccounts"
                                })
                            }

                            // Save merchant id
                            const decoded = PayconiqAccount.decode(
                                new ObjectData({
                                    ...(payment as any).creditor,
                                    id: account.id,
                                    apiKey: account.apiKey,
                                }, {version: 0})
                            )

                            account.merchantId = decoded.merchantId
                            account.callbackUrl = decoded.callbackUrl
                            account.profileId = decoded.profileId
                            account.name = decoded.name
                            account.iban = decoded.iban
                        }
                    }
                }

                if (request.body.privateMeta.buckarooSettings !== undefined) {
                    if (request.body.privateMeta.buckarooSettings === null) {
                        organization.privateMeta.buckarooSettings = null;
                    } else {
                        organization.privateMeta.buckarooSettings = organization.privateMeta.buckarooSettings ?? BuckarooSettings.create({})
                        organization.privateMeta.buckarooSettings.patchOrPut(request.body.privateMeta.buckarooSettings)

                        // Validate buckaroo settings
                        const buckaroo = new BuckarooHelper(organization.privateMeta.buckarooSettings.key, organization.privateMeta.buckarooSettings.secret, organization.privateMeta.useTestPayments ?? STAMHOOFD.environment != 'production')

                        if (!(await buckaroo.createTest())) {
                            throw new SimpleError({
                                code: "invalid_field",
                                message: "De key of secret voor Buckaroo is niet geldig. Kijk eens na of je wel de juiste key hebt ingevuld.",
                                field: "buckarooSettings"
                            })
                        }
                    }
                }

                if (request.body.privateMeta.registrationPaymentConfiguration?.stripeAccountId !== undefined) {
                    if (request.body.privateMeta.registrationPaymentConfiguration.stripeAccountId !== null) {
                        const account = await StripeAccount.getByID(request.body.privateMeta.registrationPaymentConfiguration.stripeAccountId)
                        if (!account || account.organizationId !== organization.id) {
                            throw new SimpleError({
                                code: "invalid_field",
                                message: "Het Stripe account dat je hebt gekozen bestaat niet (meer)",
                                field: "registrationPaymentConfiguration.stripeAccountId"
                            })
                        }
                    }
                    organization.privateMeta.registrationPaymentConfiguration.stripeAccountId = request.body.privateMeta.registrationPaymentConfiguration.stripeAccountId
                }
            }

            // Allow admin patches (permissions only atm). No put atm
            if (request.body.admins) {
                for (const patch of request.body.admins.getPatches()) {
                    if (patch.permissions) {
                        const admin = await User.getByID(patch.id)
                        if (!admin || !Context.auth.canAccessUser(admin, PermissionLevel.Full)) {
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

                        if (admin.id === user.id && !admin.permissions.hasFullAccess(Context.auth.getAllRoles())) {
                            throw new SimpleError({
                                code: "permission_denied",
                                message: "Je kan jezelf niet verwijderen als hoofdbeheerder"
                            })
                        }
                        await admin.save()
                    }
                }
            }

            if (request.body.meta) {
                const savedPackages = organization.meta.packages
                organization.meta.patchOrPut(request.body.meta)
                organization.meta.packages = savedPackages

                // check payconiq + mollie
                if (request.body.meta.registrationPaymentConfiguration) {
                    if (!organization.privateMeta.payconiqApiKey && !organization.privateMeta.buckarooSettings?.paymentMethods.includes(PaymentMethod.Payconiq)) {
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
                        let stripe: StripeAccount | undefined = undefined
                        if (organization.privateMeta.registrationPaymentConfiguration.stripeAccountId) {
                            stripe = await StripeAccount.getByID(organization.privateMeta.registrationPaymentConfiguration.stripeAccountId)
                        }

                        const i = organization.meta.paymentMethods.findIndex(p => {
                            if (p === PaymentMethod.Payconiq) return
                            if (p === PaymentMethod.Transfer) return
                            if (p === PaymentMethod.PointOfSale) return

                            if (!organization.privateMeta.buckarooSettings?.paymentMethods.includes(p)) {
                                if (!stripe?.meta.paymentMethods.includes(p)) {
                                    return true
                                }
                            }
                        })
                        if (i != -1) {
                            throw new SimpleError({
                                code: "invalid_field",
                                message: "Je kan "+PaymentMethodHelper.getName(organization.meta.paymentMethods[i])+" niet activeren omdat je daarvoor nog niet aangesloten bent bij een betaalpartner. Schakel "+PaymentMethodHelper.getName(organization.meta.paymentMethods[i])+" uit voor je verder gaat.",
                                field: "paymentMethods"
                            })
                        }
                    }
                }

                if (request.body.meta.categories) {
                    deleteUnreachable = true
                }

                if (request.body.meta.companyName || request.body.meta.companyNumber || request.body.meta.VATNumber || request.body.meta.companyAddress) {
                    // Validate VAT info
                    const company = Company.create({
                        name: organization.meta.companyName || '',
                        VATNumber: organization.meta.VATNumber,
                        companyNumber: organization.meta.companyNumber,
                        address: organization.meta.companyAddress,
                    })

                    await ViesHelper.checkCompany(company, company);

                    // Auto correct
                    organization.meta.VATNumber = company.VATNumber
                    organization.meta.companyNumber = company.companyNumber
                    organization.meta.companyName = company.name
                    organization.meta.companyAddress = company.address

                    if ((company.name || company.companyNumber || company.VATNumber) && (company.name.length < 3 || company.name.toLowerCase() === 'vzw')) {
                        throw new SimpleError({
                            code: "invalid_company_name",
                            message: "Company name is too short",
                            human: "De bedrijfsnaam is te kort of ongeldig. Vul een geldige bedrijfsnaam in.",
                            field: "companyName"
                        })
                    }
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

                        if (!Context.auth.canCreateGroupInCategory(category)) {
                            throw Context.auth.error('Je hebt geen toegangsrechten om groepen toe te voegen in deze categorie')
                        }
                            
                        // Only process puts
                        const ids = patch.groupIds.getPuts().map(p => p.put)
                        allowedIds.push(...ids)
                        category.groupIds.push(...ids)
                    }

                    if (allowedIds.length > 0) {
                        deleteUnreachable = true
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
            for (const id of deleteGroups) {
                const model = await Group.getByID(id)
                if (!model || !Context.auth.canAccessGroup(model, PermissionLevel.Full)) {
                    errors.addError(
                        Context.auth.error('Je hebt geen toegangsrechten om deze groep te verwijderen')
                    )
                    continue;
                }

                model.deletedAt = new Date()
                await model.save()
                deleteUnreachable = true
            }
        }

        for (const groupPut of request.body.groups.getPuts()) {
            if (!Context.auth.hasFullAccess() && !allowedIds.includes(groupPut.put.id)) {
                errors.addError(
                    Context.auth.error('Je hebt geen toegangsrechten om groepen toe te voegen')
                )
                continue;
            }

            const struct = groupPut.put
            const model = new Group()
            model.id = struct.id
            model.organizationId = organization.id
            model.settings = struct.settings
            model.privateSettings = struct.privateSettings ?? GroupPrivateSettings.create({})
            model.status = struct.status

            // Check if current user has permissions to this new group -> else fail with error
            if (!Context.auth.canAccessGroup(model, PermissionLevel.Full)) {
                errors.addError(
                    new SimpleError({
                        code: "missing_permissions",
                        message: "You cannot restrict your own permissions",
                        human: "Je kan geen inschrijvingsgroep maken zonder dat je zelf volledige toegang hebt tot de nieuwe groep (stel dit in via het tabblad toegang)"
                    })
                )
                continue;
            }

            await model.updateOccupancy()
            await model.save();
        }

        for (const struct of request.body.groups.getPatches()) {
            const model = await Group.getByID(struct.id)

            if (!model || !Context.auth.canAccessGroup(model, PermissionLevel.Full)) {
                errors.addError(
                    Context.auth.error('Je hebt geen toegangsrechten om deze groep te wijzigen')
                )
                continue;
            }

            if (struct.settings) {
                model.settings.patchOrPut(struct.settings)
            }

            if (struct.status) {
                model.status = struct.status
            }
            
            if (struct.privateSettings) {
                model.privateSettings.patchOrPut(struct.privateSettings)

                if (!Context.auth.canAccessGroup(model, PermissionLevel.Full)) {
                    errors.addError(
                        new SimpleError({
                            code: "missing_permissions",
                            message: "You cannot restrict your own permissions",
                            human: "Je kan je eigen volledige toegang tot deze inschrijvingsgroep niet verwijderen. Vraag aan een hoofdbeheerder om jouw toegang te verwijderen."
                        })
                    )
                    continue;
                }
            }

            if (struct.cycle !== undefined) {
                model.cycle = struct.cycle
            }

            if (struct.deletedAt !== undefined) {
                model.deletedAt = struct.deletedAt
            }
            
            await model.updateOccupancy()
            await model.save();
        }

        // Only needed for permissions atm, so no put or delete here
        for (const struct of request.body.webshops.getPatches()) {
            const model = await Webshop.getByID(struct.id)

            if (!model || !Context.auth.canAccessWebshop(model, PermissionLevel.Full)) {
                errors.addError(
                    Context.auth.error('Je hebt geen toegangsrechten om deze webshop te wijzigen')
                )
                continue;
            }

            if (struct.meta) {
                model.meta.patchOrPut(struct.meta)
            }
            
            if (struct.privateMeta) {
                model.privateMeta.patchOrPut(struct.privateMeta)
            }
            
            await model.save();
        }

        if (deleteUnreachable) {
            // Delete unreachable categories first
            const allGroups = await Group.getAll(organization.id);
            await organization.cleanCategories(allGroups);
            await Group.deleteUnreachable(organization.id, organization.meta, allGroups)
        }

        errors.throwIfNotEmpty()
        return new Response(await AuthenticatedStructures.organization(organization));
    }
}

