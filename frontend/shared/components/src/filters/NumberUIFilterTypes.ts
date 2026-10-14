import type { NumberFilterFormat } from './NumberFilterFormat.ts';
import type { UINumberFilterMode } from './UINumberFilterMode.ts';

export interface NumberUIFilterEditor {
    id: string;
    value: number;
    mode: UINumberFilterMode;
    builder: {
        type: NumberFilterFormat;
        floatingPoint: boolean;
    };
}
