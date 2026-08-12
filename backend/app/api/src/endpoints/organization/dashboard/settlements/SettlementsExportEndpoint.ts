import type { Decoder } from '@simonbackx/simple-encoding';
import { AutoEncoder, DateDecoder, EnumDecoder, field } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Email } from '@stamhoofd/email';
import { Organization, Platform } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { PaymentProvider } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { Context } from '../../../../helpers/Context.js';
import { SettlementExporter } from '../../../../helpers/SettlementExporter.js';

/**
 * payment_settlements grows like payments, so an export can't span an unbounded range.
 */
const MAXIMUM_RANGE_MS = 1100 * 24 * 60 * 60 * 1000;

type Params = Record<string, never>;
class Body extends AutoEncoder {
    @field({ decoder: DateDecoder })
    start: Date;

    @field({ decoder: DateDecoder })
    end: Date;

    @field({ decoder: new EnumDecoder(PaymentProvider), nullable: true, optional: true })
    provider: PaymentProvider | null = null;
}
type Query = undefined;
type ResponseBody = undefined;

/**
 * Build the settlements reconciliation report (from the stored tables only, no provider API calls)
 * and email it to the requesting admin.
 *
 * An export always covers exactly the payouts of the organization in context, for any finance
 * admin of that organization. The platform's own payouts belong to the membership organization, so
 * platform admins export those by scoping to the membership organization like any other.
 */
export class SettlementsExportEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = Body as Decoder<Body>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/settlements/export', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async authenticate() {
        const organization = await Context.setOrganizationScope();
        const { user } = await Context.authenticate();

        if (!await Context.auth.canManageFinances(organization.id)) {
            throw Context.auth.error();
        }

        const platform = await Platform.getSharedStruct();
        const enabled = platform.config.featureFlags.includes('settlements')
            || organization.privateMeta.featureFlags.includes('settlements');

        if (!enabled) {
            throw new SimpleError({
                code: 'not_available',
                message: 'Settlements are not enabled for this organization',
                statusCode: 400,
            });
        }

        return { organization, user, platform };
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const { organization, user, platform } = await SettlementsExportEndpoint.authenticate();

        const { start, end, provider } = request.body;

        if (end.getTime() < start.getTime()) {
            throw new SimpleError({
                code: 'invalid_range',
                message: 'The export ends before it starts',
                statusCode: 400,
            });
        }

        if (end.getTime() - start.getTime() > MAXIMUM_RANGE_MS) {
            throw new SimpleError({
                code: 'range_too_large',
                message: 'The requested export range is too large',
                statusCode: 400,
            });
        }

        // The membership organization sells the platform's fee invoices
        const membershipOrganization = platform.membershipOrganizationId ? await Organization.getByID(platform.membershipOrganizationId) : null;
        if (!membershipOrganization) {
            throw new SimpleError({
                code: 'missing_membership_organization',
                message: 'Platform has no membership organization configured',
                statusCode: 400,
            });
        }

        // Serialized so concurrent exports can't compete for memory; the result arrives by email
        QueueHandler.schedule('settlements-export', async () => {
            const exporter = new SettlementExporter({
                start,
                end,
                provider,
                organization,
                sellingOrganization: membershipOrganization,
            });

            await exporter.sendEmail({
                to: [{ email: user.email, name: user.name }],
            });
        }).catch((e) => {
            // The request already returned: without this the export just never arrives
            console.error('Settlements export failed', e);

            Email.send({
                from: Email.getWebmasterFromEmail(),
                to: [{ email: user.email, name: user.name }],
                subject: 'Uitbetalingen export mislukt',
                text: 'Het maken van de export van ' + Formatter.dateTime(start) + ' tot ' + Formatter.dateTime(end) + ' is mislukt. Probeer een kortere periode of neem contact op.\n',
                type: 'transactional',
            });
        });

        return new Response(undefined);
    }
}
