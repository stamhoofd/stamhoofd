import { PdfDocWrapper } from '../PdfDocWrapper';
import { PdfFont } from '../PdfFont';
import { PdfItem, PdfItemDrawOptions, PdfItemGetHeightOptions } from '../PdfItem';

export interface VerticalStackOptions {
    /**
     * The max width of the stack
     */
    maxWidth?: number;

    /**
     * Place on another page if the available height is less than this (unless the total height of the stack is less).
     */
    minAvailableHeight?: number;
}

/**
 * A group of pdf items to be drawn vertically.
 * This makes it possible to set a max width or to split the stack if necessary.
 */
export class VerticalStack implements PdfItem {
    /**
     * The number of items in the stack
     */
    get size(): number {
        return this.items.length;
    }

    /**
     *
     * @param items the items in the vertical stack
     * @param maxWidth the max width of the vertical stack
     */
    constructor(private readonly items: PdfItem[], private readonly options: VerticalStackOptions = {}) {
    }

    /**
     * Split the vertical stack in two separate vertical stacks.
     * @param docWrapper
     * @param options
     * @param maxHeight max height of the first stack
     * @returns one or two stacks (one if the max height is not exceeded)
     */
    split(docWrapper: PdfDocWrapper, options: PdfItemGetHeightOptions, maxHeight: number): VerticalStack[] {
        let currentHeight = 0;
        const stacks: VerticalStack[] = [];
        const itemsInFirstStack: PdfItem[] = [];

        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            const itemHeight = item.getHeight(docWrapper, options);

            // if the total height of the first stack will exceed the max height
            if (currentHeight + itemHeight > maxHeight) {
                // create the first stack
                stacks.push(new VerticalStack(itemsInFirstStack, this.options));

                // add the remaining items to the second stack
                stacks.push(new VerticalStack(this.items.slice(i), this.options));
                break;
            }
            else {
                itemsInFirstStack.push(item);
                currentHeight += itemHeight;
            }
        }

        // if the total height of all the items did not exceed the max height
        if (stacks.length === 0) {
            return [new VerticalStack(itemsInFirstStack, this.options)];
        }

        return stacks;
    }

    /**
     * Split the stack in equal parts
     * @param docWrapper
     * @param options
     * @param parts the number of parts to split the stack in
     * @returns an array of stacks of (approximately) equal height
     */
    splitInEqualParts(docWrapper: PdfDocWrapper, options: PdfItemGetHeightOptions, parts: number): VerticalStack[] {
        if (parts < 2) {
            throw new Error('parts must be at least 2');
        }

        const heights: number[] = this.items.map(item => item.getHeight(docWrapper, options));
        const totalHeight = heights.reduce((acc, height) => acc + height, 0);
        const maxHeight = Math.ceil(totalHeight / parts);
        const stackItems: PdfItem[][] = [[]];
        let currentHeight = 0;

        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            const itemHeight = heights[i];
            const currentStack = stackItems[stackItems.length - 1];

            // if the total height of the first stack will exceed the max height
            if (currentHeight + itemHeight > maxHeight) {
                stackItems.push([item]);
                currentHeight = 0;
            }
            else {
                currentStack.push(item);
                currentHeight += itemHeight;
            }
        }

        // if there are more stacks than parts
        if (stackItems.length > parts) {
            // remove the last stack
            const lastStack = stackItems.pop();

            // and add it to the new last stack
            if (lastStack) {
                stackItems[stackItems.length - 1].push(...lastStack);
            }
        }

        return stackItems.map(stack => new VerticalStack(stack, this.options));
    }

    draw(docWrapper: PdfDocWrapper, options?: PdfItemDrawOptions): void {
        const _options = { ...options };

        if (this.options.minAvailableHeight !== undefined) {
            // check if sufficient space on page
            const availableHeight = docWrapper.getAvailableHeight();
            if (availableHeight < this.options.minAvailableHeight) {
                const height = this.getHeight(docWrapper, options);
                if (height > availableHeight) {
                    docWrapper.goToNextPage();
                }
            }
        }

        const originalX = docWrapper.getNextPosition(options).x;

        if (this.options.maxWidth !== undefined) {
            if (options?.maxWidth !== undefined) {
                _options.maxWidth = Math.min(this.options.maxWidth, options.maxWidth);
            }
            else {
                _options.maxWidth = this.options.maxWidth;
            }
        }

        this.items.forEach((item, index) => {
            item.draw(docWrapper, _options);

            if (index === 0) {
                _options.position = {
                    x: originalX,
                    y: undefined,
                };
            }
        });
    }

    getHeight(docWrapper: PdfDocWrapper, options: PdfItemGetHeightOptions = {}): number {
        return this.items.reduce((acc, item) => acc + item.getHeight(docWrapper, options), 0);
    }

    getWidth(docWrapper: PdfDocWrapper): number | undefined {
        return this.getWidthHelper(docWrapper, false);
    }

    getMinWidth(docWrapper: PdfDocWrapper): number | undefined {
        return this.getWidthHelper(docWrapper, true);
    }

    getFonts(): PdfFont[] {
        return this.items.flatMap(item => item.getFonts ? item.getFonts() : []);
    }

    private getWidthHelper(docWrapper: PdfDocWrapper, isMinWidth: boolean): number | undefined {
        const maxWidth = this.options.maxWidth;
        let largestWidth = 0;

        for (const item of this.items) {
            let width: number | undefined;

            if (isMinWidth) {
                width = item.getMinWidth ? item.getMinWidth(docWrapper) : item.getWidth(docWrapper);
            }
            else {
                width = item.getWidth(docWrapper);
            }

            // unable to determine width
            if (width === undefined) {
                return maxWidth;
            }

            if (width > largestWidth) {
                largestWidth = width;
            }
        }

        if (maxWidth === undefined) {
            return largestWidth;
        }

        return Math.min(largestWidth, maxWidth);
    }
}
