import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { assertSort, CountFilteredRequest, EmailWithRecipients, EmailStatus, getSortFilter, LimitedFilteredRequest, mergeFilters, PaginatedResponse, StamhoofdFilter } from '@stamhoofd/structures';

import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Email, Member } from '@stamhoofd/models';
import { applySQLSorter, compileToSQLFilter, SQLFilterDefinitions, SQLSortDefinitions } from '@stamhoofd/sql';
import { Context } from '../../../helpers/Context.js';
import { emailFilterCompilers, userEmailFilterCompilers } from '../../../sql-filters/emails.js';
import { emailSorters } from '../../../sql-sorters/emails.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<EmailWithRecipients[], LimitedFilteredRequest>;

const filterCompilers: SQLFilterDefinitions = emailFilterCompilers;
const sorters: SQLSortDefinitions<Email> = emailSorters;

export class GetUserEmailsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/user/email', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(memberIds: string[], q: CountFilteredRequest | LimitedFilteredRequest) {
        const organization = Context.organization;
        const user = Context.user;
        if (!user) {
            throw new Error('Not authenticated');
        }

        let scopeFilter: StamhoofdFilter | null = null;

        if (organization) {
            scopeFilter = mergeFilters([scopeFilter, {
                organizationId: organization.id,
            }]);
        }

        scopeFilter = mergeFilters([scopeFilter, {
            recipients: {
                $elemMatch: {
                    memberId: {
                        $in: memberIds,
                    },
                },
            },
        }]);

        const query = Email.select()
            .where('deletedAt', null)
            .where('status', EmailStatus.Sent)
            .where('showInMemberPortal', true);

        if (scopeFilter) {
            query.where(await compileToSQLFilter(scopeFilter, filterCompilers));
        }

        if (q.filter) {
            // This one is more strict
            query.where(await compileToSQLFilter(q.filter, userEmailFilterCompilers));
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
                // More strict as well, since this comes from the frontend
                query.where(await compileToSQLFilter(q.pageFilter, userEmailFilterCompilers));
            }

            q.sort = assertSort(q.sort, [{ key: 'id' }]);
            applySQLSorter(query, q.sort, sorters);
            query.limit(q.limit);
        }

        return query;
    }

    static async buildData(requestQuery: LimitedFilteredRequest) {
        const user = Context.user;
        if (!user) {
            throw new Error('Not authenticated');
        }
        const memberIds = await Member.getMemberIdsForUser(user);
        const query = await GetUserEmailsEndpoint.buildQuery(memberIds, requestQuery);
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

        return new PaginatedResponse<EmailWithRecipients[], LimitedFilteredRequest>({
            results: await Promise.all(emails.map(email => email.getStructureForUser(user, memberIds))),
            next,
        });
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        await Context.authenticate();

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
            await GetUserEmailsEndpoint.buildData(request.query),
        );
    }
}
