import type { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, Invoice, Organization, OrganizationRegistrationPeriod, Payment, Platform, RegistrationPeriod } from '@stamhoofd/models';
import { ApplicationFee } from '@stamhoofd/models/models/ApplicationFee.js';
import { Organization as OrganizationStruct } from '@stamhoofd/structures';

import { Formatter } from '@stamhoofd/utility';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';
import { SQL } from '@stamhoofd/sql';

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
                throw Context.auth.error($t(`%Cw`));
            }

            const organization = await Organization.getByID(id);
            if (!organization) {
                throw new SimpleError({ code: 'not_found', message: 'Organization not found', statusCode: 404 });
            }

            if (organization.id === (await Platform.getSharedPrivateStruct()).membershipOrganizationId) {
                throw new SimpleError({
                    code: 'cannot_delete_membership_organization',
                    message: 'Cannot delete membership organization',
                    human: $t(`%Cx`),
                });
            }

            // Financial records may not disappear together with the organization that had to pay them
            const payerRecordCounts = await Promise.all([
                BalanceItem.select().where('payingOrganizationId', id).first(false),
                Payment.select().where('payingOrganizationId', id).first(false),
                ApplicationFee.select().where('payingOrganizationId', id).first(false),
                Invoice.select().where('payingOrganizationId', id).first(false),
                Payment.select()
                    .where('organizationId', id)
                    .where(
                        SQL.where('serviceFeePayout', '!=', 0)
                            .or('serviceFeeManual', '!=', 0)
                            .or('serviceFeeManualCharged', '!=', 0)
                            .or('transferFeeManual', '!=', 0)
                            .or('transferFeeManualCharged', '!=', 0),
                    )
                    .first(false),
            ]);

            if (payerRecordCounts.some(hasSome => hasSome !== null)) {
                throw new SimpleError({
                    code: 'organization_has_financial_records',
                    message: 'Organization is still referenced as paying organization',
                    human: $t('%Zks', { organization: organization.name }),
                });
            }

            await organization.delete();
        }

        // Organization creation
        for (const { put } of request.body.getPuts()) {
            if (!Context.auth.hasPlatformFullAccess()) {
                throw Context.auth.error($t(`%Cy`));
            }

            if (put.name.length < 4) {
                if (put.name.length == 0) {
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

            const uri = put.uri || Formatter.slug(put.name);

            if (uri.length > 100) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Field is too long',
                    human: $t(`%D1`),
                    field: 'organization.name',
                });
            }
            const uriExists = await Organization.getByURI(uri);

            if (uriExists) {
                throw new SimpleError({
                    code: 'name_taken',
                    message: 'An organization with the same name already exists',
                    human: $t(`%D2`),
                    field: 'name',
                });
            }

            const alreadyExists = await Organization.getByURI(Formatter.slug(put.name));

            if (alreadyExists) {
                throw new SimpleError({
                    code: 'name_taken',
                    message: 'An organization with the same name already exists',
                    human: $t(`%D3`),
                    field: 'name',
                });
            }

            const organization = new Organization();
            organization.id = put.id;
            organization.name = put.name;

            organization.uri = put.uri;
            organization.meta = put.meta;
            organization.address = put.address;
            organization.language = put.language;

            let period: RegistrationPeriod | null = null;

            if (STAMHOOFD.userMode === 'platform') {
                const periodId = (await Platform.getShared()).periodIdIfPlatform;
                organization.periodId = periodId;
            } else {
                period = new RegistrationPeriod();
                period.configureForNewOrganization();
                await period.save();
                organization.periodId = period.id;
            }

            if (put.privateMeta) {
                organization.privateMeta = put.privateMeta;
            }

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

            if (STAMHOOFD.userMode !== 'platform' && period) {
                period.organizationId = organization.id;
                await period.save();
            }

            const organizationPeriod = new OrganizationRegistrationPeriod();
            organizationPeriod.organizationId = organization.id;
            organizationPeriod.periodId = organization.periodId;
            await organizationPeriod.save();

            result.push(organization);
        }

        return new Response(await AuthenticatedStructures.adminOrganizations(result));
    }
}
