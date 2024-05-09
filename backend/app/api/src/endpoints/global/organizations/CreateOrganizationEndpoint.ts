import { Model } from '@simonbackx/simple-database';
import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { Email, EmailInterfaceBase } from '@stamhoofd/email';
import { EmailVerificationCode, Organization, RegisterCode, User } from '@stamhoofd/models';
import { CreateOrganization, PermissionLevel, Permissions, SignupResponse, UserPermissions } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

type Params = Record<string, never>;
type Query = undefined;
type Body = CreateOrganization;
type ResponseBody = SignupResponse;

export class CreateOrganizationEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = CreateOrganization as Decoder<CreateOrganization>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organizations", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        if (STAMHOOFD.userMode === 'platform') {
            throw new SimpleError({
                code: "invalid_field",
                message: "Not allowed",
                human: "Je kan geen vereniging aanmaken"
            })
        }

        if (request.body.organization.name.length < 4) {
            if (request.body.organization.name.length == 0) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Should not be empty",
                    human: "Je bent de naam van je organisatie vergeten in te vullen",
                    field: "organization.name"
                })
            }

            throw new SimpleError({
                code: "invalid_field",
                message: "Field is too short",
                human: "Kijk de naam van je organisatie na, deze is te kort. Vul eventueel aan met de gemeente.",
                field: "organization.name"
            })
        }

        const uri = Formatter.slug(request.body.organization.name);

        if (uri.length > 100) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Field is too long",
                human: "De naam van de vereniging is te lang. Probeer de naam wat te verkorten en probeer opnieuw.",
                field: "organization.name"
            })
        }
        const alreadyExists = await Organization.getByURI(uri);

        if (alreadyExists) {
            throw new SimpleError({
                code: "name_taken",
                message: "An organization with the same name already exists",
                human: "Er bestaat al een vereniging met dezelfde naam. Voeg bijvoorbeeld de naam van je gemeente toe.",
                field: "name",
            });
        }

        // First create the organization
        // TODO: add some duplicate validation
        const organization = new Organization();
        organization.id = request.body.organization.id;
        organization.name = request.body.organization.name;

        // Delay save until after organization is saved, but do validations before the organization is saved
        let registerCodeModels: Model[] = []
        let delayEmails: EmailInterfaceBase[] = []

        if (request.body.registerCode) {
            const applied = await RegisterCode.applyRegisterCode(organization, request.body.registerCode)
            registerCodeModels = applied.models
            delayEmails = applied.emails
        }

        organization.uri = uri;
        organization.meta = request.body.organization.meta
        organization.address = request.body.organization.address
        organization.privateMeta.acquisitionTypes = request.body.organization.privateMeta?.acquisitionTypes ?? []

        try {
            await organization.save();
        } catch (e) {
            console.error(e);
            throw new SimpleError({
                code: "creating_organization",
                message: "Something went wrong while creating the organization. Please try again later or contact us.",
                statusCode: 500
            });
        }

        const user = await User.register(
            organization,
            request.body.user
        );
        if (!user) {
            // This user already exists, well that is pretty impossible
            throw new SimpleError({
                code: "creating_user",
                message: "Something went wrong while creating the user. Please contact us to resolve this issue.",
                statusCode: 500
            });
        }

        // Should prevent this extra save
        user.permissions = UserPermissions.create({})
        user.permissions.organizationPermissions.set(organization.id, Permissions.create({ level: PermissionLevel.Full }))
        await user.save()

        for (const model of registerCodeModels) {
            await model.save()
        }

        const code = await EmailVerificationCode.createFor(user, user.email)
        code.send(user, organization, request.i18n)

        for (const email of delayEmails) {
            Email.sendInternal(email, organization.i18n)
        }

        return new Response(SignupResponse.create({
            token: code.token
        }));
    }

    
}
