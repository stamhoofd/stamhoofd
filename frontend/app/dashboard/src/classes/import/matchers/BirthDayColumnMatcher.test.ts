import { BirthDayColumnMatcher } from "./BirthDayColumnMatcher";

describe("BirthDayColumnMatcher", () => {

    test("day parsing", () => {
        const matcher = new BirthDayColumnMatcher()
            
        const date = new Date(2018, 5 - 1, 10)
        expect(matcher.parseDate("10/5/2018", false)).toEqual(date)
        expect(matcher.parseDate("10/05/2018", false)).toEqual(date)
        expect(matcher.parseDate("05/10/2018", true)).toEqual(date)
        expect(matcher.parseDate("10/05/18", false)).toEqual(date)
        expect(matcher.parseDate("10-05-18", false)).toEqual(date)
        expect(matcher.parseDate("10 mei 18", false)).toEqual(date)
        expect(matcher.parseDate("10 mei 2018", false)).toEqual(date)
        expect(matcher.parseDate("10 may 2018", false)).toEqual(date)

        const date2 = new Date(1995, 12 - 1, 2)
        expect(matcher.parseDate("2/12/95", false)).toEqual(date2)
        expect(matcher.parseDate("12/2/95", true)).toEqual(date2)
        expect(matcher.parseDate("02/12/95", false)).toEqual(date2)
        expect(matcher.parseDate("02/12/1995", false)).toEqual(date2)
        expect(matcher.parseDate("12/02/1995", true)).toEqual(date2)
        expect(matcher.parseDate("02-12-1995", false)).toEqual(date2)
        expect(matcher.parseDate("02 12 1995", false)).toEqual(date2)
        expect(matcher.parseDate("02 december 1995", false)).toEqual(date2)
        expect(matcher.parseDate("2 december 1995", false)).toEqual(date2)
        expect(matcher.parseDate("2 december 95", false)).toEqual(date2)
        expect(matcher.parseDate("2 dec 95", false)).toEqual(date2)
        expect(matcher.parseDate("2 decmber 1995", false)).toEqual(date2) // typo matching should also work

        // Invalid dates
        expect(() => matcher.parseDate("02-12-1005", false)).toThrow(/jaar/i)
        expect(() => matcher.parseDate("02-13-1995", false)).toThrow(/maand/i)
        expect(() => matcher.parseDate("02 sdgsdgsdg 1995", false)).toThrow(/maand/i)
        expect(() => matcher.parseDate("32 02 1995", false)).toThrow(/dag/i)
        expect(() => matcher.parseDate("december december december", false)).toThrow(/datum/i)
        expect(() => matcher.parseDate("december", false)).toThrow(/datum/i)
        expect(() => matcher.parseDate("sdgsdgsg", false)).toThrow(/datum/i)
    });
});
