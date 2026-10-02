import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { Formatter, sleep } from '@stamhoofd/utility';

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
                .filter({ hasText: typeof action === 'string' ? exactText(action) : action });

            // Animation messes with hover position
            await waitForAnimationEnd(button);

            if (index === actions.length - 1) {
                await button
                    .click();
                await expect(button).not.toBeVisible();
            } else {
                await button.hover();
                await expect(button).toBeVisible();
            }
        }
    }

    async clickAction(hasText?: HasTextFilter) {
        await this.clickActions([hasText]);
    }

    /**
     * Sort the table on a column via the 'Sorteren' table action. That menu lists every sortable
     * column, also the ones that are not visible, and it keeps the current sort direction unless
     * the table is already sorted on the column (then the direction is reversed).
     */
    async sortBy(columnName: string) {
        await this.clickMoreButton();

        const sortAction = this.page
            .getByTestId('context-menu-item-title')
            .filter({ hasText: exactText('Sorteren') });

        // Animation messes with hover position
        await waitForAnimationEnd(sortAction);
        await sortAction.hover();

        // The columns are listed in a submenu of the actions menu
        const column = this.page
            .locator('.context-menu-container.hasParent')
            .getByTestId('context-menu-item')
            .filter({ hasText: exactText(columnName) });

        await waitForAnimationEnd(column);
        await column.click();

        // Both menus close again
        await expect(this.page.getByTestId('context-menu-item')).toHaveCount(0);
    }

    /**
     * Scroll down until the end of the table, so every next page has to be loaded while scrolling.
     */
    async scrollToBottom() {
        await this.scrollUntilStopped(500);
    }

    async scrollToTop() {
        await this.scrollUntilStopped(-500);
    }

    private async scrollUntilStopped(deltaY: number) {
        // The head stays in place while scrolling, so it is a stable position for the wheel events
        await this.locator.getByTestId('table-head').hover();

        let previousScrollTop: number | null = null;

        // Scrolling can be animated, so only stop after two samples without any movement
        let stoppedCount = 0;

        for (let step = 0; step < 100; step++) {
            const scrollTop = await this.getScrollTop();
            if (scrollTop === previousScrollTop) {
                stoppedCount += 1;
                if (stoppedCount >= 2) {
                    return;
                }
            } else {
                stoppedCount = 0;
            }
            previousScrollTop = scrollTop;

            await this.page.mouse.wheel(0, deltaY);

            // Give the table time to render the rows that became visible
            await sleep(100);
        }

        throw new Error('The table did not stop scrolling');
    }

    /**
     * The table doesn't scroll itself: it grows inside the first scrollable ancestor. Mirrors
     * getScrollElement of ModernTableView.
     */
    private getScrollTop(): Promise<number> {
        return this.locator.getByTestId('table-head').evaluate((head: HTMLElement) => {
            const scrollable = ['scroll', 'auto', 'overlay'];
            let element: HTMLElement | null = head;

            while (element) {
                const style = window.getComputedStyle(element);
                if (scrollable.includes(style.overflowY) || scrollable.includes(style.overflow)) {
                    return element.scrollTop;
                }
                element = element.parentElement;
            }

            return document.documentElement.scrollTop;
        });
    }

    getOfflineIcon() {
        return this.page.getByTestId('offline-icon');
    }

    getErrorBox() {
        return this.locator.locator('.error-box');
    }
}

function exactText(text: string): RegExp {
    return new RegExp('^\\s*' + Formatter.escapeRegex(text) + '\\s*$');
}

export async function waitForAnimationEnd(locator: Locator) {
    const handle = await locator.elementHandle();
    await handle?.waitForElementState('stable');
    await handle?.dispose();
}
