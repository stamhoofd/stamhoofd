import { Organization } from "@stamhoofd-backend/app/src/organizations/models/Organization";
import { User } from "@stamhoofd-backend/app/src/users/models/User";
import { Email } from '@stamhoofd-backend/email';
import { Request } from "@stamhoofd-backend/routing";
import { DecodedRequest } from "@stamhoofd-backend/routing";
import { Response } from "@stamhoofd-backend/routing";
import { Endpoint } from "@stamhoofd-backend/routing";
import { Sodium } from "@stamhoofd-common/crypto";
import { STError } from '@stamhoofd-common/errors';
import { Formatter } from "@stamhoofd-common/formatting"; 

import { CreateOrganizationStruct } from "../structs/CreateOrganizationStruct";
import { OrganizationMetaStruct, OrganizationType } from "../structs/OrganizationMetaStruct";

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
            throw new STError({
                code: "required_signature",
                message:
                    "When creating an organization, you should sign your first user with the organization's secret",
            });
        }

        const adminSignature = Buffer.from(request.body.user.adminSignature, "base64");
        const organizationPublicKey = Buffer.from(request.body.publicKey, "base64");

        if (!(await Sodium.verifySignature(adminSignature, request.body.user.publicKey, organizationPublicKey))) {
            throw new STError({
                code: "invalid_signature",
                message: "Invalid adminSignature of user",
                field: "user.adminSignature",
            });
        }

        const uri = Formatter.slug(request.body.name);
        const alreadyExists = await Organization.getByURI(uri);

        if (alreadyExists) {
            throw new STError({
                code: "name_taken",
                message: "An organization with the same name already exists",
                human: "Er bestaat al een vereniging met dezelfde naam",
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
            throw new STError({
                code: "creating_organization",
                message: "Something went wrong while creating the organization. Please try again later or contact us.",
                statusCode: 500
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
            throw new STError({
                code: "creating_user",
                message: "Something went wrong while creating the user. Please contact us to resolve this issue.",
                statusCode: 500
            });
        }

        // Send mail without waiting
        Email.send(user.email, "Verifieer jouw e-mailadres voor Stamhoofd", "Hey fa!\n\nWelkom bij Stamhoofd. Klik op de onderstaande link om jouw e-mailadres te bevestigen.\n\nStamhoofd").catch(e => {
            console.error(e)
        })

        // An email has been send to confirm your email address
        return new Response(undefined);
    }
}
