import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { DocumentTemplate } from '@stamhoofd/models';
import { assertSort, CountFilteredRequest, DocumentTemplatePrivate, LimitedFilteredRequest, PaginatedResponse, SearchFilterFactory, StamhoofdFilter } from '@stamhoofd/structures';

import { Decoder } from '@simonbackx/simple-encoding';
import { applySQLSorter, compileToSQLFilter, SQL, SQLFilterDefinitions, SQLSortDefinitions } from '@stamhoofd/sql';
import { Context } from '../../../../helpers/Context.js';
import { LimitedFilteredRequestHelper } from '../../../../helpers/LimitedFilteredRequestHelper.js';
import { documentTemplateFilterCompilers } from '../../../../sql-filters/document-templates.js';
import { documentTemplateSorters } from '../../../../sql-sorters/document-templates.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<DocumentTemplatePrivate[], LimitedFilteredRequest>;

const filterCompilers: SQLFilterDefinitions = documentTemplateFilterCompilers;
const sorters: SQLSortDefinitions<DocumentTemplate> = documentTemplateSorters;

export class GetDocumentTemplatesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/document-templates', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest) {
        const organization = Context.organization!;

        const templatesTable: string = DocumentTemplate.table;

        const query = SQL
            .select(SQL.wildcard(templatesTable))
            .from(SQL.table(templatesTable))
            .where('organizationId', organization.id);

        if (q.filter) {
            query.where(await compileToSQLFilter(q.filter, filterCompilers));
        }

        if (q.search) {
            const searchFilter: StamhoofdFilter | null = getDocumentTemplateSearchFilter(q.search);

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
        const query = await this.buildQuery(requestQuery);
        const data = await query.fetch();

        const templates: DocumentTemplate[] = DocumentTemplate.fromRows(data, DocumentTemplate.table);

        const next = LimitedFilteredRequestHelper.fixInfiniteLoadingLoop({
            request: requestQuery,
            results: templates,
            sorters,
        });

        return new PaginatedResponse<DocumentTemplatePrivate[], LimitedFilteredRequest>({
            results: templates.map(t => t.getPrivateStructure()),
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
            await GetDocumentTemplatesEndpoint.buildData(request.query),
        );
    }
}

function getDocumentTemplateSearchFilter(search: string | null): StamhoofdFilter | null {
    if (search === null || search === undefined) {
        return null;
    }

    const numberFilter = SearchFilterFactory.getIntegerFilter(search);

    if (numberFilter) {
        return {
            year: numberFilter,
        };
    }

    return {
        name: {
            $contains: search,
        },
    };
}
