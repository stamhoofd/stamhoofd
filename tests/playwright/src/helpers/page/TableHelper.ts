import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { Formatter } from '@stamhoofd/utility';

type HasTextFilter = string | RegExp | undefined;

export class TableHelper {
    private readonly locator: Locator;

    constructor(readonly page: Page) {
        this.locator = page.getByTestId('table');
    }

    async toggleSelectAllRows() {
        await this.locator
            .getByTestId('table-head')
            .getByTestId('checkbox')
            .click();
    }

    async waitForFirstRow() {
        return this.locator.getByTestId('table-row').first().waitFor();
    }

    getRow(hasText: string) {
        return this.locator.getByTestId('table-row').filter({
            hasText,
        });
    }

    async toggleSelectRow(hasText: string) {
        await this.getRow(hasText).getByTestId('checkbox').click();
    }

    private async clickMoreButton() {
        await this.page.getByTestId('more-button').click();
    }

    async clickActions(actions: HasTextFilter[]) {
        await this.clickMoreButton();

        for (const [index, action] of actions.entries()) {
            const button = this.page
                .getByTestId('context-menu-item-title')
                .filter({ hasText: typeof action === 'string' ? new RegExp('^\\s*' + Formatter.escapeRegex(action) + '\\s*$') : action });
            await button
                .click();

            if (index === actions.length - 1) {
                await expect(button).not.toBeVisible();
            }
        }
    }

    async clickAction(hasText?: HasTextFilter) {
        await this.clickActions([hasText]);
    }

    getOfflineIcon() {
        return this.page.getByTestId('offline-icon');
    }
}
