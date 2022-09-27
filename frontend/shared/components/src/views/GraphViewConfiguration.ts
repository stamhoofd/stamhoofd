import { Graph } from "@stamhoofd/structures"

import { DateOption } from "./DateRange"

export class GraphViewConfiguration {
    title = ""
    sum = true
    formatter: ((value: number) => string) | null = null
    options: DateOption[] | null = null
    selectedRange: DateOption | null = null
    load: (range: DateOption) => Promise<Graph>

    constructor(options: Partial<GraphViewConfiguration>) {
        Object.assign(this, options)
    }
}