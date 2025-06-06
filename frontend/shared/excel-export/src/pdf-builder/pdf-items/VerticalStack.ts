import { PdfFont } from '../pdf-font';
import { PdfItem, PdfItemDrawOptions, PdfItemGetHeightOptions } from '../pdf-item';

/**
 * A group of pdf items that are drawn in a vertical stack.
 * This makes it possible to set a max width.
 */
export class VerticalStack implements PdfItem {
    /**
     *
     * @param items the items in the container
     * @param maxWidth the max width of the container
     */
    constructor(private readonly items: PdfItem[], private readonly maxWidth?: number) {
    }

    splitVertical(doc: PDFKit.PDFDocument, options: PdfItemGetHeightOptions, maxHeight: number): VerticalStack[] {
        let currentHeight = 0;
        const containers: VerticalStack[] = [];
        const itemGroup: PdfItem[] = [];

        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            const itemHeight = item.getHeight(doc, options);

            if (currentHeight + itemHeight > maxHeight) {
                containers.push(new VerticalStack(itemGroup, this.maxWidth));
                // itemGroup = [item];
                // currentHeight = itemHeight;
                // if(i < this.items.length - 1) {

                // }
                containers.push(new VerticalStack(this.items.slice(i), this.maxWidth));
                break;
            }
            else {
                itemGroup.push(item);
                currentHeight += itemHeight;
            }
        }

        if (containers.length === 0) {
            containers.push(new VerticalStack(itemGroup, this.maxWidth));
        }

        // for (const item of this.items) {
        //     const itemHeight = item.getHeight(doc, options);

        //     if (currentHeight + itemHeight > maxHeight) {
        //         containers.push(new VerticalStack(itemGroup, this.maxWidth));
        //         itemGroup = [item];
        //         currentHeight = itemHeight;
        //     }
        //     else {
        //         itemGroup.push(item);
        //         currentHeight += itemHeight;
        //     }
        // }

        // if (itemGroup.length > 0) {
        //     containers.push(new VerticalStack(itemGroup, this.maxWidth));
        // }

        return containers;
    }

    draw(doc: PDFKit.PDFDocument, options?: PdfItemDrawOptions): void {
        const _options = { ...options };
        const originalX = options?.position?.x === undefined ? doc.x : options.position.x;

        if (this.maxWidth !== undefined) {
            if (options?.maxWidth !== undefined) {
                _options.maxWidth = Math.min(this.maxWidth, options.maxWidth);
            }
            else {
                _options.maxWidth = this.maxWidth;
            }
        }

        this.items.forEach((item, index) => {
            item.draw(doc, _options);

            if (index === 0) {
                _options.position = {
                    x: originalX,
                    y: undefined,
                };
            }
        });
    }

    getHeight(doc: PDFKit.PDFDocument, options: PdfItemGetHeightOptions = {}): number {
        return this.items.reduce((acc, item) => acc + item.getHeight(doc, options), 0);
    }

    getWidth(_doc: PDFKit.PDFDocument): number | undefined {
        return this.maxWidth;
    }

    getFonts(): PdfFont[] {
        return this.items.flatMap(item => item.getFonts ? item.getFonts() : []);
    }
}
