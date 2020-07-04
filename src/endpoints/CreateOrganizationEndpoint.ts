import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, EndpointError, Request, Response } from "@simonbackx/simple-endpoints";
import { KeychainItemHelper } from '@stamhoofd/crypto';
import { CreateOrganization, Token as TokenStruct } from "@stamhoofd/structures"; 
import { Formatter } from "@stamhoofd/utility"; 

import { Organization } from "../models/Organization";
import { Token } from '../models/Token';
import { User } from "../models/User";

type Params = {};
type Query = undefined;
type Body = CreateOrganization;
type ResponseBody = TokenStruct;

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

        if (request.body.organization.name.length < 4) {
            if (request.body.organization.name.length == 0) {
                throw new EndpointError({
                    code: "invalid_field",
                    message: "Should not be empty",
                    human: "Je bent de naam van je organisatie vergeten in te vullen",
                    field: "organization.name"
                })
            }

            throw new EndpointError({
                code: "invalid_field",
                message: "Field is too short",
                human: "Kijk de naam van je organisatie na, deze is te kort",
                field: "organization.name"
            })
        }

        const uri = Formatter.slug(request.body.organization.name);
        const alreadyExists = await Organization.getByURI(uri);

        if (alreadyExists) {
            throw new EndpointError({
                code: "name_taken",
                message: "An organization with the same name already exists",
                human: "Er bestaat al een vereniging met dezelfde naam. Voeg bijvoorbeeld de naam van je gemeente toe.",
                field: "name",
            });
        }

        // Validate keychain
        if (request.body.keychainItems.length == 0) {
            throw new EndpointError({
                code: "missing_items",
                message: "You'll need to specify at least one keychain item to provide the user with access to the organization private key using his own keys",
                field: "keychainItems",
            });
        }

        for(const item of request.body.keychainItems) {
            console.warn(item)
            await KeychainItemHelper.validate(item)

            if (item.userId != request.body.user.id) {
                throw new EndpointError({
                    code: "invalid_field",
                    message: "You can only create keychain items for the created user",
                    field: "keychainItems",
                });
            }
        }

        // First create the organization
        // todo: add some duplicate validation
        const organization = new Organization();
        organization.name = request.body.organization.name;
        organization.publicKey = request.body.organization.publicKey;
        organization.uri = uri;
        organization.meta = request.body.organization.meta

        try {
            await organization.save();
        } catch (e) {
            console.error(e);
            throw new EndpointError({
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
            throw new EndpointError({
                code: "creating_user",
                message: "Something went wrong while creating the user. Please contact us to resolve this issue.",
                statusCode: 500
            });
        }

        // Create an expired access token, that you can only renew when the user has been verified, but this can keep the users signed in
        const token = await Token.createExpiredToken(user)

        // Send mail without waiting
        /*Email.send(user.email, "Verifieer jouw e-mailadres voor Stamhoofd", "Hey fa!\n\nWelkom bij Stamhoofd. Klik op de onderstaande link om jouw e-mailadres te bevestigen.\n\nStamhoofd").catch(e => {
            console.error(e)
        })*/

        // An email has been send to confirm your email address
        return new Response(new TokenStruct(token));
    }
}
