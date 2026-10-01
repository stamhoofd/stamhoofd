import type { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, Invoice, Organization, OrganizationRegistrationPeriod, Payment, Platform, RegistrationPeriod } from '@stamhoofd/models';
import { ApplicationFee } from '@stamhoofd/models/models/ApplicationFee.js';
import { AccessRight, Organization as OrganizationStruct } from '@stamhoofd/structures';

import { Formatter } from '@stamhoofd/utility';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';
import { TagHelper } from '../../../helpers/TagHelper.js';
import { SQL } from '@stamhoofd/sql';
import { isAbortedError, isCanceledError } from '@stamhoofd/queues';

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
        if (!Context.auth.hasSomePlatformAccess()) {
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
        const puts = request.body.getPuts();
        const platform = await Platform.getShared();
        const allowedTags = Context.auth.getOrganizationTagsWithAccessRight(AccessRight.PlatformCreateOrganizations);

        // Organizations with one of these tags are managed by the admin
        const managedTags = allowedTags === 'all' ? null : new Set(allowedTags.flatMap(id => [id, ...TagHelper.getAllDescendants(id, { allTags: platform.config.tags })]));

        if (puts.length > 0 && managedTags?.size === 0) {
            throw Context.auth.error($t('Je hebt geen toegang om nieuwe verenigingen aan te maken'));
        }

        for (const { put } of puts) {
            put.meta.tags = TagHelper.getAllTagsFromHierarchy(put.meta.tags, platform.config.tags);

            if (managedTags) {
                // Only managed tags and their parents are allowed
                const permittedTags = TagHelper.getAllTagsFromHierarchy(put.meta.tags.filter(t => managedTags.has(t)), platform.config.tags);
                if (permittedTags.length === 0 || put.meta.tags.some(t => !permittedTags.includes(t))) {
                    throw new SimpleError({
                        code: 'permission_denied',
                        message: 'You can only create organizations with tags you manage',
                        human: $t('Je kan enkel verenigingen aanmaken met tags die je beheert. Selecteer minstens één van die tags.'),
                        field: 'tags',
                        statusCode: 403,
                    });
                }
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

            const uri = Formatter.slug(put.uri || put.name);

            if (uri.length > 100) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Field is too long',
                    human: $t(`%D1`),
                    field: 'organization.name',
                });
            }

            if (uri.length < 3) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Field is too short',
                    human: $t(`%EX`),
                    field: 'uri',
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
            if (Context.auth.hasPlatformFullAccess()) {
                organization.id = put.id;
            }
            organization.name = put.name;

            organization.uri = uri;
            if (Context.auth.hasPlatformFullAccess()) {
                organization.meta = put.meta;
            }
            else {
                organization.meta.tags = put.meta.tags;
            }
            organization.address = put.address;
            organization.language = put.language;

            let period: RegistrationPeriod | null = null;

            if (STAMHOOFD.userMode === 'platform') {
                organization.periodId = platform.periodIdIfPlatform;
            } else {
                period = new RegistrationPeriod();
                period.configureForNewOrganization();
                await period.save();
                organization.periodId = period.id;
            }

            if (put.privateMeta) {
                if (Context.auth.hasPlatformFullAccess()) {
                    organization.privateMeta = put.privateMeta;
                }
                else {
                    organization.privateMeta.recordAnswers = put.privateMeta.recordAnswers;
                }
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

        if (result.some(organization => organization.meta.tags.length > 0)) {
            try {
                await TagHelper.updateOrganizations();
            } catch (e) {
                if (!isAbortedError(e) && !isCanceledError(e)) throw e;
            }
        }

        return new Response(await AuthenticatedStructures.adminOrganizations(result));
    }
}
