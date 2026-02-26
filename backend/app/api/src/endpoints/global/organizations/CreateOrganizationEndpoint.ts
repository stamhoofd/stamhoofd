import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { EmailVerificationCode, Organization, OrganizationRegistrationPeriod, RegistrationPeriod, User } from '@stamhoofd/models';
import { CreateOrganization, PermissionLevel, Permissions, RegistrationPeriodSettings, SignupResponse, UserPermissions } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

type Params = Record<string, never>;
type Query = undefined;
type Body = CreateOrganization;
type ResponseBody = SignupResponse;

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
                human: $t(`a010c110-bf4e-4c12-a324-6b84c992e728`),
            });
        }

        if (request.body.organization.name.length < 4) {
            if (request.body.organization.name.length == 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Should not be empty',
                    human: $t(`3f37782a-c07f-457d-994f-f1cc075cff44`),
                    field: 'organization.name',
                });
            }

            throw new SimpleError({
                code: 'invalid_field',
                message: 'Field is too short',
                human: $t(`0e82abec-5467-45d8-ba89-9b9fd10c085d`),
                field: 'organization.name',
            });
        }

        const uri = Formatter.slug(request.body.organization.name);

        if (uri.length > 100) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Field is too long',
                human: $t(`c4d225ea-8e41-4829-bf0c-bc04755492de`),
                field: 'organization.name',
            });
        }
        const alreadyExists = await Organization.getByURI(uri);

        if (alreadyExists) {
            throw new SimpleError({
                code: 'name_taken',
                message: 'An organization with the same name already exists',
                human: $t(`19e5262f-9dc1-40d9-b905-bda8462b6046`),
                field: 'name',
            });
        }

        // First create the organization
        // TODO: add some duplicate validation
        const organization = new Organization();
        organization.id = request.body.organization.id;
        organization.name = request.body.organization.name;

        organization.uri = uri;
        organization.meta = request.body.organization.meta;
        organization.address = request.body.organization.address;
        organization.privateMeta.acquisitionTypes = request.body.organization.privateMeta?.acquisitionTypes ?? [];

        const period = new RegistrationPeriod();
        period.configureForNewOrganization();

        await period.save();
        organization.periodId = period.id;

        try {
            await organization.save();
        }
        catch (e) {
            console.error(e);
            throw new SimpleError({
                code: 'creating_organization',
                message: 'Something went wrong while creating the organization. Please try again later or contact us.',
                statusCode: 500,
            });
        }
        period.organizationId = organization.id;
        await period.save();

        const organizationPeriod = new OrganizationRegistrationPeriod();
        organizationPeriod.organizationId = organization.id;
        organizationPeriod.periodId = organization.periodId;
        await organizationPeriod.save();

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

        const code = await EmailVerificationCode.createFor(user, user.email);
        code.send(user, organization, request.i18n).catch(console.error);

        return new Response(SignupResponse.create({
            token: code.token,
        }));
    }
}
