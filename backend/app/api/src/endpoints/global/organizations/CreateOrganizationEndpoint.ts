import type { Model } from '@simonbackx/simple-database';
import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import type { EmailInterfaceBase } from '@stamhoofd/email';
import { Email } from '@stamhoofd/email';
import { AuditLog, EmailVerificationCode, Organization, OrganizationRegistrationPeriod, RegistrationPeriod, User } from '@stamhoofd/models';
import { CreateOrganizationResponse } from '@stamhoofd/structures';
import { AuditLogSource, AuditLogType, CreateOrganization, PermissionLevel, Permissions, SignupResponse, UserPermissions } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { AuditLogService } from '../../../services/AuditLogService.js';
import { ReferralService } from '../../../services/ReferralService.js';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = CreateOrganization;
type ResponseBody = CreateOrganizationResponse;

export class CreateOrganizationEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = CreateOrganization as Decoder<CreateOrganization>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organizations', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        if (STAMHOOFD.userMode === 'platform') {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Not allowed',
                human: $t(`%ED`),
            });
        }

        if (request.body.organization.name.length < 4) {
            if (request.body.organization.name.length == 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Should not be empty',
                    human: $t(`%Cz`),
                    field: 'organization.name',
                });
            }

            throw new SimpleError({
                code: 'invalid_field',
                message: 'Field is too short',
                human: $t(`%D0`),
                field: 'organization.name',
            });
        }

        const uri = Formatter.slug(request.body.organization.name);

        if (uri.length > 100) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Field is too long',
                human: $t(`%D1`),
                field: 'organization.name',
            });
        }
        const alreadyExists = await Organization.getByURI(uri);

        if (alreadyExists) {
            throw new SimpleError({
                code: 'name_taken',
                message: 'An organization with the same name already exists',
                human: $t(`%D3`),
                field: 'name',
            });
        }

        // First create the organization
        const organization = new Organization();
        organization.id = uuidv4();
        organization.name = request.body.organization.name;

        organization.uri = uri;
        organization.meta = request.body.organization.meta;
        organization.address = request.body.organization.address;
        organization.privateMeta.acquisitionTypes = request.body.organization.privateMeta?.acquisitionTypes ?? [];

        // Delay save until after organization is saved, but do validations before the organization is saved
        let registerCodeModels: Model[] = [];
        let delayEmails: EmailInterfaceBase[] = [];

        if (request.body.registerCode) {
            const applied = await ReferralService.markUsed(organization, request.body.registerCode);
            registerCodeModels = applied.models;
            delayEmails = applied.emails;
        }

        const period = await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
            const period = new RegistrationPeriod();
            period.configureForNewOrganization();

            await period.save();
            organization.periodId = period.id;
            return period;
        });

        try {
            await organization.save();
        } catch (e) {
            console.error(e);
            throw new SimpleError({
                code: 'creating_organization',
                message: 'Something went wrong while creating the organization. Please try again later or contact us.',
                statusCode: 500,
            });
        }

        await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
            period.organizationId = organization.id;
            await period.save();

            const organizationPeriod = new OrganizationRegistrationPeriod();
            organizationPeriod.organizationId = organization.id;
            organizationPeriod.periodId = organization.periodId;
            await organizationPeriod.save();
        });

        const user = await User.register(
            organization,
            request.body.user,
        );
        if (!user) {
            // This user already exists, well that is pretty impossible
            throw new SimpleError({
                code: 'creating_user',
                message: 'Something went wrong while creating the user. Please contact us to resolve this issue.',
                statusCode: 500,
            });
        }

        // Should prevent this extra save
        user.permissions = UserPermissions.create({});
        user.permissions.organizationPermissions.set(organization.id, Permissions.create({ level: PermissionLevel.Full }));
        await user.save();

        for (const model of registerCodeModels) {
            await model.save();
        }

        // Correctly assign creation
        await AuditLog.update().where('type', AuditLogType.OrganizationAdded).where('objectId', organization.id).set('userId', user.id).set('source', AuditLogSource.User).update();

        const code = await EmailVerificationCode.createFor(user, user.email);
        code.send(user, organization, request.i18n).catch(console.error);

        for (const email of delayEmails) {
            Email.send({
                from: Email.getQuickFromEmail(organization.address.country),
                ...email,
            });
        }

        // Prepare the response as if we were authenticated
        await Context.setManualOrganizationScope(organization);
        await Context.insecurelyAuthenticateAs(user);

        return new Response(CreateOrganizationResponse.create({
            token: code.token,
            organization: await AuthenticatedStructures.organization(organization),
        }));
    }
}
