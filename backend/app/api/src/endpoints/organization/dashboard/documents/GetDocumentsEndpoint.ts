import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Document } from '@stamhoofd/models';
import { assertSort, CountFilteredRequest, Document as DocumentStruct, getSortFilter, LimitedFilteredRequest, PaginatedResponse, SearchFilterFactory, StamhoofdFilter } from '@stamhoofd/structures';

import { Decoder } from '@simonbackx/simple-encoding';
import { compileToSQLFilter, compileToSQLSorter, SQL, SQLFilterDefinitions, SQLSortDefinitions } from '@stamhoofd/sql';
import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures';
import { Context } from '../../../../helpers/Context';
import { LimitedFilteredRequestHelper } from '../../../../helpers/LimitedFilteredRequestHelper';
import { documentFilterCompilers } from '../../../../sql-filters/documents';
import { documentSorters } from '../../../../sql-sorters/documents';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<DocumentStruct[], LimitedFilteredRequest>;

const filterCompilers: SQLFilterDefinitions = documentFilterCompilers;
const sorters: SQLSortDefinitions<Document> = documentSorters;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetDocumentsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/documents', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest) {
        const organization = Context.organization!;

        const documentTable: string = Document.table;

        const query = SQL
            .select(SQL.wildcard(documentTable))
            .from(SQL.table(documentTable))
            .where(await Promise.resolve(compileToSQLFilter({
                organizationId: organization.id,
            }, filterCompilers)));

        if (q.filter) {
            query.where(await Promise.resolve(compileToSQLFilter(q.filter, filterCompilers)));
        }

        if (q.search) {
            const searchFilter: StamhoofdFilter | null = getDocumentSearchFilter(q.search);

            if (searchFilter) {
                query.where(await Promise.resolve(compileToSQLFilter(searchFilter, filterCompilers)));
            }
        }

        if (q instanceof LimitedFilteredRequest) {
            if (q.pageFilter) {
                query.where(await Promise.resolve(compileToSQLFilter(q.pageFilter, filterCompilers)));
            }

            q.sort = assertSort(q.sort, [{ key: 'id' }]);
            query.orderBy(compileToSQLSorter(q.sort, sorters));
            query.limit(q.limit);
        }

        return query;
    }

    static async buildData(requestQuery: LimitedFilteredRequest) {
        const query = await this.buildQuery(requestQuery);
        const data = await query.fetch();

        const documents: Document[] = Document.fromRows(data, Document.table);

        let next: LimitedFilteredRequest | undefined;

        if (documents.length >= requestQuery.limit) {
            const lastObject = documents[documents.length - 1];
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

        return new PaginatedResponse<DocumentStruct[], LimitedFilteredRequest>({
            results: await AuthenticatedStructures.documents(documents),
            next,
        });
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        if (!await Context.auth.canManageDocuments(organization.id)) {
            throw Context.auth.error();
        }

        LimitedFilteredRequestHelper.throwIfInvalidLimit({
            request: request.query,
            maxLimit: Context.auth.hasSomePlatformAccess() ? 1000 : 100,
        });

        return new Response(
            await GetDocumentsEndpoint.buildData(request.query),
        );
    }
}

function getDocumentSearchFilter(search: string | null): StamhoofdFilter | null {
    if (search === null || search === undefined) {
        return null;
    }

    const numberFilter = SearchFilterFactory.getIntegerFilter(search);

    if (numberFilter) {
        return {
            number: numberFilter,
        };
    }

    return {
        $or: [
            {
                description: {
                    $contains: search,
                },
            },
            {
                id: {
                    $contains: search,
                },
            },
        ]
        ,
    };
}
