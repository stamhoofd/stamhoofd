import {jest} from '@jest/globals';
import { Formatter } from "@stamhoofd/utility";
import XLSX from "xlsx";

// I18N controller is loaded at some point by the matchers, which require vue-app-navigation (which we cannot load in a node context, so we mock it)
jest.mock('@stamhoofd/frontend-i18n', () => ({
    I18nController: {shared: undefined}
}));

// We need to use 'require' here, otherwise jest won't be able to mock the modules

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {MatcherCategory} = require('./MatcherCategory');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {DateColumnMatcher} = require('./matchers');

describe("DateColumnMatcher", () => {

    test("day parsing", () => {
        const matcher = new DateColumnMatcher({
            name: 'Test',
            category: MatcherCategory.Member,
            save(value, member) {
                // todo
            },
        })
            
        const date = new Date(2018, 5 - 1, 10)
        expect(matcher.parse("10/5/2018")).toEqual(date)
        expect(matcher.parse("10/05/2018")).toEqual(date)
        expect(matcher.parse("10/05/18")).toEqual(date)
        expect(matcher.parse("10-05-18")).toEqual(date)
        expect(matcher.parse("10 mei 18")).toEqual(date)
        expect(matcher.parse("10 mei 2018")).toEqual(date)
        expect(matcher.parse("10 may 2018")).toEqual(date)

        const date2 = new Date(1995, 12 - 1, 2)
        expect(matcher.parse("2/12/95")).toEqual(date2)
        expect(matcher.parse("02/12/95")).toEqual(date2)
        expect(matcher.parse("02/12/1995")).toEqual(date2)
        expect(matcher.parse("02-12-1995")).toEqual(date2)
        expect(matcher.parse("02 12 1995")).toEqual(date2)
        expect(matcher.parse("02 december 1995")).toEqual(date2)
        expect(matcher.parse("2 december 1995")).toEqual(date2)
        expect(matcher.parse("2 december 95")).toEqual(date2)
        expect(matcher.parse("2 dec 95")).toEqual(date2)
        expect(matcher.parse("2 decmber 1995")).toEqual(date2) // typo matching should also work

        // Invalid dates
        expect(() => matcher.parse("02-12-1005")).toThrow(/jaar/i)
        expect(() => matcher.parse("02-13-1995")).toThrow(/maand/i)
        expect(() => matcher.parse("02 sdgsdgsdg 1995")).toThrow(/maand/i)
        expect(() => matcher.parse("32 02 1995")).toThrow(/dag/i)
        expect(() => matcher.parse("december december december")).toThrow(/datum/i)
        expect(() => matcher.parse("december")).toThrow(/datum/i)
        expect(() => matcher.parse("sdgsdgsg")).toThrow(/datum/i)
    });

    test("cell parsing", () => {
        const matcher = new DateColumnMatcher({
            name: 'Test',
            category: MatcherCategory.Member,
            save(value, member) {
                // todo
            },
        })

        // As number
        const date = new Date(2005, 4 - 1, 21)
        const numberCell: XLSX.CellObject = {
            v: 38463,
            t: "n",
            w: "don't use me",
        };

        expect(Formatter.date(matcher.parseObject(numberCell)!)).toEqual(Formatter.date(date))

        // As string
        const stringCell: XLSX.CellObject = {
            t: "s",
            w: "21/04/05",
            v: "21/04/05",
        };
        expect(matcher.parseObject(stringCell)).toEqual(date)

        // As date
        const dateCell: XLSX.CellObject = {
            t: "d",
            v: date,
            w: "don't use me",
        };
        expect(matcher.parseObject(dateCell)).toEqual(date)
    })
});
