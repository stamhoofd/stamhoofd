import XLSX from "xlsx";

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

    test("cell parsing", () => {
        const matcher = new BirthDayColumnMatcher()

        // As number
        const date = new Date(2005, 4 - 1, 21)
        const numberCell: XLSX.CellObject = {
            v: 38463,
            t: "n",
            w: "don't use me",
        };

        expect(matcher.dateFromCell(numberCell)).toEqual(date)

        // As string
        const stringCell: XLSX.CellObject = {
            t: "s",
            w: "21/04/05",
            v: "21/04/05",
        };
        expect(matcher.dateFromCell(stringCell)).toEqual(date)

        // As date
        const dateCell: XLSX.CellObject = {
            t: "d",
            v: date,
            w: "don't use me",
        };
        expect(matcher.dateFromCell(dateCell)).toEqual(date)
    })
});
