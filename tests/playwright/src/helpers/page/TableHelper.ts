import { Locator, Page } from "@playwright/test";

type HasTextFilter = string | RegExp | undefined;

export class TableHelper {
    private readonly locator: Locator;

    constructor(readonly page: Page) {
        this.locator = page.getByTestId("table");
    }

    async toggleSelectAllRows() {
        await this.locator
            .getByTestId("table-head")
            .getByTestId("checkbox")
            .click();
    }

    getRow(hasText?: HasTextFilter) {
        return this.locator.getByTestId("table-row").filter({ hasText });
    }

    async toggleSelectRow(hasText?: HasTextFilter) {
        await this.getRow(hasText).getByTestId("checkbox").click();
    }

    private async clickMoreButton() {
        await this.page.getByTestId("more-button").click();
    }

    async clickActions(actions: HasTextFilter[]) {
        await this.clickMoreButton();

        for (const action of actions) {
            await this.page
                .getByTestId("context-menu-item")
                .filter({ hasText: action })
                .click();
        }
    }

    async clickAction(hasText?: HasTextFilter) {
        await this.clickActions([hasText]);
    }
}
