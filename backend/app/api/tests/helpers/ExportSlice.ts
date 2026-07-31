import { Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import type { Organization, User } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import type { StamhoofdFilter } from '@stamhoofd/structures';
import { ExcelExportType, LimitedFilteredRequest, SortItemDirection } from '@stamhoofd/structures';
import { ExportToExcelEndpoint } from '../../src/endpoints/global/files/ExportToExcelEndpoint.js';
import { Context } from '../../src/helpers/Context.js';
import { testServer } from './TestServer.js';

// Registers the balance item payment export, which is what a row that holds a part of its objects is
// written out with
import '../../src/excel-loaders/balance-item-payments.js';

/**
 * Reads what the balance item payment export of a filter comes down to, from inside a request so it
 * runs in the same scope an export runs in.
 */
class ExportSliceEndpoint extends Endpoint<Record<string, never>, undefined, undefined, undefined> {
    result = { count: 0, price: 0 };

    constructor(private readonly sliceFilter: StamhoofdFilter, private readonly search: string | null) {
        super();
    }

    protected doesMatch(): [true, Record<string, never>] {
        return [true, {}];
    }

    async handle() {
        await Context.setOrganizationScope();
        await Context.authenticate();

        const loader = ExportToExcelEndpoint.loaders.get(ExcelExportType.BalanceItemPayments)!;
        const data = await loader.fetch(new LimitedFilteredRequest({
            filter: this.sliceFilter,
            search: this.search,
            limit: 100,
            sort: [{ key: 'id', order: SortItemDirection.ASC }],
        }));

        // Only the first page is added up, so a fixture that outgrows it would silently assert too little
        expect(data.next).toBeUndefined();

        const rows = data.results as { balanceItemPayment: { price: number } }[];

        this.result = {
            count: rows.length,
            price: rows.reduce((total, row) => total + row.balanceItemPayment.price, 0),
        };

        return new Response(undefined);
    }
}

/**
 * How many balance item payments a filter selects, and what they are worth together.
 */
export async function exportSlice({ organization, user, filter, search = null }: { organization: Organization; user: User; filter: StamhoofdFilter; search?: string | null }) {
    const token = await Token.createToken(user);

    const request = Request.get({
        path: '/exports/balance-item-payments',
        host: organization.getApiHost(),
        headers: { authorization: 'Bearer ' + token.accessToken },
    });

    const endpoint = new ExportSliceEndpoint(filter, search);
    await testServer.test(endpoint, request);

    return endpoint.result;
}
