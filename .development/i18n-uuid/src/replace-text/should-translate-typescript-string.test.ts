import { shouldTranslateTypescriptString } from "./should-translate-typescript-string";

describe('shouldTranslateTypescriptString', () => {
    test('array with key in black list should return false', () => {
        const testCases: {allParts: {value: string, shouldTranslate: boolean}[], value: string}[] = [
            {
                allParts: [
                    {value: 'export const DocumentTemplateLogger = new ModelLogger(DocumentTemplate, { skipKeys: [', shouldTranslate: false},
                ],
                value: '"html"'
            }
        ];

        for(const testCase of testCases) {
            const result = shouldTranslateTypescriptString(testCase.allParts);
            expect(result).toBe(false);
        }
    })

    test('key not in blacklist should return true', () => {
        const allParts = `    private static throwIfInvalidBody(body: Body) {
        if (!body.description?.trim()?.length) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid description',
                human: `;

        const result = shouldTranslateTypescriptString(allParts);
        expect(result).toBe(true);
    })

    test('key in keyCombinationBlacklist should return false', () => {
        const allParts = `    private static throwIfInvalidBody(body: Body) {
        if (!body.description?.trim()?.length) {
            throw new SimpleError({
                code: 'invalid_field',
                message:`;

        const result = shouldTranslateTypescriptString(allParts);
        expect(result).toBe(false);
    })
})
