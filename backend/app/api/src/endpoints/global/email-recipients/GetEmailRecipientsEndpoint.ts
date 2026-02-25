import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { assertSort, CountFilteredRequest, EmailRecipient as EmailRecipientStruct, getSortFilter, LimitedFilteredRequest, PaginatedResponse, PermissionLevel, StamhoofdFilter } from '@stamhoofd/structures';

import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { EmailRecipient, fillRecipientReplacements } from '@stamhoofd/models';
import { applySQLSorter, compileToSQLFilter, SQLFilterDefinitions, SQLSortDefinitions } from '@stamhoofd/sql';
import { Context } from '../../../helpers/Context.js';
import { emailRecipientsFilterCompilers } from '../../../sql-filters/email-recipients.js';
import { emailRecipientSorters } from '../../../sql-sorters/email-recipients.js';
import { validateEmailRecipientFilter } from './helpers/validateEmailRecipientFilter.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<EmailRecipientStruct[], LimitedFilteredRequest>;

const filterCompilers: SQLFilterDefinitions = emailRecipientsFilterCompilers;
const sorters: SQLSortDefinitions<EmailRecipient> = emailRecipientSorters;

export class GetEmailRecipientsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/email-recipients', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest) {
        const organization = Context.organization;
        let scopeFilter: StamhoofdFilter | undefined = undefined;

        if (organization) {
            scopeFilter = {
                organizationId: organization.id,
            };
        }
        const canReadAllEmails = await Context.auth.canReadAllEmails(organization ?? null);

        if (!canReadAllEmails) {
            // Check if scope is correctly limited to a single email, otherwise throw an error.
            if (!await validateEmailRecipientFilter({ filter: q.filter, permissionLevel: PermissionLevel.Read })) {
                throw Context.auth.error({
                    message: 'You do not have sufficient permissions to view all email recipients',
                    human: $t(`d499972f-270c-44f6-ad7e-9d5359aef609`),
                });
            }
        }

        const query = EmailRecipient.select();

        if (scopeFilter) {
            query.where(await compileToSQLFilter(scopeFilter, filterCompilers));
        }

        if (q.filter) {
            query.where(await compileToSQLFilter(q.filter, filterCompilers));
        }

        if (q.search) {
            let searchFilter: StamhoofdFilter | null = null;

            searchFilter = {
                $or: [
                    {
                        email: {
                            $contains: q.search,
                        },
                    },
                    {
                        name: {
                            $contains: q.search,
                        },
                    },
                ],
            };

            if (searchFilter) {
                query.where(await compileToSQLFilter(searchFilter, filterCompilers));
            }
        }

        if (q instanceof LimitedFilteredRequest) {
            if (q.pageFilter) {
                query.where(await compileToSQLFilter(q.pageFilter, filterCompilers));
            }

            q.sort = assertSort(q.sort, [{ key: 'id' }]);
            applySQLSorter(query, q.sort, sorters);
            query.limit(q.limit);
        }

        return query;
    }

    static async buildData(requestQuery: LimitedFilteredRequest) {
        const query = await GetEmailRecipientsEndpoint.buildQuery(requestQuery);
        const recipients = await query.fetch();

        let next: LimitedFilteredRequest | undefined;

        if (recipients.length >= requestQuery.limit) {
            const lastObject = recipients[recipients.length - 1];
            const nextFilter = getSortFilter(lastObject, sorters, requestQuery.sort);

            next = new LimitedFilteredRequest({
                filter: requestQuery.filter,
                pageFilter: nextFilter,
                sort: requestQuery.sort,
                limit: requestQuery.limit,
                search: requestQuery.search,
            });

            if (JSON.stringify(nextFilter) === JSON.stringify(requestQuery.pageFilter)) {
                console.error('Found infinite loading loop for', requestQuery);
                next = undefined;
            }
        }

        return new PaginatedResponse<EmailRecipientStruct[], LimitedFilteredRequest>({
            results: await Promise.all((await EmailRecipient.getStructures(recipients)).map(async (r) => {
                const rr = r.getRecipient();
                await fillRecipientReplacements(rr, {
                    organization: Context.organization ?? null,
                    from: null,
                    replyTo: null,
                    forPreview: true,
                    forceRefresh: false,
                });
                r.replacements = rr.replacements;
                return r;
            })),
            next,
        });
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        if (!await Context.auth.canReadEmails(organization)) {
            throw Context.auth.error();
        }

        const maxLimit = Context.auth.hasSomePlatformAccess() ? 1000 : 100;

        if (request.query.limit > maxLimit) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'limit',
                message: 'Limit can not be more than ' + maxLimit,
            });
        }

        if (request.query.limit < 1) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'limit',
                message: 'Limit can not be less than 1',
            });
        }

        return new Response(
            await GetEmailRecipientsEndpoint.buildData(request.query),
        );
    }
}
