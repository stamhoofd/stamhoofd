import { Request } from "@stamhoofd/backend/src/routing/classes/Request";
import { DecodedRequest } from "@stamhoofd/backend/src/routing/classes/DecodedRequest";
import { Response } from "@stamhoofd/backend/src/routing/classes/Response";
import { Endpoint } from "@stamhoofd/backend/src/routing/classes/Endpoint";
import { ServerError } from "@stamhoofd/backend/src/routing/classes/ServerError";
import { Organization } from "@stamhoofd/backend/src/organizations/models/Organization";
import { CreateOrganizationStruct } from "../structs/CreateOrganizationStruct";
import { ClientError } from "@stamhoofd/backend/src/routing/classes/ClientError";
import Sodium from "@stamhoofd/backend/src/tools/classes/Sodium";
import { Formatter } from "@stamhoofd-common/formatting"; 
import { OrganizationMetaStruct, OrganizationType } from "../structs/OrganizationMetaStruct";
import { User } from "@stamhoofd/backend/src/users/models/User";

type Params = {};
type Query = undefined;
type Body = CreateOrganizationStruct;
type ResponseBody = undefined;

export class CreateOrganizationEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected bodyDecoder = CreateOrganizationStruct;

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
        // Validate admin signature
        if (!request.body.user.adminSignature) {
            throw new ClientError({
                code: "required_signature",
                message:
                    "When creating an organization, you should sign your first user with the organization's secret",
            });
        }

        const adminSignature = Buffer.from(request.body.user.adminSignature, "base64");
        const organizationPublicKey = Buffer.from(request.body.publicKey, "base64");

        if (!(await Sodium.verifySignature(adminSignature, request.body.user.publicKey, organizationPublicKey))) {
            throw new ClientError({
                code: "invalid_signature",
                message: "Invalid adminSignature of user",
                field: "user.adminSignature",
            });
        }

        const uri = Formatter.slug(request.body.name);
        const alreadyExists = await Organization.getByURI(uri);

        if (alreadyExists) {
            throw new ClientError({
                code: "name_taken",
                message: "An organization with the same name already exists",
                field: "name",
            });
        }

        // First create the organization
        // todo: add some duplicate validation
        const organization = new Organization();
        organization.name = request.body.name;
        organization.publicKey = request.body.publicKey;
        organization.uri = uri;
        organization.meta = new OrganizationMetaStruct();
        organization.meta.type = OrganizationType.Other;

        try {
            await organization.save();
        } catch (e) {
            console.error(e);
            throw new ServerError({
                code: "creating_organization",
                message: "Something went wrong while creating the organization. Please try again later or contact us.",
            });
        }

        const user = await User.register(
            organization,
            request.body.user.email,
            request.body.user.password,
            request.body.user.publicKey
        );
        if (!user) {
            // This user already exists, well that is pretty impossible
            throw new ServerError({
                code: "creating_user",
                message: "Something went wrong while creating the user. Please contact us to resolve this issue.",
            });
        }

        // An email has been send to confirm your email address
        return new Response(undefined);
    }
}
