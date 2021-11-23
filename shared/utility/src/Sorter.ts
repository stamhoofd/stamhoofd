
export class Sorter {
    static byID( a: {id: string}, b: {id: string} ) {
        if ( a.id < b.id ){
            return -1;
        }
        if ( a.id > b.id ){
            return 1;
        }
        return 0;
    }

    static byStringProperty<Field extends keyof any >( a: Record<Field, string>, b: Record<Field, string>, field: Field ) {
        return this.byStringValue(a[field], b[field])
    }

    static byNumberProperty<Field extends keyof any >( a: Record<Field, number>, b: Record<Field, number>, field: Field ) {
        return this.byNumberValue(a[field], b[field])
    }

    static byStringValue( a: string, b: string ) {
        const af = a.toLowerCase()
        const bf = b.toLowerCase()

        if ( af > bf ){
            return 1;
        }
        if ( af < bf ){
            return -1;
        }
        return 0;
    }

    static byBooleanValue( a: boolean, b: boolean) {
        if (a === b) {
            return 0
        }
        if (a && !b) {
            return -1
        }
        return 1
    }

    /**
     * Sort from large to small - DESC
     */
    static byNumberValue( a: number, b: number) {
        if (a === b) {
            return 0
        }
        if (a > b) {
            return -1
        }
        return 1
    }

    /**
     * Sort from new to old - DESC
     */
    static byDateValue( a: Date, b: Date) {
        if (a === b) {
            return 0
        }
        if (a > b) {
            return -1
        }
        return 1
    }

    /**
     * Return the first non zero value from a list, or zero if all values are zero
     */
    static stack(...sortResults: (0 | 1 | -1)[]) {
        while(sortResults.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const f = sortResults.shift()!
            if (f != 0) {
                return f
            }
        }
        return 0
    }

    static getMostOccuringElement<T>(array: T[]): T | undefined {
        const counts = new Map<T, number>()
        for (const element of array) {
            const count = counts.get(element)
            if (count) {
                counts.set(element, count + 1)
            } else {
                counts.set(element, 1)
            }
        }
        let maxCount = 0
        let mostOccuringElement: T | undefined
        for (const [element, count] of counts) {
            if (count > maxCount) {
                maxCount = count
                mostOccuringElement = element
            }
        }
        return mostOccuringElement
    }
}