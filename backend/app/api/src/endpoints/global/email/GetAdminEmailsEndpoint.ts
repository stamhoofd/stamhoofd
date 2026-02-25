import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { assertSort, CountFilteredRequest, EmailPreview, EmailStatus, getSortFilter, LimitedFilteredRequest, mergeFilters, PaginatedResponse, PermissionLevel, StamhoofdFilter } from '@stamhoofd/structures';

import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Email, Platform } from '@stamhoofd/models';
import { applySQLSorter, compileToSQLFilter, SQLFilterDefinitions, SQLSortDefinitions } from '@stamhoofd/sql';
import { Context } from '../../../helpers/Context.js';
import { emailFilterCompilers } from '../../../sql-filters/emails.js';
import { emailSorters } from '../../../sql-sorters/emails.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<EmailPreview[], LimitedFilteredRequest>;

const filterCompilers: SQLFilterDefinitions = emailFilterCompilers;
const sorters: SQLSortDefinitions<Email> = emailSorters;

export class GetAdminEmailsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/email', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest) {
        const organization = Context.organization;
        const user = Context.user;
        if (!user) {
            throw new Error('Not authenticated');
        }

        let scopeFilter: StamhoofdFilter = null;

        const canReadAllEmails = await Context.auth.canReadAllEmails(organization ?? null);

        if (organization || Context.auth.getPlatformAccessibleOrganizationTags(PermissionLevel.Full) !== 'all') {
            scopeFilter = {
                organizationId: organization?.id ?? null,
            };
        }

        if (!canReadAllEmails) {
            const senders = organization ? organization.privateMeta.emails : (await Platform.getShared()).privateConfig.emails;
            const ids: string[] = [];
            for (const sender of senders) {
                if (await Context.auth.canReadAllEmails(organization ?? null, sender.id)) {
                    ids.push(sender.id);
                }
            }
            if (ids.length === 0) {
                throw Context.auth.error();
            }

            scopeFilter = mergeFilters([scopeFilter, {
                $or: [
                    {
                        senderId: {
                            $in: ids,
                        },
                        status: {
                            $neq: EmailStatus.Draft,
                        },
                    },
                    {
                        userId: user.id,
                    },
                ],
            }]);
        }
        else {
            scopeFilter = mergeFilters([scopeFilter, {
                $or: [
                    {
                        status: {
                            $neq: EmailStatus.Draft,
                        },
                    },
                    {
                        userId: user.id,
                    },
                ],
            }]);
        }

        const query = Email.select()
            .where('deletedAt', null);

        if (scopeFilter) {
            query.where(await compileToSQLFilter(scopeFilter, filterCompilers));
        }

        if (q.filter) {
            query.where(await compileToSQLFilter(q.filter, filterCompilers));
        }

        if (q.search) {
            let searchFilter: StamhoofdFilter | null = null;

            searchFilter = {
                subject: {
                    $contains: q.search,
                },
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
        const query = await GetAdminEmailsEndpoint.buildQuery(requestQuery);
        const emails = await query.fetch();

        let next: LimitedFilteredRequest | undefined;

        if (emails.length >= requestQuery.limit) {
            const lastObject = emails[emails.length - 1];
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

        return new PaginatedResponse<EmailPreview[], LimitedFilteredRequest>({
            results: await Promise.all(emails.map(email => email.getPreviewStructure())),
            next,
        });
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        if (!await Context.auth.canReadEmails(organization)) {
            // This is a first fast check, we'll limit it later in the scope query
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
            await GetAdminEmailsEndpoint.buildData(request.query),
        );
    }
}
