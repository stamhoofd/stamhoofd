export class Column<T> {
    name: string
    enabled = true
    index = 0
    getValue: (val: T) => string
    compare: (a: T, b: T) => number

    constructor(settings: {
        name: string, 
        index?: number,
        enabled?: boolean,
        getValue: (val: T) => string, 
        compare: (a: T, b: T) => number,
        grow?: number,
        minimumWidth?: number,
        recommendedWidth?: number,
    }) {
        this.enabled = settings.enabled ?? true
        this.index = settings.index ?? 0
        this.name = settings.name
        this.getValue = settings.getValue
        this.compare = settings.compare
        this.grow = settings?.grow ?? 1
        this.minimumWidth = settings?.minimumWidth ?? 100
        this.recommendedWidth = settings?.recommendedWidth ?? 100

        this.width = this.recommendedWidth
    }

    get id() {
        return this.name
    }

    didReachMinimum() {
        return this.width && this.width <= this.minimumWidth
    }

    /**
     * null means: generate width + save it,  based on grow property
     */
    width: number | null = null

    /**
     * renderWidth is floored version of width, to use in CSS
     */
    renderWidth: number | null = null

    /**
     * Minimum width in pixels. Best minimum is 100, because this is needed for sort icon + drag handle + padding
     */
    minimumWidth = 100

    recommendedWidth = 100

    /**
     * Used for default width (behaves like flex-grow)
     * and for resizing
     */
    grow = 1
}