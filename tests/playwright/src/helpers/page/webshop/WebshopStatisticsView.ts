import type { Locator, Page } from '@playwright/test';

export class WebshopStatisticsView {
    constructor(public readonly page: Page) {
    }

    get view(): Locator {
        return this.page.getByTestId('webshop-statistics-view');
    }

    get ordersCount(): Locator {
        return this.view.getByTestId('statistics-orders-count');
    }

    get averageOrderPrice(): Locator {
        return this.view.getByTestId('statistics-orders-average');
    }

    get ticketsCount(): Locator {
        return this.view.getByTestId('statistics-tickets-count');
    }

    get scannedTicketsCount(): Locator {
        return this.view.getByTestId('statistics-tickets-scanned');
    }

    /**
     * Total of the graph that is currently selected (the revenue over all time by default).
     */
    get graphTotal(): Locator {
        return this.view.getByTestId('graph').getByTestId('graph-value');
    }

    get fetchErrorToast(): Locator {
        return this.page.getByTestId('statistics-fetch-error-toast');
    }

    getProductAmount(productName: string): Locator {
        return this.view
            .getByTestId('statistics-product-row')
            .filter({ hasText: productName })
            .getByTestId('statistics-product-amount');
    }

    async close() {
        await this.view.getByTestId('close-button').click();
        await this.view.waitFor({ state: 'detached' });
    }
}
