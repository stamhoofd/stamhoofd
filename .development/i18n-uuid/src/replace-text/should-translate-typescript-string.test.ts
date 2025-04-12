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
            const result = shouldTranslateTypescriptString(testCase.allParts, testCase.value);
            expect(result).toBe(false);
        }
    })
})
