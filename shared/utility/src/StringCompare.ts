import { Formatter } from "./Formatter";

export class StringCompare {
    /**
     * Return the search score = percentage (floating point) that matches.
     * Returns zero if no match is found or if minimum percentage is not met
     */
    static contains(haystack: string, needle: string): boolean {
        haystack = haystack.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/, " ").trim();
        needle = needle.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/, " ").trim();

        return haystack.includes(needle)
    }

    /**
     * Return the search score = percentage (floating point) that matches.
     * Returns zero if no match is found or if minimum percentage is not met
     */
    static searchScore(haystack: string, needle: string, minimumPercentage: number | null = 10, minimumChars: number | null = 2): number {
        if (haystack.length == 0) {
            return 0
        }

        haystack = haystack.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/, " ").trim();
        needle = needle.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/, " ").trim();

        const overlap = this.compare(needle, haystack)

        if ((minimumChars == null || overlap > minimumChars) && (minimumPercentage === null || overlap >= haystack.length * minimumPercentage / 100)) {
            return overlap
        }
        return 0
    }
    
    /**
     * Return the amount of characters that are equal (allowing to detect typo's)
     */
    static compare(left: string, right: string, allowSplit = true): number {
        if (left.length == 0 || right.length == 0) {
            return 0;
        }

        const firstLeft = left[0]
        const firstRight = right[0]

        if (firstLeft == firstRight) {
            return 1 + this.compare(left.substr(1), right.substr(1), true)
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

    static matchCount(original: string, compareWith: string): number {
        // remove special chars + lowercase
        original = original.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/, " ").trim();
        compareWith = compareWith.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/, " ").trim();
        return this.compare(original, compareWith)
    }

    static typoCount(original: string, compareWith: string): number {
        // remove special chars + lowercase
        original = original.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/, " ").trim();
        compareWith = compareWith.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/, " ").trim();
        return Math.max(original.length, compareWith.length) - this.compare(original, compareWith)
    }

    /**
     * Return true if the user typed in full caps (sigh)
     */
    static isFullCaps(str: string): boolean {
        const fn = Formatter.removeAccents(str)
        if (fn.toUpperCase() == fn) {
            return true
        }
        return false
    }
}