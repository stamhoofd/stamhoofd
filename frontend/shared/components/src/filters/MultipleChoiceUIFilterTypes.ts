import type { StamhoofdFilter } from '@stamhoofd/structures';

export class MultipleChoiceUIFilterOption {
    name: string;
    value: StamhoofdFilter;

    constructor(name: string, value: StamhoofdFilter) {
        this.name = name;
        this.value = value;
    }
}

export interface MultipleChoiceUIFilterEditor {
    selectedOptions: MultipleChoiceUIFilterOption[];
    configuration: {
        showOptionSelectAll: boolean;
    };
    builder: {
        multipleChoiceOptions: MultipleChoiceUIFilterOption[];
    };
}
