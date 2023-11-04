export class Column<T, ValueType> {
    name: string
    enabled = true
    index = 100
    id: string
    align?: "left" | "right" | "center"

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
     * When growing, columns with grow = true will only grow (if all other columns have reached the recommended size)
     */
    grow = false

    private getValue: (val: T) => ValueType
    private format: (val: ValueType, width: number) => string

    /**
     * Implement if you need the full object to compare
     */
    private compareObjects: ((a: T, b: T) => number) | null

    /**
     * Compare values using the return value of getValue
     * This is more performant because we can use caching
     */
    private compare: ((a: ValueType, b: ValueType) => number) | null

    private getStyleForObject: ((val: T, isPrefix: boolean) => string) | null = null
    private getStyle: ((val: ValueType, isPrefix: boolean) => string) | null = null

    constructor(settings: {
        name: string, 
        id?: string,
        index?: number,
        align?: "left" | "right" | "center",
        enabled?: boolean,
        getValue: (val: T) => ValueType, 
        format?: (val: ValueType, width: number) => string, 
        compareObjects?: (a: T, b: T) => number,
        compare?: (a: ValueType, b: ValueType) => number,
        getStyle?: (val: ValueType, isPrefix: boolean) => string,
        getStyleForObject?: (val: T, isPrefix: boolean) => string,
        grow?: boolean,
        minimumWidth?: number,
        recommendedWidth?: number,
    }) {
        this.enabled = settings.enabled ?? true
        this.index = settings.index ?? 100
        this.name = settings.name
        this.id = settings.id ?? settings.name;

        this.getValue = settings.getValue
        this.format = settings.format ?? (val => val+"")

        this.compare = settings.compare ?? null
        this.compareObjects = settings.compareObjects ?? null
        this.getStyle = settings.getStyle ?? null
        this.getStyleForObject = settings.getStyleForObject ?? null

        this.grow = settings?.grow ?? false
        this.minimumWidth = settings?.minimumWidth ?? 100
        this.recommendedWidth = settings?.recommendedWidth ?? 100
        this.align = settings.align

        this.width = this.recommendedWidth
    }

    getFormattedValue(val: T) {
        return this.format(this.getValue(val), this.renderWidth ?? this.recommendedWidth)
    }

    doCompare(a: T, b: T): number {
        if (this.compare) {
            return this.compare(this.getValue(a), this.getValue(b))
        } else if (this.compareObjects) {
            return this.compareObjects(a, b)
        } else {
            return 0
        }
    }

    getStyleFor(val: T | null, isPrefix = false) {
        if (val === null) {
            return ""
        }
        return this.getStyleForObject ? this.getStyleForObject(val, isPrefix) : this.getStyle ? this.getStyle(this.getValue(val), isPrefix) : ""
    }

    didReachMinimum() {
        return this.width && this.width <= this.minimumWidth
    }
}