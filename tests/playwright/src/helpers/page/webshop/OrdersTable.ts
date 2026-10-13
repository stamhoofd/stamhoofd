import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { Formatter } from '@stamhoofd/utility';
import { TableHelper, waitForAnimationEnd } from '../TableHelper.js';

export type StringFilterMode = 'Is gelijk aan...' | 'Is niet gelijk aan...' | 'Bevat...' | 'Bevat niet...' | 'Is leeg' | 'Is niet leeg';
export type NumberFilterMode = 'Gelijk aan...' | 'Niet gelijk aan...' | 'Groter dan...' | 'Groter dan of gelijk aan...' | 'Kleiner dan...' | 'Kleiner dan of gelijk aan...';

/**
 * The orders table of a webshop, read and driven like a user would.
 */
export class OrdersTable extends TableHelper {
    constructor(page: Page) {
        super(page);
    }

    /**
     * Scrolls through the whole table and returns the text of the cells of every row, in the order of the table.
     * Every row has loaded before it is read, so this also covers loading the next pages.
     */
    async readAllRows(): Promise<string[][]> {
        const table = this.page.getByTestId('table');
        const rows = new Map<number, string[]>();

        // Without results the table shows a message instead of rows
        const emptyMessage = table.locator('.info-box');
        await expect(table.getByTestId('table-row').or(emptyMessage).first()).toBeAttached();
        if (await emptyMessage.isVisible()) {
            return [];
        }

        await this.scrollTo('top');

        for (let step = 0; step < 1000; step++) {
            // Rows that did not load yet show placeholders
            await expect(table.getByTestId('table-row').filter({ visible: true }).locator('.placeholder-skeleton')).toHaveCount(0, { timeout: 30_000 });

            const visible = await table.getByTestId('table-row').filter({ visible: true }).evaluateAll((elements: HTMLElement[]) => {
                return elements.map((element) => {
                    const y = Number(/translateY\((-?[\d.]+)px\)/.exec(element.style.transform)?.[1] ?? '0');
                    const cells = [...element.querySelectorAll(':scope > .prefix-column, :scope > .columns > div')].map(cell => (cell.textContent ?? '').trim());
                    return { y, cells };
                });
            });
            for (const { y, cells } of visible) {
                rows.set(y, cells);
            }

            if (await this.scrollTo('next')) {
                break;
            }
        }

        return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, cells]) => cells);
    }

    /**
     * The customer names of all rows, in the order of the table. Every row must show one of the given names.
     */
    async readNames(names: string[]): Promise<string[]> {
        const known = new Set(names);
        const rows = await this.readAllRows();
        return rows.map((cells) => {
            const name = cells.find(cell => known.has(cell));
            if (name === undefined) {
                throw new Error('Row without a known name: ' + JSON.stringify(cells));
            }
            return name;
        });
    }

    /**
     * The amount of orders in the title, as a number ('12' or '12 van 40' gives 12).
     */
    async readCount(): Promise<number> {
        const text = (await this.getResultCount().textContent()) ?? '';
        return Number(text.trim().split(' ')[0].replace(/\./g, ''));
    }

    /**
     * Waits until the count in the title is final: the count of the current search and filter.
     */
    async expectCount(count: number, total?: number) {
        const formatted = Formatter.integer(count);
        await expect(this.getResultCount()).toHaveText(total === undefined ? formatted : `${formatted} van ${Formatter.integer(total)}`);
    }

    /**
     * Sorts the table on a column in the given direction, through the 'Sorteren' menu.
     */
    async sortOn(columnName: string, direction: 'ASC' | 'DESC') {
        for (let attempt = 0; attempt < 3; attempt++) {
            const column = await this.openSortMenu(columnName);
            const current = await column.locator('.icon.arrow-up-small').count() > 0
                ? 'ASC'
                : (await column.locator('.icon.arrow-down-small').count() > 0 ? 'DESC' : null);

            if (current === direction) {
                await this.page.keyboard.press('Escape');
                await expect(this.page.getByTestId('context-menu-item')).toHaveCount(0);
                return;
            }

            // Selecting the sorted column reverses the direction, another column keeps it
            await column.click();
            await expect(this.page.getByTestId('context-menu-item')).toHaveCount(0);
        }
        throw new Error(`Could not sort on ${columnName} ${direction}`);
    }

    /**
     * Opens the 'Sorteren' submenu of the actions menu and returns the item of the column.
     */
    private async openSortMenu(columnName: string) {
        await this.page.getByTestId('more-button').click();
        const sortAction = this.page.getByTestId('context-menu-item-title').filter({ hasText: exactText('Sorteren') });
        await waitForAnimationEnd(sortAction);

        // The submenu opens next to the menu on hover, or replaces it after a tap on a touch screen
        const column = this.page.getByTestId('context-menu-item').filter({ hasText: exactText(columnName) }).last();
        await sortAction.hover();
        if (!await column.isVisible()) {
            await sortAction.click();
        }
        await waitForAnimationEnd(column);
        return column;
    }

    async addStringFilter(filterName: string, mode: StringFilterMode, value?: string) {
        await this.openFilterEditor(filterName);
        await this.page.locator('label').filter({ hasText: exactText(mode) }).click();
        if (value !== undefined) {
            await this.page.locator('input.input.option').fill(value);
        }
        await this.applyFilterEditor();
    }

    async addNumberFilter(filterName: string, mode: NumberFilterMode, value: number) {
        await this.openFilterEditor(filterName);
        // The label of the selected mode also contains its input
        await this.page.locator('label').filter({ hasText: new RegExp('^\\s*' + Formatter.escapeRegex(mode)) }).click();
        const input = this.page.locator('.option input').first();
        await input.fill(value.toString());
        await input.blur();
        await this.applyFilterEditor();
    }

    async addChoiceFilter(filterName: string, choices: string[]) {
        await this.openFilterEditor(filterName);
        for (const choice of choices) {
            await this.page.locator('label').filter({ hasText: exactText(choice) }).click();
        }
        await this.applyFilterEditor();
    }

    /**
     * The row of the order of this customer (an exact match on the name column, unlike getRow).
     */
    getOrderRow(name: string) {
        return this.page.getByTestId('table').getByTestId('table-row').filter({
            visible: true,
            has: this.page.locator('.columns > div').filter({ hasText: exactText(name) }),
        });
    }

    /**
     * Selects the orders of these customers, and only those. Each one is searched, because the table only renders
     * the rows near the screen; the search is cleared again afterwards.
     */
    async selectRows(names: string[]) {
        await this.clearSelection();
        for (const name of names) {
            await this.search(name);
            await this.getOrderRow(name).getByTestId('checkbox').click();
        }
        await this.search('');
    }

    /**
     * Searches the order of this customer and checks the text of its row.
     */
    async expectOrderRowText(name: string, text: string) {
        await this.search(name);
        await expect(this.getOrderRow(name)).toContainText(text);
        await this.search('');
    }

    async clearSelection() {
        const checkbox = this.page.getByTestId('table-head').getByTestId('checkbox');
        for (let attempt = 0; attempt < 3; attempt++) {
            const { checked, indeterminate } = await checkbox.locator('input').evaluate((input: HTMLInputElement) => ({ checked: input.checked, indeterminate: input.indeterminate }));
            if (!checked && !indeterminate) {
                return;
            }
            await checkbox.click();
        }
        throw new Error('Could not clear the selection');
    }

    async changeStatus(names: string[], statusName: string) {
        await this.selectRows(names);
        await this.clickActions(['Wijzig status', statusName]);
    }

    async changeTicketStatus(names: string[], ticketStatusName: 'Gescand' | 'Niet gescand') {
        await this.selectRows(names);
        await this.clickActions(['Wijzig ticketstatus', ticketStatusName]);
    }

    async deleteOrders(names: string[]) {
        await this.selectRows(names);
        await this.clickActions(['Verwijderen']);
        await this.page.locator('label').filter({ hasText: 'Ja, ik begrijp het' }).click();
        await this.page.getByRole('button', { name: 'Verwijderen', exact: true }).click();
    }

    private async openFilterEditor(filterName: string) {
        await this.page.getByTestId('table').locator('button.button.text').filter({ hasText: exactText('Filter') }).click();
        await this.page.locator('h3.style-title-list').filter({ hasText: exactText(filterName) }).click();
    }

    private async applyFilterEditor() {
        const apply = this.page.getByRole('button', { name: 'Toepassen' });
        await apply.click();

        // A popup closes with Escape, a full screen sheet (on a phone) shows the list of filters with its own button
        await this.page.waitForTimeout(500);
        if (await apply.isVisible()) {
            await apply.click();
        } else {
            await this.page.keyboard.press('Escape');
        }
        await expect(this.page.getByTestId('table').locator('input[name="search"]')).toBeVisible();
    }

    /**
     * Scrolls the element the table grows in. 'next' scrolls one screen down and returns true if the end was already reached.
     */
    private async scrollTo(position: 'top' | 'next'): Promise<boolean> {
        const atEnd = await this.page.getByTestId('table-head').evaluate((head: HTMLElement, position) => {
            const scrollable = ['scroll', 'auto', 'overlay'];
            let element: HTMLElement | null = head;
            while (element) {
                const style = window.getComputedStyle(element);
                if (scrollable.includes(style.overflowY) || scrollable.includes(style.overflow)) {
                    break;
                }
                element = element.parentElement;
            }
            const scroller = element ?? document.scrollingElement as HTMLElement;

            if (position === 'top') {
                scroller.scrollTop = 0;
                return false;
            }
            if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1) {
                return true;
            }
            scroller.scrollTop += Math.floor(scroller.clientHeight * 0.8);
            return false;
        }, position);

        // Give the table a frame to render the rows that became visible
        await this.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        return atEnd;
    }
}

function exactText(text: string): RegExp {
    return new RegExp('^\\s*' + Formatter.escapeRegex(text) + '\\s*$');
}
