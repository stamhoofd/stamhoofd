import { Formatter } from "./Formatter";

export class StringCompare {
    
    /**
     * Return the amount of characters that are equal (allowing to detect typo's)
     */
    static compare(left: string, right: string, allowSplit = true) {
        if (left.length == 0 || right.length == 0) {
            return 0;
        }

        const firstLeft = left[0]
        const firstRight = right[0]

        if (firstLeft == firstRight) {
            return 1 + this.compare(left.substr(1), right.substr(1))
        }

        if (allowSplit) {
            return Math.max(
                this.compare(left, right.substr(1), false),
                this.compare(right, left.substr(1), false),
                this.compare(left.substr(1), right.substr(1), false),
                this.compare(right.substr(1), left.substr(1), false),
            )
        }

        // no split allowed -> continue to remove right side
        return this.compare(left, right.substr(1), false)
    }

    static typoCount(original: string, compareWith: string) {
        // remove special chars + lowercase
        original = original.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/, " ").trim();
        compareWith = compareWith.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/, " ").trim();
        return Math.max(original.length, compareWith.length) - this.compare(original, compareWith)
    }

    /**
     * Return true if the user typed in full caps (sigh)
     */
    static isFullCaps(str: string) {
        const fn = Formatter.removeAccents(str)
        if (fn.toUpperCase() == fn) {
            return true
        }
        return false
    }
}