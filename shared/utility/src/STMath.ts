export class STMath {
    /**
     * Round numbers, but round negative numbers correctly (Math.round(-1.5) rounds to -1 instead of -2)
     */
    static round(val: number) {
        return Math.round(Math.abs(val)) * Math.sign(val);
    }
}
