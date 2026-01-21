import { AutoEncoderPatchType, cloneObject, Decoder, isPatchableArray, isPatchMap, ObjectData, PatchableArray, PatchableArrayAutoEncoder, PatchMap, patchObject } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Organization, OrganizationRegistrationPeriod, PayconiqPayment, Platform, RegistrationPeriod, StripeAccount, Webshop } from '@stamhoofd/models';
import { BuckarooSettings, Company, MemberResponsibility, OrganizationMetaData, Organization as OrganizationStruct, PayconiqAccount, PaymentMethod, PaymentMethodHelper, PermissionLevel, PermissionRoleDetailed, PermissionRoleForResponsibility, PermissionsResourceType, ResourcePermissions, UitpasClientCredentialsStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures.js';
import { BuckarooHelper } from '../../../../helpers/BuckarooHelper.js';
import { Context } from '../../../../helpers/Context.js';
import { MemberUserSyncer } from '../../../../helpers/MemberUserSyncer.js';
import { SetupStepUpdater } from '../../../../helpers/SetupStepUpdater.js';
import { TagHelper } from '../../../../helpers/TagHelper.js';
import { ViesHelper } from '../../../../helpers/ViesHelper.js';
import { UitpasService } from '../../../../services/uitpas/UitpasService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = AutoEncoderPatchType<OrganizationStruct>;
type ResponseBody = OrganizationStruct;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class PatchOrganizationEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = OrganizationStruct.patchType() as Decoder<AutoEncoderPatchType<OrganizationStruct>>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization', {});

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

        if (!organization.active && !Context.auth.hasPlatformFullAccess()) {
            throw new SimpleError({
                code: 'permission_denied',
                message: 'You do not have permissions to edit an inactive organization',
                human: $t(`b33ba9f0-c12d-4918-ac9d-7aeec5de41a5`),
                statusCode: 403,
            });
        }

        // check if organization ID matches
        if (request.body.id !== organization.id) {
            throw new SimpleError({
                code: 'invalid_id',
                message: 'You cannot modify an organization with a different ID than the organization you are signed in for',
                statusCode: 403,
            });
        }

        const errors = new SimpleErrors();
        let shouldUpdateSetupSteps = false;
        let shouldUpdateUserPermissions = false;
        let updateTags = false;

        if (await Context.auth.hasFullAccess(organization.id)) {
            organization.name = request.body.name ?? organization.name;
            if (request.body.website !== undefined) {
                organization.website = request.body.website;
            }

            if (request.body.address) {
                organization.address = organization.address.patch(request.body.address);
            }

            if (request.body.uri && request.body.uri !== organization.uri) {
                const slugified = Formatter.slug(request.body.uri);
                if (slugified.length > 100) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Field is too long',
                        human: $t(`864675a2-7376-4a61-9c7d-f488e7906d7b`),
                        field: 'uri',
                    });
                }

                if (slugified.length < 3) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Field is too short',
                        human: $t(`0fa660da-1e74-4940-af88-eafafb1094b6`),
                        field: 'uri',
                    });
                }
                const alreadyExists = await Organization.getByURI(slugified);

                if (alreadyExists) {
                    throw new SimpleError({
                        code: 'name_taken',
                        message: 'An organization with the same URI already exists',
                        human: $t(`daa7dc61-e8c9-4629-97b6-a75f39eaebac`),
                        field: 'uri',
                    });
                }

                organization.uri = slugified;
            }

            if (request.body.privateMeta && request.body.privateMeta.isPatch()) {
                organization.privateMeta.emails = request.body.privateMeta.emails.applyTo(organization.privateMeta.emails);
                if (request.body.privateMeta.emails) {
                    shouldUpdateSetupSteps = true;
                }

                organization.privateMeta.premises = patchObject(organization.privateMeta.premises, request.body.privateMeta.premises);
                if (request.body.privateMeta.premises) {
                    shouldUpdateSetupSteps = true;
                }
                organization.privateMeta.roles = request.body.privateMeta.roles.applyTo(organization.privateMeta.roles);
                organization.privateMeta.responsibilities = request.body.privateMeta.responsibilities.applyTo(organization.privateMeta.responsibilities);
                organization.privateMeta.inheritedResponsibilityRoles = request.body.privateMeta.inheritedResponsibilityRoles.applyTo(organization.privateMeta.inheritedResponsibilityRoles);
                organization.privateMeta.privateKey = request.body.privateMeta.privateKey ?? organization.privateMeta.privateKey;
                organization.privateMeta.featureFlags = patchObject(organization.privateMeta.featureFlags, request.body.privateMeta.featureFlags);
                organization.privateMeta.balanceNotificationSettings = patchObject(organization.privateMeta.balanceNotificationSettings, request.body.privateMeta.balanceNotificationSettings);
                organization.privateMeta.recordAnswers = request.body.privateMeta.recordAnswers.applyTo(organization.privateMeta.recordAnswers);

                if (request.body.privateMeta.responsibilities || request.body.privateMeta.roles) {
                    shouldUpdateUserPermissions = true;
                }

                if (request.body.privateMeta.mollieProfile !== undefined) {
                    organization.privateMeta.mollieProfile = patchObject(organization.privateMeta.mollieProfile, request.body.privateMeta.mollieProfile);
                }

                if (request.body.privateMeta.useTestPayments !== undefined) {
                    organization.privateMeta.useTestPayments = request.body.privateMeta.useTestPayments;
                }

                // Apply payconiq patch
                if (request.body.privateMeta.payconiqAccounts !== undefined) {
                    const originalAccounts = organization.privateMeta.payconiqAccounts;

                    // Ignore patches of payconiq accounts which contain a placeholder key
                    organization.privateMeta.payconiqAccounts = patchObject(organization.privateMeta.payconiqAccounts, cloneObject(request.body.privateMeta.payconiqAccounts as any));

                    for (const account of organization.privateMeta.payconiqAccounts) {
                        if (account.apiKey === PayconiqAccount.placeholderApiKey) {
                            // Reset back to original
                            organization.privateMeta.payconiqAccounts = originalAccounts;
                            break;
                        }

                        if (account.merchantId === null) {
                            const payment = await PayconiqPayment.createTest(organization, account);

                            if (!payment) {
                                throw new SimpleError({
                                    code: 'invalid_field',
                                    message: 'De API-key voor Payconiq is niet geldig. Kijk eens na of je wel de juiste key hebt ingevuld.',
                                    field: 'payconiqAccounts',
                                });
                            }

                            // Save merchant id
                            const decoded = PayconiqAccount.decode(
                                new ObjectData({
                                    ...(payment as any).creditor,
                                    id: account.id,
                                    apiKey: account.apiKey,
                                }, { version: 0 }),
                            );

                            account.merchantId = decoded.merchantId;
                            account.callbackUrl = decoded.callbackUrl;
                            account.profileId = decoded.profileId;
                            account.name = decoded.name;
                            account.iban = decoded.iban;
                        }
                    }
                }

                if (request.body.privateMeta.buckarooSettings !== undefined) {
                    if (request.body.privateMeta.buckarooSettings === null) {
                        organization.privateMeta.buckarooSettings = null;
                    }
                    else {
                        organization.privateMeta.buckarooSettings = organization.privateMeta.buckarooSettings ?? BuckarooSettings.create({});
                        organization.privateMeta.buckarooSettings.patchOrPut(request.body.privateMeta.buckarooSettings);

                        // Validate buckaroo settings
                        const buckaroo = new BuckarooHelper(organization.privateMeta.buckarooSettings.key, organization.privateMeta.buckarooSettings.secret, organization.privateMeta.useTestPayments ?? STAMHOOFD.environment !== 'production');

                        if (!(await buckaroo.createTest())) {
                            throw new SimpleError({
                                code: 'invalid_field',
                                message: 'De key of secret voor Buckaroo is niet geldig. Kijk eens na of je wel de juiste key hebt ingevuld.',
                                field: 'buckarooSettings',
                            });
                        }
                    }
                }

                if (request.body.privateMeta.registrationPaymentConfiguration?.stripeAccountId !== undefined) {
                    if (request.body.privateMeta.registrationPaymentConfiguration.stripeAccountId !== null) {
                        const account = await StripeAccount.getByID(request.body.privateMeta.registrationPaymentConfiguration.stripeAccountId);
                        if (!account || account.organizationId !== organization.id) {
                            throw new SimpleError({
                                code: 'invalid_field',
                                message: 'Het Stripe account dat je hebt gekozen bestaat niet (meer)',
                                field: 'registrationPaymentConfiguration.stripeAccountId',
                            });
                        }
                    }
                    organization.privateMeta.registrationPaymentConfiguration.stripeAccountId = request.body.privateMeta.registrationPaymentConfiguration.stripeAccountId;
                }
            }

            // Allow admin patches (permissions only atm). No put atm
            if (request.body.admins) {
                throw new Error('Temporary removed to keep code cleaner. Please use different endpoints.');
            }

            if (request.body.meta) {
                if (request.body.meta.companies) {
                    await this.validateCompanies(organization, request.body.meta.companies);
                    shouldUpdateSetupSteps = true;
                }
                const savedPackages = organization.meta.packages;
                organization.meta.patchOrPut(request.body.meta);
                organization.meta.packages = savedPackages;

                // check payconiq + mollie
                if (request.body.meta.registrationPaymentConfiguration) {
                    if (!organization.privateMeta.payconiqApiKey && !organization.privateMeta.buckarooSettings?.paymentMethods.includes(PaymentMethod.Payconiq)) {
                        const i = organization.meta.paymentMethods.findIndex(p => p == PaymentMethod.Payconiq);
                        if (i !== -1) {
                            throw new SimpleError({
                                code: 'invalid_field',
                                message: 'Je kan Payconiq niet activeren omdat je geen Payconiq API Key hebt ingesteld. Schakel Payconiq uit voor je verder gaat.',
                                field: 'paymentMethods',
                            });
                        }
                    }

                    // check payconiq + mollie
                    if (!organization.privateMeta.mollieOnboarding || !organization.privateMeta.mollieOnboarding.canReceivePayments) {
                        let stripe: StripeAccount | undefined = undefined;
                        if (organization.privateMeta.registrationPaymentConfiguration.stripeAccountId) {
                            stripe = await StripeAccount.getByID(organization.privateMeta.registrationPaymentConfiguration.stripeAccountId);
                        }

                        const i = organization.meta.paymentMethods.findIndex((p) => {
                            if (p === PaymentMethod.Payconiq) return;
                            if (p === PaymentMethod.Transfer) return;
                            if (p === PaymentMethod.PointOfSale) return;

                            if (!organization.privateMeta.buckarooSettings?.paymentMethods.includes(p)) {
                                if (!stripe?.meta.paymentMethods.includes(p)) {
                                    return true;
                                }
                            }
                        });
                        if (i !== -1) {
                            throw new SimpleError({
                                code: 'invalid_field',
                                message: 'Je kan ' + PaymentMethodHelper.getName(organization.meta.paymentMethods[i]) + ' niet activeren omdat je daarvoor nog niet aangesloten bent bij een betaalpartner. Schakel ' + PaymentMethodHelper.getName(organization.meta.paymentMethods[i]) + ' uit voor je verder gaat.',
                                field: 'paymentMethods',
                            });
                        }
                    }
                }

                if (request.body.meta?.tags && (Array.isArray(request.body.meta?.tags) || request.body.meta?.tags.changes.length > 0)) {
                    if (!Context.auth.hasPlatformFullAccess()) {
                        throw Context.auth.error();
                    }

                    const cleanedPatch = OrganizationMetaData.patch({
                        tags: request.body.meta.tags as any,
                    });

                    const platform = await Platform.getShared();
                    const patchedMeta: OrganizationMetaData = organization.meta.patch(cleanedPatch);
                    for (const tag of patchedMeta.tags) {
                        if (!platform.config.tags.find(t => t.id === tag)) {
                            throw new SimpleError({ code: 'invalid_tag', message: 'Invalid tag', statusCode: 400 });
                        }
                    }

                    organization.meta.tags = TagHelper.getAllTagsFromHierarchy(patchedMeta.tags, platform.config.tags);

                    updateTags = true;
                }

                if (request.body.meta.uitpasClientCredentialsStatus) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'You cannot set the uitpasClientCredentialsStatus manually',
                        human: $t('d8937ba8-6689-4c76-9841-d5a00c99074b'),
                    });
                }

                if (request.body.meta.uitpasOrganizerId) {
                    const oldStatus = organization.meta.uitpasClientCredentialsStatus;
                    // re-evaluate the status
                    if (oldStatus !== UitpasClientCredentialsStatus.NotConfigured) {
                        organization.meta.uitpasClientCredentialsStatus = UitpasClientCredentialsStatus.NotChecked;
                        organization.meta.uitpasOrganizerId = request.body.meta.uitpasOrganizerId;
                        const { status } = await UitpasService.checkPermissionsFor(organization.id, organization.meta.uitpasOrganizerId);
                        organization.meta.uitpasClientCredentialsStatus = status;
                    }

                    // human message is ignored here
                    // if (human) {
                    //     const e = new SimpleError({
                    //         code: 'uitpas-client-credentials-error',
                    //         message: 'set-uitpas-credentials-returned-human-message',
                    //         human: human,
                    //     })
                    //     errors.addError(e)
                    // }
                }
            }

            if (request.body.active !== undefined) {
                if (!Context.auth.hasPlatformFullAccess()) {
                    throw Context.auth.error($t(`e46f34cd-f166-421e-be97-28ccecdf9c73`));
                }
                organization.active = request.body.active;
            }

            if (request.body.uri) {
                if (!Context.auth.hasPlatformFullAccess()) {
                    throw Context.auth.error();
                }

                const uriExists = await Organization.getByURI(request.body.uri);

                if (uriExists && uriExists.id !== organization.id) {
                    throw new SimpleError({
                        code: 'name_taken',
                        message: 'An organization with the same name already exists',
                        human: $t(`6e675a7d-b124-4507-bf0c-9b70013e98ca`),
                        field: 'name',
                    });
                }

                organization.uri = request.body.uri;
            }

            if (request.body.period) {
                const organizationPeriod = await OrganizationRegistrationPeriod.getByID(request.body.period.id);
                if (!organizationPeriod || organizationPeriod.organizationId !== organization.id) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'The period you want to set does not exist (anymore)',
                        human: $t('a3795bf6-ed50-4aa6-9caf-33820292c159'),
                        field: 'period',
                    });
                }

                if (organizationPeriod.periodId !== organization.periodId) {
                    const period = await RegistrationPeriod.getByID(organizationPeriod.periodId);
                    if (!period || (period.organizationId && period.organizationId !== organization.id)) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'The period you want to set does not exist (anymore)',
                            human: $t('a3795bf6-ed50-4aa6-9caf-33820292c159'),
                            field: 'period',
                        });
                    }

                    if (STAMHOOFD.userMode === 'organization' && period.organizationId === null) {
                    // period should always have organization id if userMode is organization
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'The period has no organization id',
                            human: $t('d004e93c-e67f-48ab-bf3d-7b4ad86c7a38'),
                            field: 'period',
                        });
                    }

                    if (period.locked) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'The period you want to set is already closed',
                            human: $t('b6bc2fef-71ac-43a1-b430-50945427a9e3'),
                            field: 'period',
                        });
                    }

                    const maximumStart = 1000 * 60 * 60 * 24 * 31 * 2; // 2 months in advance
                    if (period.startDate > new Date(Date.now() + maximumStart) && STAMHOOFD.environment !== 'development') {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: 'The period you want to set has not started yet',
                            human: $t('e0fff936-3f3c-46b8-adcf-c723c33907a2'),
                            field: 'period',
                        });
                    }

                    organization.periodId = period.id;
                    shouldUpdateSetupSteps = true;
                }
            }

            // Save the organization
            await organization.save();
        }
        else {
            if (request.body.name || request.body.address || request.body.website || request.body.meta?.companies || request.body.meta?.recordsConfiguration || request.body.meta?.registrationPaymentConfiguration) {
                throw new SimpleError({
                    code: 'permission_denied',
                    message: 'You do not have permissions to edit the organization settings',
                    statusCode: 403,
                });
            }

            // Give users without full access permission to alter responsibilities in order to give other users permissions to resources they also have full permissions to
            if (request.body.privateMeta && request.body.privateMeta.isPatch()) {
                if (request.body.privateMeta.inheritedResponsibilityRoles) {
                    const patchableArray: PatchableArrayAutoEncoder<PermissionRoleForResponsibility> = new PatchableArray();

                    for (const patch of request.body.privateMeta.inheritedResponsibilityRoles.getPatches()) {
                        const resources: Map<PermissionsResourceType, Map<string, ResourcePermissions>> = patch.resources.applyTo(new Map<PermissionsResourceType, Map<string, ResourcePermissions>>());

                        if (!await Context.auth.hasFullAccessForOrganizationResources(request.body.id, resources)) {
                            throw new SimpleError({
                                code: 'permission_denied',
                                message: 'You do not have permissions to edit inherited responsibility roles',
                                statusCode: 403,
                            });
                        }

                        patchableArray.addPatch(PermissionRoleForResponsibility.patch({
                            id: patch.id,
                            resources: patch.resources,
                        }));
                    }

                    for (const { put, afterId } of request.body.privateMeta.inheritedResponsibilityRoles.getPuts()) {
                        const resources: Map<PermissionsResourceType, Map<string, ResourcePermissions>> = put.resources;

                        if (!await Context.auth.hasFullAccessForOrganizationResources(request.body.id, resources)) {
                            throw new SimpleError({
                                code: 'permission_denied',
                                message: 'You do not have permissions to add inherited responsibility roles',
                                statusCode: 403,
                            });
                        }

                        const limitedPut = PermissionRoleForResponsibility.create({
                            id: put.id,
                            name: put.name,
                            responsibilityId: put.responsibilityId,
                            responsibilityGroupId: put.responsibilityGroupId,
                            resources: put.resources,
                        });

                        patchableArray.addPut(limitedPut, afterId);
                    }

                    organization.privateMeta = organization.privateMeta.patch({
                        inheritedResponsibilityRoles: patchableArray,
                    });
                }

                if (request.body.privateMeta.responsibilities) {
                    const patchableArray: PatchableArrayAutoEncoder<MemberResponsibility> = new PatchableArray();

                    for (const patch of request.body.privateMeta.responsibilities.getPatches()) {
                        if (!patch.permissions) {
                            continue;
                        };

                        const resources: Map<PermissionsResourceType, Map<string, ResourcePermissions>> = isPatchMap(patch.permissions.resources) ? patch.permissions.resources.applyTo(new Map<PermissionsResourceType, Map<string, ResourcePermissions>>()) : patch.permissions.resources;

                        if (!await Context.auth.hasFullAccessForOrganizationResources(request.body.id, resources)) {
                            throw new SimpleError({
                                code: 'permission_denied',
                                message: 'You do not have permissions to edit responsibilities',
                                statusCode: 403,
                            });
                        }

                        patchableArray.addPatch(MemberResponsibility.patch({
                            id: patch.id,
                            permissions: PermissionRoleForResponsibility.patch({
                                resources: isPatchMap(patch.permissions.resources) ? patch.permissions.resources : new PatchMap(patch.permissions.resources),
                            }),
                        }));
                    }

                    if (request.body.privateMeta.responsibilities.getPuts().length > 0) {
                        throw new SimpleError({
                            code: 'permission_denied',
                            message: 'You do not have permissions to add responsibilities',
                            statusCode: 403,
                        });
                    }

                    organization.privateMeta = organization.privateMeta.patch({
                        responsibilities: patchableArray,
                    });
                }

                if (request.body.privateMeta.roles) {
                    const patchableArray: PatchableArrayAutoEncoder<PermissionRoleDetailed> = new PatchableArray();

                    for (const patch of request.body.privateMeta.roles.getPatches()) {
                        const resources: Map<PermissionsResourceType, Map<string, ResourcePermissions>> = patch.resources.applyTo(new Map<PermissionsResourceType, Map<string, ResourcePermissions>>());

                        if (!await Context.auth.hasFullAccessForOrganizationResources(request.body.id, resources)) {
                            throw new SimpleError({
                                code: 'permission_denied',
                                message: 'You do not have permissions to edit roles',
                                statusCode: 403,
                            });
                        }

                        patchableArray.addPatch(PermissionRoleDetailed.patch({
                            id: patch.id,
                            resources: patch.resources,
                        }));
                    }

                    if (request.body.privateMeta.roles.getPuts().length > 0) {
                        throw new SimpleError({
                            code: 'permission_denied',
                            message: 'You do not have permissions to add roles',
                            statusCode: 403,
                        });
                    }

                    organization.privateMeta = organization.privateMeta.patch({
                        roles: patchableArray,
                    });
                }

                await organization.save();
            }
        }

        // Only needed for permissions atm, so no put or delete here
        for (const struct of request.body.webshops.getPatches()) {
            const model = await Webshop.getByID(struct.id);

            if (!model || !await Context.auth.canAccessWebshop(model, PermissionLevel.Full)) {
                errors.addError(
                    Context.auth.error($t(`5e92a9b3-a94d-41db-9d0e-c58122400725`)),
                );
                continue;
            }

            if (struct.meta) {
                model.meta.patchOrPut(struct.meta);
            }

            if (struct.privateMeta) {
                model.privateMeta.patchOrPut(struct.privateMeta);
            }

            await model.save();
        }

        errors.throwIfNotEmpty();

        if (shouldUpdateSetupSteps) {
            await SetupStepUpdater.updateForOrganization(organization);
        }

        if (shouldUpdateUserPermissions) {
            await MemberUserSyncer.updatePermissionsForOrganization(organization.id);
        }

        if (updateTags) {
            await TagHelper.updateOrganizations();
        }
        const struct = await AuthenticatedStructures.organization(organization);
        return new Response(struct);
    }

    async validateCompanies(organization: Organization, companies: PatchableArrayAutoEncoder<Company>) {
        if (isPatchableArray(companies)) {
            for (const patch of companies.getPatches()) {
                // Changed VAT number
                const original = organization.meta.companies.find(c => c.id === patch.id);

                if (!original) {
                    throw new Error('Could not find company');
                }

                // Changed VAT number
                const prepatched = original.patch(patch);
                await ViesHelper.checkCompany(prepatched, patch);
            }

            let c = 0;
            for (const { put } of companies.getPuts()) {
                c++;

                if ((organization.meta.companies.length + c) > 5) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Too many companies',
                        human: $t(`35d462bc-121e-46ad-824b-a7838a6665ae`),
                        field: 'companies',
                    });
                }

                await ViesHelper.checkCompany(put, put);
            }
        }
        else {
            if (companies.length > 5) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Too many companies',
                    human: $t(`35d462bc-121e-46ad-824b-a7838a6665ae`),
                    field: 'companies',
                });
            }

            for (const company of companies) {
                await ViesHelper.checkCompany(company, company);
            }
        }
    }
}
