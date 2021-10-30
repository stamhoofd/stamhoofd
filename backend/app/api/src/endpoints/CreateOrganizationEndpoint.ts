import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { KeychainItemHelper } from '@stamhoofd/crypto';
import { Email, EmailInterfaceBase } from '@stamhoofd/email';
import { EmailVerificationCode, STCredit, UsedRegisterCode } from '@stamhoofd/models';
import { KeychainItem } from '@stamhoofd/models';
import { Organization } from "@stamhoofd/models";
import { RegisterCode } from '@stamhoofd/models';
import { User } from "@stamhoofd/models";
import { CreateOrganization, CreditItem, PermissionLevel,Permissions, SignupResponse } from "@stamhoofd/structures";
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
        organization.id = request.body.organization.id;
        organization.name = request.body.organization.name;

        // Delay save until after organization is saved, but do validations before the organization is saved
        let credit: STCredit | undefined = undefined
        let usedCode: UsedRegisterCode | undefined = undefined
        const delayEmails: EmailInterfaceBase[] = []

        if (request.body.registerCode !== null && request.body.registerCode.length > 0) {
            const code = await RegisterCode.getByID(request.body.registerCode)
            if (!code) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "You can only add the organization's keypair to the keychain",
                    human: "De doorverwijzingscode die je hebt opgegeven is niet langer geldig",
                    field: "registerCode",
                });
            }

            const otherOrganization = code.organizationId ? await Organization.getByID(code.organizationId) : undefined

            if (code.value > 0 && otherOrganization) {
                // Create initial credit
                credit = new STCredit()
                credit.organizationId = organization.id
                credit.change = code.value
                credit.description = otherOrganization ? ("Tegoed gekregen van "+otherOrganization.name) : code.description

                // Expire in one year (will get extended for every purchase or activation)
                credit.expireAt = new Date()
                credit.expireAt.setFullYear(credit.expireAt.getFullYear() + 1)
                credit.expireAt.setMilliseconds(0)

                // Save later
            }

            if (otherOrganization) {
                const admins = await otherOrganization.getAdminToEmails()
                if (admins) {
                    // Delay email until everything is validated and saved
                    delayEmails.push({
                        to: admins,
                        bcc: "simon@stamhoofd.be",
                        subject: organization.name+" heeft jullie doorverwijzingslink gebruikt 🥳",
                        text: "Dag "+otherOrganization.name+",\n\nGoed nieuws! "+organization.name+" heeft jullie doorverwijzingslink gebruikt om zich op Stamhoofd te registreren. Als zij minstens 1 euro op Stamhoofd uitgeven ontvangen jullie een tegoed dat kan oplopen tot 100 euro per vereniging (zie daarvoor Stamhoofd > Instellingen). Lees zeker onze tips na om nog een groter bedrag te verzamelen 😉\n\n— Stamhoofd"
                    })
                }
            }

            // Save that we used this code (so we can reward the other organization)
            usedCode = new UsedRegisterCode()
            usedCode.organizationId = organization.id
            usedCode.code = code.code

            // Save later
        }

        organization.publicKey = request.body.organization.publicKey;
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
        user.permissions = Permissions.create({ level: PermissionLevel.Full })
        await user.save()

        for (const item of request.body.keychainItems) {
            const keychainItem = new KeychainItem()
            keychainItem.userId = user.id
            keychainItem.encryptedPrivateKey = item.encryptedPrivateKey
            keychainItem.publicKey = item.publicKey

            await keychainItem.save()
        }

        if (credit) {
            await credit.save()
        }

        if (usedCode) {
            await usedCode.save()
        }

        const code = await EmailVerificationCode.createFor(user, user.email)
        code.send(user, request.i18n)

        for (const email of delayEmails) {
            Email.sendInternal(email, organization.i18n)
        }

        return new Response(SignupResponse.create({
            token: code.token,

            // always return the same encryption constants
            authEncryptionKeyConstants: request.body.user.authEncryptionKeyConstants
        }));
    }

    
}
