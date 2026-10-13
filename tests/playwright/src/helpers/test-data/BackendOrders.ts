import type { Page } from '@playwright/test';
import type { Organization, User } from '@stamhoofd/models';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import type { SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { CountFilteredRequest, LimitedFilteredRequest, mergeFilters, OrderStatus, SortItemDirection, Version } from '@stamhoofd/structures';
import { WorkerData } from '../worker/WorkerData.js';

/**
 * Reads orders through the backend endpoints, the way an e-mail or Mailchimp sync selects them: with the
 * same filter and search as the orders table, and the same required filter the table adds.
 */
export class BackendOrders {
    private accessToken: string | null = null;

    constructor(private readonly page: Page, private readonly organization: Organization, private readonly user: User) {}

    /**
     * The order numbers the backend returns, in the order of the backend (all pages).
     */
    async getNumbers(options: { webshopId: string; filter?: StamhoofdFilter | null; search?: string | null; sort?: SortList }): Promise<number[]> {
        const sort = options.sort ?? [{ key: 'number', order: SortItemDirection.DESC }];
        let query: Record<string, unknown> | null = new LimitedFilteredRequest({
            filter: this.getFilter(options.webshopId, options.filter ?? null),
            search: options.search ?? null,
            sort: [...sort, ...(sort.some(s => s.key === 'id') ? [] : [{ key: 'id', order: sort[0].order }])],
            limit: 100,
        }).encode({ version: Version }) as Record<string, unknown>;

        const numbers: number[] = [];
        while (query) {
            const response = await this.request('/webshop/orders', query) as { results: { number: number }[]; next?: Record<string, unknown> };
            numbers.push(...response.results.map(o => o.number));
            query = response.next ?? null;
        }
        return numbers;
    }

    async getCount(options: { webshopId: string; filter?: StamhoofdFilter | null; search?: string | null }): Promise<number> {
        const query = new CountFilteredRequest({
            filter: this.getFilter(options.webshopId, options.filter ?? null),
            search: options.search ?? null,
        }).encode({ version: Version }) as Record<string, unknown>;
        const response = await this.request('/webshop/orders/count', query) as { count: number };
        return response.count;
    }

    /**
     * The filter of the orders table: the given one, combined with OrderRequiredFilterHelper.getDefault.
     */
    private getFilter(webshopId: string, filter: StamhoofdFilter | null): StamhoofdFilter | null {
        return mergeFilters([filter, { webshopId, status: { $neq: OrderStatus.Deleted } }]);
    }

    private async request(path: string, query: Record<string, unknown>): Promise<unknown> {
        if (!this.accessToken) {
            this.accessToken = (await SessionService.createSession(this.user)).accessToken;
        }

        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined && value !== null) {
                params.set(key, typeof value === 'string' ? value : JSON.stringify(value));
            }
        }

        const apiHost = new URL(WorkerData.urls.api).host;
        const url = `https://${this.organization.id}.${apiHost}/v${Version}${path}?${params.toString()}`;

        // Requested from the page, which resolves the test domains
        return await this.page.evaluate(async ({ url, accessToken }) => {
            const response = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } });
            if (!response.ok) {
                throw new Error(`${response.status} ${await response.text()}`);
            }
            return await response.json() as unknown;
        }, { url, accessToken: this.accessToken });
    }
}
