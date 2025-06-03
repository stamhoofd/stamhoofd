export interface PdfItemValue {
    value: string | number | Date | null;
    // width?: number; // Only works for first row
    // style?: CellStyleRequest;
    // merge?: MergeCells;
}

export type PdfTransformerConcreteItem<T> = {
    id: string;
    name: string;
    category?: string;
    defaultCategory?: string;
    getValue(object: T): PdfItemValue;
};

export type PdfTransformerItem<T> = PdfTransformerConcreteItem<T> | {
    match: (id: string) => (PdfTransformerConcreteItem<T>[] | undefined);
};

export interface PdfTransformerDocument<A, B = A> {
    id: string;
    name: string;
    transform?: (data: A) => B[];
    items: PdfTransformerItem<B>[];
}
