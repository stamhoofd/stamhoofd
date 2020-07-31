import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { KeychainItemHelper } from '@stamhoofd/crypto';
import { CreateOrganization, GroupGenderType,GroupSettings,OrganizationGenderType,OrganizationType, PermissionLevel,Permissions, Token as TokenStruct, UmbrellaOrganization } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { group } from 'console';

import { Group } from '../models/Group';
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
        organization.id = request.body.organization.id;
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

        // Setup default groups if possible
        if (organization.meta.type == OrganizationType.Youth && organization.meta.umbrellaOrganization == UmbrellaOrganization.ScoutsEnGidsenVlaanderen) {
            await this.createSGVGroups(organization)
        } else if (organization.meta.type == OrganizationType.Youth && organization.meta.umbrellaOrganization == UmbrellaOrganization.ChiroNationaal) {
            await this.createChiroGroups(organization)
        }

        // Create an expired access token, that you can only renew when the user has been verified, but this can keep the users signed in
        const token = await Token.createToken(user)

        // Send mail without waiting
        /*Email.send(user.email, "Verifieer jouw e-mailadres voor Stamhoofd", "Hey fa!\n\nWelkom bij Stamhoofd. Klik op de onderstaande link om jouw e-mailadres te bevestigen.\n\nStamhoofd").catch(e => {
            console.error(e)
        })*/

        // An email has been send to confirm your email address
        return new Response(new TokenStruct(token));
    }

    async createSGVGroups(organization: Organization) {
        const mixedType = organization.meta.genderType == OrganizationGenderType.OnlyMale ? 
        GroupGenderType.OnlyMale : 
            (organization.meta.genderType == OrganizationGenderType.OnlyFemale ? 
                GroupGenderType.OnlyFemale : 
                GroupGenderType.Mixed)

        const kapoenen = new Group()
        kapoenen.organizationId = organization.id
        kapoenen.settings = GroupSettings.create({
            name: "Kapoenen",
            genderType: mixedType,
            startDate: organization.meta.defaultStartDate,
            endDate: organization.meta.defaultEndDate,
            prices: organization.meta.defaultPrices,
            minAge: 6,
            maxAge: 7
        })
        await kapoenen.save();

        const jin = new Group()
        jin.organizationId = organization.id
        jin.settings = GroupSettings.create({
            name: "Jin",
            genderType: mixedType,
            startDate: organization.meta.defaultStartDate,
            endDate: organization.meta.defaultEndDate,
            prices: organization.meta.defaultPrices,
            minAge: 17,
            maxAge: 17
        })
        await jin.save();

        if (organization.meta.genderType == OrganizationGenderType.Mixed) {
            const wouters = new Group()
            wouters.organizationId = organization.id
            wouters.settings = GroupSettings.create({
                name: "Wouters",
                genderType: GroupGenderType.Mixed,
                startDate: organization.meta.defaultStartDate,
                endDate: organization.meta.defaultEndDate,
                prices: organization.meta.defaultPrices,
                minAge: 8,
                maxAge: 10
            })
            await wouters.save();

            const jonggivers = new Group()
            jonggivers.organizationId = organization.id
            jonggivers.settings = GroupSettings.create({
                name: "Jonggivers",
                genderType: GroupGenderType.Mixed,
                startDate: organization.meta.defaultStartDate,
                endDate: organization.meta.defaultEndDate,
                prices: organization.meta.defaultPrices,
                minAge: 11,
                maxAge: 13
            })
            await jonggivers.save();

            const givers = new Group()
            givers.organizationId = organization.id
            givers.settings = GroupSettings.create({
                name: "Givers",
                genderType: GroupGenderType.Mixed,
                startDate: organization.meta.defaultStartDate,
                endDate: organization.meta.defaultEndDate,
                prices: organization.meta.defaultPrices,
                minAge: 14,
                maxAge: 16
            })
            await givers.save();
        }

        if (organization.meta.genderType == OrganizationGenderType.OnlyFemale || organization.meta.genderType == OrganizationGenderType.Separated) {
            const wouters = new Group()
            wouters.organizationId = organization.id
            wouters.settings = GroupSettings.create({
                name: "Kabouters",
                genderType: GroupGenderType.OnlyFemale,
                startDate: organization.meta.defaultStartDate,
                endDate: organization.meta.defaultEndDate,
                prices: organization.meta.defaultPrices,
                minAge: 8,
                maxAge: 10
            })
            await wouters.save();

            const jonggivers = new Group()
            jonggivers.organizationId = organization.id
            jonggivers.settings = GroupSettings.create({
                name: "Jonggidsen",
                genderType: GroupGenderType.OnlyFemale,
                startDate: organization.meta.defaultStartDate,
                endDate: organization.meta.defaultEndDate,
                prices: organization.meta.defaultPrices,
                minAge: 11,
                maxAge: 13
            })
            await jonggivers.save();

            const givers = new Group()
            givers.organizationId = organization.id
            givers.settings = GroupSettings.create({
                name: "Gidsen",
                genderType: GroupGenderType.OnlyFemale,
                startDate: organization.meta.defaultStartDate,
                endDate: organization.meta.defaultEndDate,
                prices: organization.meta.defaultPrices,
                minAge: 14,
                maxAge: 16
            })
            await givers.save();
        }

        if (organization.meta.genderType == OrganizationGenderType.OnlyMale || organization.meta.genderType == OrganizationGenderType.Separated) {
            const wouters = new Group()
            wouters.organizationId = organization.id
            wouters.settings = GroupSettings.create({
                name: "Welpen",
                genderType: GroupGenderType.OnlyMale,
                startDate: organization.meta.defaultStartDate,
                endDate: organization.meta.defaultEndDate,
                prices: organization.meta.defaultPrices,
                minAge: 8,
                maxAge: 10
            })
            await wouters.save();

            const jonggivers = new Group()
            jonggivers.organizationId = organization.id
            jonggivers.settings = GroupSettings.create({
                name: "Jongverkenners",
                genderType: GroupGenderType.OnlyMale,
                startDate: organization.meta.defaultStartDate,
                endDate: organization.meta.defaultEndDate,
                prices: organization.meta.defaultPrices,
                minAge: 11,
                maxAge: 13
            })
            await jonggivers.save();

            const givers = new Group()
            givers.organizationId = organization.id
            givers.settings = GroupSettings.create({
                name: "Verkenners",
                genderType: GroupGenderType.OnlyMale,
                startDate: organization.meta.defaultStartDate,
                endDate: organization.meta.defaultEndDate,
                prices: organization.meta.defaultPrices,
                minAge: 14,
                maxAge: 16
            })
            await givers.save();
        }
    }

    async createChiroGroups(organization: Organization) {
        const mixedType = organization.meta.genderType == OrganizationGenderType.OnlyMale ? 
        GroupGenderType.OnlyMale : 
            (organization.meta.genderType == OrganizationGenderType.OnlyFemale ? 
                GroupGenderType.OnlyFemale : 
                GroupGenderType.Mixed)

        const ribbels = new Group()
        ribbels.organizationId = organization.id
        ribbels.settings = GroupSettings.create({
            name: "Ribbels",
            genderType: mixedType,
            startDate: organization.meta.defaultStartDate,
            endDate: organization.meta.defaultEndDate,
            prices: organization.meta.defaultPrices,
            minAge: 6,
            maxAge: 7
        })
        await ribbels.save();

        const speelclub = new Group()
        speelclub.organizationId = organization.id
        speelclub.settings = GroupSettings.create({
            name: "Speelclub",
            genderType: mixedType,
            startDate: organization.meta.defaultStartDate,
            endDate: organization.meta.defaultEndDate,
            prices: organization.meta.defaultPrices,
            minAge: 8,
            maxAge: 9
        })
        await speelclub.save();


        const aspis = new Group()
        aspis.organizationId = organization.id
        aspis.settings = GroupSettings.create({
            name: "Aspi's",
            genderType: mixedType,
            startDate: organization.meta.defaultStartDate,
            endDate: organization.meta.defaultEndDate,
            prices: organization.meta.defaultPrices,
            minAge: 16,
            maxAge: 17
        })
        await aspis.save();

        if (organization.meta.genderType == OrganizationGenderType.Mixed) {
            const rakwis = new Group()
            rakwis.organizationId = organization.id
            rakwis.settings = GroupSettings.create({
                name: "Rakwi's",
                genderType: GroupGenderType.Mixed,
                startDate: organization.meta.defaultStartDate,
                endDate: organization.meta.defaultEndDate,
                prices: organization.meta.defaultPrices,
                minAge: 10,
                maxAge: 11
            })
            await rakwis.save();

            const titos = new Group()
            titos.organizationId = organization.id
            titos.settings = GroupSettings.create({
                name: "Tito's",
                genderType: GroupGenderType.Mixed,
                startDate: organization.meta.defaultStartDate,
                endDate: organization.meta.defaultEndDate,
                prices: organization.meta.defaultPrices,
                minAge: 12,
                maxAge: 13
            })
            await titos.save();

            const ketis = new Group()
            ketis.organizationId = organization.id
            ketis.settings = GroupSettings.create({
                name: "Keti's",
                genderType: GroupGenderType.Mixed,
                startDate: organization.meta.defaultStartDate,
                endDate: organization.meta.defaultEndDate,
                prices: organization.meta.defaultPrices,
                minAge: 14,
                maxAge: 15
            })
            await ketis.save();
        }

        if (organization.meta.genderType == OrganizationGenderType.OnlyFemale || organization.meta.genderType == OrganizationGenderType.Separated) {
            const rakwis = new Group()
            rakwis.organizationId = organization.id
            rakwis.settings = GroupSettings.create({
                name: "Kwiks",
                genderType: GroupGenderType.OnlyFemale,
                startDate: organization.meta.defaultStartDate,
                endDate: organization.meta.defaultEndDate,
                prices: organization.meta.defaultPrices,
                minAge: 10,
                maxAge: 11
            })
            await rakwis.save();

            const titos = new Group()
            titos.organizationId = organization.id
            titos.settings = GroupSettings.create({
                name: "Toppers",
                genderType: GroupGenderType.OnlyFemale,
                startDate: organization.meta.defaultStartDate,
                endDate: organization.meta.defaultEndDate,
                prices: organization.meta.defaultPrices,
                minAge: 12,
                maxAge: 13
            })
            await titos.save();

            const ketis = new Group()
            ketis.organizationId = organization.id
            ketis.settings = GroupSettings.create({
                name: "Tiptiens",
                genderType: GroupGenderType.OnlyFemale,
                startDate: organization.meta.defaultStartDate,
                endDate: organization.meta.defaultEndDate,
                prices: organization.meta.defaultPrices,
                minAge: 14,
                maxAge: 15
            })
            await ketis.save();
        }

        if (organization.meta.genderType == OrganizationGenderType.OnlyMale || organization.meta.genderType == OrganizationGenderType.Separated) {
            const rakwis = new Group()
            rakwis.organizationId = organization.id
            rakwis.settings = GroupSettings.create({
                name: "Rakkers",
                genderType: GroupGenderType.OnlyMale,
                startDate: organization.meta.defaultStartDate,
                endDate: organization.meta.defaultEndDate,
                prices: organization.meta.defaultPrices,
                minAge: 10,
                maxAge: 11
            })
            await rakwis.save();

            const titos = new Group()
            titos.organizationId = organization.id
            titos.settings = GroupSettings.create({
                name: "Tippers",
                genderType: GroupGenderType.OnlyMale,
                startDate: organization.meta.defaultStartDate,
                endDate: organization.meta.defaultEndDate,
                prices: organization.meta.defaultPrices,
                minAge: 12,
                maxAge: 13
            })
            await titos.save();

            const ketis = new Group()
            ketis.organizationId = organization.id
            ketis.settings = GroupSettings.create({
                name: "Kerels",
                genderType: GroupGenderType.OnlyMale,
                startDate: organization.meta.defaultStartDate,
                endDate: organization.meta.defaultEndDate,
                prices: organization.meta.defaultPrices,
                minAge: 14,
                maxAge: 15
            })
            await ketis.save();
        }
    }
}
