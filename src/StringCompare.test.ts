import { StringCompare } from "./StringCompare";

describe("StringCompare", () => {
    test("Ignore special characters", () => {
       expect(StringCompare.typoCount("semôn", "Sémon")).toEqual(0)
    })

    test("Missing characters", () => {
        expect(StringCompare.typoCount("Simon", "Smon")).toEqual(1)
        expect(StringCompare.typoCount("Smon", "Simon")).toEqual(1)

        expect(StringCompare.typoCount("Simon", "Son")).toEqual(2)
        expect(StringCompare.typoCount("Son", "Simon")).toEqual(2)
    });

    test("Extra characters", () => {
        expect(StringCompare.typoCount("Simon", "Simond")).toEqual(1)
        expect(StringCompare.typoCount("Simond", "Simon")).toEqual(1)
    });

    test("Typo", () => {
        expect(StringCompare.typoCount("Simon", "Samon")).toEqual(1)
        expect(StringCompare.typoCount("Samon", "Simon")).toEqual(1)
    });

    test("Completely different strings", () => {
        expect(StringCompare.typoCount("Simon", "Sandra")).toEqual(4)
    });

     test("Compare to empty", () => {
        expect(StringCompare.typoCount("Simon", "")).toEqual(5)
        expect(StringCompare.typoCount("", "simon")).toEqual(5)
    });
});
