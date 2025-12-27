import { BrowserContext, Page } from "@playwright/test";

export class PageAuthenticator {
    private _page: Page;
    private _context: null | BrowserContext = null;

    get page(): Page {
        return this._page;
    }

    constructor(initialPage: Page) {
        this._page = initialPage;
    }

    async newPageWithStorageState(storageState: string) {
        const browser = this._page.context().browser();

        if (!browser) {
            throw new Error("No browser found");
        }

        const context = await browser.newContext({
            storageState,
        });

        this._context = context;

        if (context) {
            const newPage = await context.newPage();
            await this._page.close();
            this._page = newPage;
        }
    }

    async teardown() {
        if(this._context) {
            await this._context.close();
        }
    }
}
