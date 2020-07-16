import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { KeychainItemHelper } from '@stamhoofd/crypto';
import { CreateOrganization, Token as TokenStruct } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";

import { KeychainItem } from '../models/KeychainItem';
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
                human: "Kijk de naam van je organisatie na, deze is te kort",
                field: "organization.name"
            })
        }

        const uri = Formatter.slug(request.body.organization.name);
        const alreadyExists = await Organization.getByURI(uri);

        if (alreadyExists) {
            throw new SimpleError({
                code: "name_taken",
                message: "An organization with the same name already exists",
                human: "Er bestaat al een vereniging met dezelfde naam. Voeg bijvoorbeeld de naam van je gemeente toe.",
                field: "name",
            });
        }

        // Validate keychain
        if (request.body.keychainItems.length != 1) {
            throw new SimpleError({
                code: "missing_items",
                message: "You'll need to specify at exactly one keychain item to provide the user with access to the organization private key using his own keys",
                field: "keychainItems",
            });
        }

        for (const item of request.body.keychainItems) {
            await KeychainItemHelper.validate(item)

            // Validate if the key's public key corresponds with the organization key
            if (item.publicKey != request.body.organization.publicKey) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "You can only add the organization's keypair to the keychain",
                    field: "keychainItems.0.publicKey",
                });
            }

            // Yay, we can add the keychain items (after creating the organization and user)
        }

        // First create the organization
        // todo: add some duplicate validation
        const organization = new Organization();
        organization.name = request.body.organization.name;
        organization.publicKey = request.body.organization.publicKey;
        organization.uri = uri;
        organization.meta = request.body.organization.meta
        organization.address = request.body.organization.address

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
            request.body.user.email,
            request.body.user.publicKey,
            request.body.user.publicAuthSignKey,
            request.body.user.encryptedPrivateKey,
            request.body.user.authSignKeyConstants,
            request.body.user.authEncryptionKeyConstants,
            request.body.user.id
        );
        if (!user) {
            // This user already exists, well that is pretty impossible
            throw new SimpleError({
                code: "creating_user",
                message: "Something went wrong while creating the user. Please contact us to resolve this issue.",
                statusCode: 500
            });
        }

        for (const item of request.body.keychainItems) {
            const keychainItem = new KeychainItem()
            keychainItem.userId = user.id
            keychainItem.encryptedPrivateKey = item.encryptedPrivateKey
            keychainItem.publicKey = item.publicKey

            await keychainItem.save()
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
