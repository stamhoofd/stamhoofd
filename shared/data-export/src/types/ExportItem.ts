export type ExportItem<T> = {
    name: string;
    getValue: (object: T) => ExportItemValue;
};

export type ExportItemMatch<T> = {
    match: (id: string) => Record<string, ExportItem<T>>;
};

export type ExportItemDictionary<T> = Record<string, ExportItem<T> | ExportItemMatch<T>>;

export type ExportItemValue = string | number | Date | null;
