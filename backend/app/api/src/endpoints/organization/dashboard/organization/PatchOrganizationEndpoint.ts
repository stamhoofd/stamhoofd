import { AutoEncoderPatchType, Decoder, ObjectData, patchObject } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Organization, OrganizationRegistrationPeriod, PayconiqPayment, Platform, RegistrationPeriod, StripeAccount, Webshop } from '@stamhoofd/models';
import { BuckarooSettings, OrganizationMetaData, OrganizationPatch, Organization as OrganizationStruct, PayconiqAccount, PaymentMethod, PaymentMethodHelper, PermissionLevel } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';

import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures';
import { BuckarooHelper } from '../../../../helpers/BuckarooHelper';
import { Context } from '../../../../helpers/Context';

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

        if (!await Context.auth.hasSomeAccess(organization.id)) {
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

        const errors = new SimpleErrors()

        if (await Context.auth.hasFullAccess(organization.id)) {
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
                organization.privateMeta.premises = patchObject(organization.privateMeta.premises, request.body.privateMeta.premises);
                organization.privateMeta.roles = request.body.privateMeta.roles.applyTo(organization.privateMeta.roles)
                organization.privateMeta.responsibilities = request.body.privateMeta.responsibilities.applyTo(organization.privateMeta.responsibilities)
                organization.privateMeta.inheritedResponsibilityRoles = request.body.privateMeta.inheritedResponsibilityRoles.applyTo(organization.privateMeta.inheritedResponsibilityRoles)
                organization.privateMeta.privateKey = request.body.privateMeta.privateKey ?? organization.privateMeta.privateKey
                organization.privateMeta.featureFlags = patchObject(organization.privateMeta.featureFlags, request.body.privateMeta.featureFlags);

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
                throw new Error("Temporary removed to keep code cleaner. Please use different endpoints.")
                // for (const patch of request.body.admins.getPatches()) {
                //     if (patch.permissions) {
                //         const admin = await User.getByID(patch.id)
                //         if (!admin || !await Context.auth.canAccessUser(admin, PermissionLevel.Full)) {
                //             throw new SimpleError({
                //                 code: "invalid_field",
                //                 message: "De beheerder die je wilt wijzigen bestaat niet (meer)",
                //                 field: "admins"
                //             })
                //         }
                //         admin.permissions = UserPermissions.limitedPatch(admin.permissions, patch.permissions, organization.id)
                //         if (admin.id === user.id && (!admin.permissions || !admin.permissions.forOrganization(organization)?.hasFullAccess())) {
                //             throw new SimpleError({
                //                 code: "permission_denied",
                //                 message: "Je kan jezelf niet verwijderen als hoofdbeheerder"
                //             })
                //         }
                //         await admin.save()
                //     }
                // }
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

                if (request.body.meta?.tags) {
                    if (!Context.auth.hasPlatformFullAccess()) {
                        throw Context.auth.error()
                    }

                    const cleanedPatch = OrganizationMetaData.patch({
                        tags: request.body.meta.tags as any
                    })
                    const platform = await Platform.getShared()
                    const patchedMeta = organization.meta.patch(cleanedPatch);
                    for (const tag of patchedMeta.tags) {
                        if (!platform.config.tags.find(t => t.id === tag)) {
                            throw new SimpleError({ code: "invalid_tag", message: "Invalid tag", statusCode: 400 });
                        }
                    }
    
                    // Sort tags based on platform config order
                    patchedMeta.tags.sort((a, b) => {
                        const aIndex = platform.config.tags.findIndex(t => t.id === a);
                        const bIndex = platform.config.tags.findIndex(t => t.id === b);
                        return aIndex - bIndex;
                    })
    
                    organization.meta.tags = patchedMeta.tags;
                }
            }

            if (request.body.uri) {
                if (!Context.auth.hasPlatformFullAccess()) {
                    throw Context.auth.error()
                }
                
                const uriExists = await Organization.getByURI(request.body.uri);
    
                if (uriExists && uriExists.id !== organization.id) {
                    throw new SimpleError({
                        code: "name_taken",
                        message: "An organization with the same name already exists",
                        human: "Er bestaat al een vereniging met dezelfde URI. Pas deze aan zodat deze uniek is, en controleer of deze vereniging niet al bestaat.",
                        field: "name",
                    });
                }

                organization.uri = request.body.uri
            }

            if (request.body.period && request.body.period.id !== organization.periodId) {
                const organizationPeriod = await OrganizationRegistrationPeriod.getByID(request.body.period.id)
                if (!organizationPeriod || organizationPeriod.organizationId !== organization.id) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "De periode die je wilt instellen bestaat niet (meer)",
                        field: "period"
                    })
                }

                const period = await RegistrationPeriod.getByID(organizationPeriod.periodId)
                if (!period || (period.organizationId && period.organizationId !== organization.id)) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "De periode die je wilt instellen bestaat niet (meer)",
                        field: "period"
                    })
                }

                if (period.locked) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "De periode die je wilt instellen is reeds afgesloten",
                        field: "period"
                    })
                }

                organization.periodId = period.id
            }

            // Save the organization
            await organization.save()
        } else {
            if (request.body.name || request.body.address) {
                throw new SimpleError({
                    code: "permission_denied",
                    message: "You do not have permissions to edit the organization settings",
                    statusCode: 403
                })
            }
        }

        // Only needed for permissions atm, so no put or delete here
        for (const struct of request.body.webshops.getPatches()) {
            const model = await Webshop.getByID(struct.id)

            if (!model || !await Context.auth.canAccessWebshop(model, PermissionLevel.Full)) {
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

        errors.throwIfNotEmpty()
        return new Response(await AuthenticatedStructures.organization(organization));
    }
}

