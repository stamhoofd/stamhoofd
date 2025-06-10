import { PdfDocWrapper } from '../pdf-doc-wrapper';
import { PdfFont } from '../pdf-font';
import { PdfItem, PdfItemDrawOptions, PdfItemGetHeightOptions } from '../pdf-item';

/**
 * A group of pdf items that are drawn in a vertical stack.
 * This makes it possible to set a max width.
 */
export class VerticalStack implements PdfItem {
    /**
     *
     * @param items the items in the vertical stack
     * @param maxWidth the max width of the vertical stack
     */
    constructor(private readonly items: PdfItem[], private readonly maxWidth?: number) {
    }

    /**
     * Split the vertical stack in two separate vertical stacks.
     * @param doc
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
                stacks.push(new VerticalStack(itemsInFirstStack, this.maxWidth));

                // add the remaining items to the second stack
                stacks.push(new VerticalStack(this.items.slice(i), this.maxWidth));
                break;
            }
            else {
                itemsInFirstStack.push(item);
                currentHeight += itemHeight;
            }
        }

        // if the total height of all the items did not exceed the max height
        if (stacks.length === 0) {
            stacks.push(new VerticalStack(itemsInFirstStack, this.maxWidth));
        }

        return stacks;
    }

    draw(docWrapper: PdfDocWrapper, options?: PdfItemDrawOptions): void {
        const _options = { ...options };
        const originalX = docWrapper.getNextPosition(options).x;

        if (this.maxWidth !== undefined) {
            if (options?.maxWidth !== undefined) {
                _options.maxWidth = Math.min(this.maxWidth, options.maxWidth);
            }
            else {
                _options.maxWidth = this.maxWidth;
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

    getWidth(_docWrapper: PdfDocWrapper): number | undefined {
        return this.maxWidth;
    }

    getFonts(): PdfFont[] {
        return this.items.flatMap(item => item.getFonts ? item.getFonts() : []);
    }
}
