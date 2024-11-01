import { Graph } from '@stamhoofd/structures';

import { DateOption } from './DateRange';

export class GraphViewConfiguration {
    title = '';
    sum = true;
    formatter: ((value: number) => string) | null = null;
    options: DateOption[] | null = null;
    selectedRange: DateOption | null = null;
    load: (range: DateOption) => Promise<Graph>;

    constructor(options: Partial<GraphViewConfiguration>) {
        Object.assign(this, options);
    }

    setOptions(options: DateOption[]) {
        this.options = options;
        this.selectedRange = options[0];
    }

    selectRange(range: DateOption | null) {
        if (range === null) {
            this.selectedRange = null;
            return;
        }

        if (this.options && this.options.includes(range)) {
            this.selectedRange = range;
            return;
        }

        console.error(`Date option with name ${range.name} is not included in the graph view options.`);
    }
}
