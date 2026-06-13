import type { Country } from './Country.js';

export type Localized<T> = {
    readonly [k in Country]?: T;
} & {
    /// default is reserved, so we need to use something else (an empty string)
    readonly '': T;
};

export type LocalizedDomain = Localized<string>;
