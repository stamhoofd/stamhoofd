export type PdfItemDrawOptions = {
    /**
     * The maximum width of the item.
     */
    maxWidth?: number;
    /**
     * The position on the page where
     * the item should be drawn. Defaults to the current position.
     */
    position?: {
        x?: number;
        y?: number;
    };
};

export type PdfItemGetHeightOptions = {
    maxWidth?: number;
};
