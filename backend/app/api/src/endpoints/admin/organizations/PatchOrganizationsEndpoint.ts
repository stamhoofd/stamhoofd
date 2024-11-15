import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization, OrganizationRegistrationPeriod, Platform } from '@stamhoofd/models';
import { Organization as OrganizationStruct } from '@stamhoofd/structures';

import { Formatter } from '@stamhoofd/utility';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Context } from '../../../helpers/Context';

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<OrganizationStruct>;
type ResponseBody = OrganizationStruct[];

export class PatchOrganizationsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(OrganizationStruct as Decoder<OrganizationStruct>, OrganizationStruct.patchType() as Decoder<AutoEncoderPatchType<OrganizationStruct>>, StringDecoder);

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/admin/organizations', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.authenticate();
        if (!Context.auth.hasPlatformFullAccess()) {
            throw Context.auth.error();
        }

        if (request.body.changes.length == 0) {
            return new Response([]);
        }

        const result: Organization[] = [];

        for (const id of request.body.getDeletes()) {
            if (!Context.auth.hasPlatformFullAccess()) {
                throw Context.auth.error('Enkel een platform hoofdbeheerder kan groepen verwijderen');
            }

            const organization = await Organization.getByID(id);
            if (!organization) {
                throw new SimpleError({ code: 'not_found', message: 'Organization not found', statusCode: 404 });
            }

            if (organization.id === (await Platform.getShared()).membershipOrganizationId) {
                throw new SimpleError({
                    code: 'cannot_delete_membership_organization',
                    message: 'Cannot delete membership organization',
                    human: 'Je kan de hoofdgroep niet verwijderen. Als je dit toch wil doen, kan je eerst een andere vereniging instellen als hoofdgroep via \'Boekhouding en aansluitingen\'.',
                });
            }

            await organization.delete();
        }

        // Organization creation
        for (const { put } of request.body.getPuts()) {
            if (!Context.auth.hasPlatformFullAccess()) {
                throw Context.auth.error('Enkel een platform hoofdbeheerder kan nieuwe groepen aanmaken');
            }

            if (put.name.length < 4) {
                if (put.name.length == 0) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Should not be empty',
                        human: 'Je bent de naam van je organisatie vergeten in te vullen',
                        field: 'organization.name',
                    });
                }

                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Field is too short',
                    human: 'Kijk de naam van je organisatie na, deze is te kort. Vul eventueel aan met de gemeente.',
                    field: 'organization.name',
                });
            }

            const uri = put.uri || Formatter.slug(put.name);

            if (uri.length > 100) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Field is too long',
                    human: 'De naam van de vereniging is te lang. Probeer de naam wat te verkorten en probeer opnieuw.',
                    field: 'organization.name',
                });
            }
            const uriExists = await Organization.getByURI(uri);

            if (uriExists) {
                throw new SimpleError({
                    code: 'name_taken',
                    message: 'An organization with the same name already exists',
                    human: 'Er bestaat al een vereniging met dezelfde URI. Pas deze aan zodat deze uniek is, en controleer of deze vereniging niet al bestaat.',
                    field: 'name',
                });
            }

            const alreadyExists = await Organization.getByURI(Formatter.slug(put.name));

            if (alreadyExists) {
                throw new SimpleError({
                    code: 'name_taken',
                    message: 'An organization with the same name already exists',
                    human: 'Er bestaat al een vereniging met dezelfde naam. Voeg bijvoorbeeld de naam van je gemeente toe.',
                    field: 'name',
                });
            }

            const organization = new Organization();
            organization.id = put.id;
            organization.name = put.name;

            organization.uri = put.uri;
            organization.meta = put.meta;
            organization.address = put.address;

            const periodId = (await Platform.getShared()).periodId;
            organization.periodId = periodId;

            if (put.privateMeta) {
                organization.privateMeta = put.privateMeta;
            }

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

            const organizationPeriod = new OrganizationRegistrationPeriod();
            organizationPeriod.organizationId = organization.id;
            organizationPeriod.periodId = periodId;
            await organizationPeriod.save();

            result.push(organization);
        }

        return new Response(await AuthenticatedStructures.adminOrganizations(result));
    }
}
