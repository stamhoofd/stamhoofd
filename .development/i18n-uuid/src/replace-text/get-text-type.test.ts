import { getTextType, TextType } from "./get-text-type";

describe("get-text-type", () => {
    test("array should return correct type", () => {
        const testCases: {
            allParts: { value: string }[];
            expectedName: string;
            expectedType: TextType;
        }[] = [
            {
                allParts: [
                    { value: "const a = 5;"},
                    { value: '"test abc"' },
                    {
                        value: ";const array = [1,[2,3],"
                    },
                ],
                expectedName: "const a = 5;\"test abc\";const array ",
                expectedType: TextType.Variable
            },
            {
                allParts: [
                    { value: "const a = 5;" },
                    { value: '"test abc"' },
                    { value: ";const array = [,"},
                    { value: '"blabla"'},
                    { value: "," },
                ],
                expectedName: "const a = 5;\"test abc\";const array ",
                expectedType: TextType.Variable
            },
            {
                allParts: [
                    {
                        value: "export const DocumentTemplateLogger = new ModelLogger(DocumentTemplate, { skipKeys: [",
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
                    },
                    {
                        value: "'@stamhoofd/models'",
                    },
                    {
                        value: ";\nimport { getDefaultGenerator, ModelLogger } from ",
                    },
                    {
                        value: "'./ModelLogger'",
                    },
                    {
                        value: ";\nimport { AuditLogReplacement, AuditLogReplacementType, AuditLogType } from ",
                    },
                    {
                        value: "'@stamhoofd/structures'",
                    },
                    {
                        value: ";\n\nexport const MemberLogger = new ModelLogger(Member, {\n",
                    },
                    {
                        value: "// Skip repeated auto generated fields",
                    },
                    {
                        value: "\n    skipKeys: [",
                    },
                    {
                        value: "'firstName'",
                    },
                    {
                        value: ", ",
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
            allParts: { value: string}[];
            expectedName: string;
        }[] = [
            {
                allParts: [
                    {
                        value: "export const DocumentTemplateLogger = new ModelLogger(DocumentTemplate, { skipKeys:"
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

    test("equality should return type equality", () => {
        const testCases: {
            allParts: { value: string }[];
        }[] = [
            {
                allParts: [
                    {
                        value: "if(test === ",
                    },
                ]
            },
            {
                allParts: [
                    {
                        value: "if(test !== ",
                    },
                ]
            },
            {
                allParts: [
                    {
                        value: "if(test > ",
                    },
                ]
            },
            {
                allParts: [
                    {
                        value: "if(test < ",
                    },
                ]
            },
            {
                allParts: [
                    {
                        value: "if(test == ",
                    },
                ]
            },
            {
                allParts: [
                    {
                        value: "if(test >= ",
                    },
                ]
            },
            {
                allParts: [
                    {
                        value: "if(test <= ",
                    },
                ]
            },
        ];

        for (const testCase of testCases) {
            const result = getTextType(testCase.allParts);

            expect(result?.type).toBe(TextType.Equality);
            expect(result?.name).toBeNull();
        }
    });

    test("switch case should return type switch case", () => {
        const testCases: {
            allParts: { value: string }[];
        }[] = [
            {
                allParts: [
                    {
                        value: "switch(test) { case ",
                    },
                ]
            }
        ];

        for (const testCase of testCases) {
            const result = getTextType(testCase.allParts);

            expect(result?.type).toBe(TextType.SwitchCase);
            expect(result?.name).toBeNull();
        }
    });
});
