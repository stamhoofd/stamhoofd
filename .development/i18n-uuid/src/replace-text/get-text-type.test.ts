import { getTextType, TextType } from "./get-text-type";

describe("get-text-type", () => {
    test("array should return correct type", () => {
        const testCases: {
            allParts: { value: string; shouldTranslate: boolean }[];
            expectedName: string;
            expectedType: TextType;
        }[] = [
            {
                allParts: [
                    { value: "const a = 5;", shouldTranslate: false },
                    { value: '"test abc"', shouldTranslate: true },
                    {
                        value: ";const array = [1,[2,3],",
                        shouldTranslate: false,
                    },
                ],
                expectedName: "const a = 5;\"test abc\";const array ",
                expectedType: TextType.Variable
            },
            {
                allParts: [
                    { value: "const a = 5;", shouldTranslate: false },
                    { value: '"test abc"', shouldTranslate: true },
                    { value: ";const array = [,", shouldTranslate: false },
                    { value: '"blabla"', shouldTranslate: true },
                    { value: ",", shouldTranslate: false },
                ],
                expectedName: "const a = 5;\"test abc\";const array ",
                expectedType: TextType.Variable
            },
            {
                allParts: [
                    {
                        value: "export const DocumentTemplateLogger = new ModelLogger(DocumentTemplate, { skipKeys: [",
                        shouldTranslate: false,
                    },
                ],
                expectedName:
                    "export const DocumentTemplateLogger = new ModelLogger(DocumentTemplate, { skipKeys",
                    expectedType: TextType.Key
            },
            {
                allParts: [
                    {
                        value: "import { Member } from ",
                        shouldTranslate: false,
                    },
                    {
                        value: "'@stamhoofd/models'",
                        shouldTranslate: false,
                    },
                    {
                        value: ";\nimport { getDefaultGenerator, ModelLogger } from ",
                        shouldTranslate: false,
                    },
                    {
                        value: "'./ModelLogger'",
                        shouldTranslate: false,
                    },
                    {
                        value: ";\nimport { AuditLogReplacement, AuditLogReplacementType, AuditLogType } from ",
                        shouldTranslate: false,
                    },
                    {
                        value: "'@stamhoofd/structures'",
                        shouldTranslate: false,
                    },
                    {
                        value: ";\n\nexport const MemberLogger = new ModelLogger(Member, {\n",
                        shouldTranslate: false,
                    },
                    {
                        value: "// Skip repeated auto generated fields",
                        shouldTranslate: false,
                    },
                    {
                        value: "\n    skipKeys: [",
                        shouldTranslate: false,
                    },
                    {
                        value: "'firstName'",
                        shouldTranslate: false,
                    },
                    {
                        value: ", ",
                        shouldTranslate: false,
                    },
                ],
                expectedName: `import { Member } from '@stamhoofd/models';\nimport { getDefaultGenerator, ModelLogger } from './ModelLogger';\nimport { AuditLogReplacement, AuditLogReplacementType, AuditLogType } from '@stamhoofd/structures';\n\nexport const MemberLogger = new ModelLogger(Member, {\n// Skip repeated auto generated fields\n    skipKeys`,
                expectedType: TextType.Key
            },
        ];

        for (const testCase of testCases) {
            const result = getTextType(testCase.allParts);

            expect(result?.type).toBe(testCase.expectedType);
            expect(result?.name).toBe(testCase.expectedName);
        }
    });

    test("key should return type key", () => {
        const testCases: {
            allParts: { value: string; shouldTranslate: boolean }[];
            expectedName: string;
        }[] = [
            {
                allParts: [
                    {
                        value: "export const DocumentTemplateLogger = new ModelLogger(DocumentTemplate, { skipKeys:",
                        shouldTranslate: false,
                    },
                ],
                expectedName: "export const DocumentTemplateLogger = new ModelLogger(DocumentTemplate, { skipKeys",
            },
        ];

        for (const testCase of testCases) {
            const result = getTextType(testCase.allParts);

            expect(result?.type).toBe(TextType.Key);
            expect(result?.name).toBe(testCase.expectedName);
        }
    });
});
