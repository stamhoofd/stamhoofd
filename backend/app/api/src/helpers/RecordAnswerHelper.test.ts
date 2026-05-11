import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { FileType, RecordCategory, RecordChoice, RecordSettings, RecordType, TranslatedString } from '@stamhoofd/structures';
import { RecordAnswerHelper } from './RecordAnswerHelper.js';

describe('RecordAnswerHelper', () => {
    const record1 = RecordSettings.create({
        name: TranslatedString.create('vraag 1'),
        type: RecordType.Text
    });

    const record2 = RecordSettings.create({
        name: TranslatedString.create('vraag 2'),
        type: RecordType.Integer
    });

    const record3 = RecordSettings.create({
        name: TranslatedString.create('vraag 3'),
        type: RecordType.Text
    });

    const record4 = RecordSettings.create({
        name: TranslatedString.create('vraag 4'),
        type: RecordType.Date
    });

    const record5 = RecordSettings.create({
        name: TranslatedString.create('vraag 5'),
        type: RecordType.MultipleChoice,
        choices: [
            RecordChoice.create({ name: TranslatedString.create('keuze 1') }),
            RecordChoice.create({ name: TranslatedString.create('keuze 2') }),
        ]
    });

    const record6 = RecordSettings.create({
        name: TranslatedString.create('vraag 6'),
        type: RecordType.Email
    });

    const record7 = RecordSettings.create({
        name: TranslatedString.create('vraag 7'),
        type: RecordType.Price
    });

    const record8 = RecordSettings.create({
        name: TranslatedString.create('vraag 8'),
        type: RecordType.File,
        fileType: FileType.PDF
    });

    const childCategory1 = RecordCategory.create({
        name: TranslatedString.create('subcategorie 1'),
        records: [record3,record4]
    });

    const childCategory2 = RecordCategory.create({
        name: TranslatedString.create('subcategorie 2'),
        records: [record5]
    })

    const recordCategory1 = RecordCategory.create({
        name: TranslatedString.create('categorie 1'),
        records: [ record1, record2 ],
        childCategories: [childCategory1, childCategory2]
    });

    const recordCategory2 = RecordCategory.create({
        name: TranslatedString.create('categorie 2'),
        records: [record6, record7, record8]
    });

    const originalRecordCategories = [recordCategory1, recordCategory2];

    describe('throwIfPatchOrPutIsInvalid', () => {

        test('patch - happy path should not throw', () => {
            const patches = new PatchableArray<string, RecordCategory, AutoEncoderPatchType<RecordCategory>>();
            const recordPatches1 = new PatchableArray<string, RecordSettings, AutoEncoderPatchType<RecordSettings>>();

            const recordPatch1 = RecordSettings.patch({
                id: record1.id,
                name: TranslatedString.create('vraag 1 - updated'),
                type: RecordType.Textarea
            });

            const recordPatch2 = RecordSettings.patch({
                id: record2.id,
                name: TranslatedString.create('vraag 2 - updated'),
                type: RecordType.Integer
            });

            recordPatches1.addPatch(recordPatch1);
            recordPatches1.addPatch(recordPatch2);

            const recordPatches2 = new PatchableArray<string, RecordSettings, AutoEncoderPatchType<RecordSettings>>();

            const recordPatch3 = RecordSettings.patch({
                id: record3.id,
                name: TranslatedString.create('vraag 3 - updated'),
                type: RecordType.Email
            });

            const recordPatch4 = RecordSettings.patch({
                id: record4.id,
                name: TranslatedString.create('vraag 4 - updated'),
            });

            recordPatches2.addPatch(recordPatch3);
            recordPatches2.addPatch(recordPatch4);

            const recordPatches3 = new PatchableArray<string, RecordSettings, AutoEncoderPatchType<RecordSettings>>();

            const recordPatch5 = RecordSettings.patch({
                id: record5.id,
                name: TranslatedString.create('vraag 5 - updated'),
            });
            
            recordPatches3.addPatch(recordPatch5);

            const recordPatches4 = new PatchableArray<string, RecordSettings, AutoEncoderPatchType<RecordSettings>>();

            const recordPatch7 = RecordSettings.patch({
                id: record7.id,
                name: TranslatedString.create('vraag 7 - updated'),
            });

            recordPatches4.addPatch(recordPatch7);

            const childCategoriesPatch1 = new PatchableArray<string, RecordCategory, AutoEncoderPatchType<RecordCategory>>();

            childCategoriesPatch1.addPatch(RecordCategory.patch({
                id: childCategory1.id,
                records: recordPatches2
            }));

            childCategoriesPatch1.addPatch(RecordCategory.patch({
                id: childCategory2.id,
                records: recordPatches3
            }));


            const patch1 = RecordCategory.patch({
                id: recordCategory1.id,
                records: recordPatches1,
                childCategories: childCategoriesPatch1
            });

            const patch2 = RecordCategory.patch({
                id: recordCategory2.id,
                records: recordPatches4
            });

            patches.addPatch(patch1);
            patches.addPatch(patch2);

            // should not throw
            expect(() => RecordAnswerHelper.throwIfPatchOrPutIsInvalid(originalRecordCategories, patches)).not.toThrow();
        })

        describe('patch - should throw if type changes', () => {
            test('case 1 - error in root category', () => {
                const patches = new PatchableArray<string, RecordCategory, AutoEncoderPatchType<RecordCategory>>();
                const recordPatches1 = new PatchableArray<string, RecordSettings, AutoEncoderPatchType<RecordSettings>>();

                const recordPatch1 = RecordSettings.patch({
                    id: record1.id,
                    name: TranslatedString.create('vraag 1 - updated'),
                    type: RecordType.Textarea
                });

                const recordPatch2 = RecordSettings.patch({
                    id: record2.id,
                    name: TranslatedString.create('vraag 2 - updated'),
                    // type changed -> should throw
                    type: RecordType.Email
                });

                recordPatches1.addPatch(recordPatch1);
                recordPatches1.addPatch(recordPatch2);

                const patch1 = RecordCategory.patch({
                    id: recordCategory1.id,
                    records: recordPatches1,
                });

                patches.addPatch(patch1);

                // should throw
                expect(() => RecordAnswerHelper.throwIfPatchOrPutIsInvalid(originalRecordCategories, patches)).toThrow('Cannot change record type from Integer to Email');
            })

            test('case 2 - error in child category', () => {
                const patches = new PatchableArray<string, RecordCategory, AutoEncoderPatchType<RecordCategory>>();
                const recordPatches1 = new PatchableArray<string, RecordSettings, AutoEncoderPatchType<RecordSettings>>();

                const recordPatch1 = RecordSettings.patch({
                    id: record1.id,
                    name: TranslatedString.create('vraag 1 - updated'),
                    type: RecordType.Textarea
                });

                const recordPatch2 = RecordSettings.patch({
                    id: record2.id,
                    name: TranslatedString.create('vraag 2 - updated'),
                    type: RecordType.Integer
                });

                recordPatches1.addPatch(recordPatch1);
                recordPatches1.addPatch(recordPatch2);

                const recordPatches2 = new PatchableArray<string, RecordSettings, AutoEncoderPatchType<RecordSettings>>();

                const recordPatch3 = RecordSettings.patch({
                    id: record3.id,
                    name: TranslatedString.create('vraag 3 - updated'),
                    type: RecordType.Email
                });

                const recordPatch4 = RecordSettings.patch({
                    id: record4.id,
                    name: TranslatedString.create('vraag 4 - updated'),
                    // changes from date to text -> should throw
                    type: RecordType.Text
                });

                recordPatches2.addPatch(recordPatch3);
                recordPatches2.addPatch(recordPatch4);

                const recordPatches3 = new PatchableArray<string, RecordSettings, AutoEncoderPatchType<RecordSettings>>();

                const recordPatch5 = RecordSettings.patch({
                    id: record5.id,
                    name: TranslatedString.create('vraag 5 - updated'),
                });
                
                recordPatches3.addPatch(recordPatch5);

                const childCategoriesPatch1 = new PatchableArray<string, RecordCategory, AutoEncoderPatchType<RecordCategory>>();

                childCategoriesPatch1.addPatch(RecordCategory.patch({
                    id: childCategory1.id,
                    records: recordPatches2
                }));

                childCategoriesPatch1.addPatch(RecordCategory.patch({
                    id: childCategory2.id,
                    records: recordPatches3
                }));


                const patch1 = RecordCategory.patch({
                    id: recordCategory1.id,
                    records: recordPatches1,
                    childCategories: childCategoriesPatch1
                });

                patches.addPatch(patch1);

                // should throw
                expect(() => RecordAnswerHelper.throwIfPatchOrPutIsInvalid(originalRecordCategories, patches)).toThrow('Cannot change record type from Date to Text');
            })
        });

        test('patch - should throw if file type changes', () => {
            const patches = new PatchableArray<string, RecordCategory, AutoEncoderPatchType<RecordCategory>>();
            const recordPatches1 = new PatchableArray<string, RecordSettings, AutoEncoderPatchType<RecordSettings>>();

            recordPatches1.addPatch(RecordSettings.patch({
                id: record8.id,
                name: TranslatedString.create('vraag 8 - updated'),
                type: RecordType.File,
                fileType: FileType.Word
            }));

            patches.addPatch(RecordCategory.patch({
                id: recordCategory2.id,
                records: recordPatches1,
            }));

            // should throw
            expect(() => RecordAnswerHelper.throwIfPatchOrPutIsInvalid(originalRecordCategories, patches)).toThrow('Cannot change record file type from PDF to Word');
        })

        test('put - happy path should not throw', () => {
            const newRecord1 = RecordSettings.create({
                id: record1.id,
                name: TranslatedString.create('vraag 1'),
                // type changed but same class -> should not throw
                type: RecordType.Text
            });

            const newRecord2 = RecordSettings.create({
                id: record2.id,
                name: TranslatedString.create('vraag 2'),
                type: RecordType.Integer
            });

            const newRecord3 = RecordSettings.create({
                id: record3.id,
                name: TranslatedString.create('vraag 3'),
                type: RecordType.Text
            });

            const newRecord4 = RecordSettings.create({
                id: record4.id,
                name: TranslatedString.create('vraag 4'),
                type: RecordType.Date
            });

            const newRecord5 = RecordSettings.create({
                id: record5.id,
                name: TranslatedString.create('vraag 5'),
                type: RecordType.MultipleChoice,
                choices: [
                    RecordChoice.create({ name: TranslatedString.create('keuze 1') }),
                    RecordChoice.create({ name: TranslatedString.create('keuze 2') }),
                ]
            });

            const newRecord6 = RecordSettings.create({
                id: record6.id,
                name: TranslatedString.create('vraag 6'),
                type: RecordType.Email
            });

            const newRecord7 = RecordSettings.create({
                id: record7.id,
                name: TranslatedString.create('vraag 7'),
                type: RecordType.Price
            });

            const newRecord8 = RecordSettings.create({
                id: record8.id,
                name: TranslatedString.create('vraag 8'),
                type: RecordType.File,
                fileType: FileType.PDF
            });

            const newChildCategory1 = RecordCategory.create({
                id: childCategory1.id,
                name: TranslatedString.create('subcategorie 1'),
                records: [newRecord3,newRecord4]
            });

            const newChildCategory2 = RecordCategory.create({
                id: childCategory2.id,
                name: TranslatedString.create('subcategorie 2'),
                records: [newRecord5]
            })

            const newRecordCategory1 = RecordCategory.create({
                id: recordCategory1.id,
                name: TranslatedString.create('categorie 1'),
                records: [ newRecord1, newRecord2 ],
                childCategories: [newChildCategory1, newChildCategory2]
            });

            const newRecordCategory2 = RecordCategory.create({
                id: recordCategory2.id,
                name: TranslatedString.create('categorie 2'),
                records: [newRecord6, newRecord7, newRecord8]
            });

            const newRecordCategories = [newRecordCategory1, newRecordCategory2];

            // should not throw
            expect(() => RecordAnswerHelper.throwIfPatchOrPutIsInvalid(originalRecordCategories, newRecordCategories)).not.toThrow();
        });

        describe('put - should throw if type changes', () => {
            test('case 1 - error in root category', () => {
                const newRecord1 = RecordSettings.create({
                    id: record1.id,
                    name: TranslatedString.create('vraag 1'),
                    // type changed but same class -> should not throw
                    type: RecordType.Text
                });

                const newRecord2 = RecordSettings.create({
                    id: record2.id,
                    name: TranslatedString.create('vraag 2'),
                    // type changed from Integer to Email -> should throw
                    type: RecordType.Email
                });

                const newRecord3 = RecordSettings.create({
                    id: record3.id,
                    name: TranslatedString.create('vraag 3'),
                    type: RecordType.Text
                });

                const newRecord4 = RecordSettings.create({
                    id: record4.id,
                    name: TranslatedString.create('vraag 4'),
                    type: RecordType.Date
                });

                const newRecord5 = RecordSettings.create({
                    id: record5.id,
                    name: TranslatedString.create('vraag 5'),
                    type: RecordType.MultipleChoice,
                    choices: [
                        RecordChoice.create({ name: TranslatedString.create('keuze 1') }),
                        RecordChoice.create({ name: TranslatedString.create('keuze 2') }),
                    ]
                });

                const newRecord6 = RecordSettings.create({
                    id: record6.id,
                    name: TranslatedString.create('vraag 6'),
                    type: RecordType.Email
                });

                const newRecord7 = RecordSettings.create({
                    id: record7.id,
                    name: TranslatedString.create('vraag 7'),
                    type: RecordType.Price
                });

                const newRecord8 = RecordSettings.create({
                    id: record8.id,
                    name: TranslatedString.create('vraag 8'),
                    type: RecordType.File,
                    fileType: FileType.PDF
                });

                const newChildCategory1 = RecordCategory.create({
                    id: childCategory1.id,
                    name: TranslatedString.create('subcategorie 1'),
                    records: [newRecord3,newRecord4]
                });

                const newChildCategory2 = RecordCategory.create({
                    id: childCategory2.id,
                    name: TranslatedString.create('subcategorie 2'),
                    records: [newRecord5]
                })

                const newRecordCategory1 = RecordCategory.create({
                    id: recordCategory1.id,
                    name: TranslatedString.create('categorie 1'),
                    records: [ newRecord1, newRecord2 ],
                    childCategories: [newChildCategory1, newChildCategory2]
                });

                const newRecordCategory2 = RecordCategory.create({
                    id: recordCategory2.id,
                    name: TranslatedString.create('categorie 2'),
                    records: [newRecord6, newRecord7, newRecord8]
                });

                const newRecordCategories = [newRecordCategory1, newRecordCategory2];

                // should throw
                expect(() => RecordAnswerHelper.throwIfPatchOrPutIsInvalid(originalRecordCategories, newRecordCategories)).toThrow('Cannot change record type from Integer to Email');
            })

            test('case 2 - error in child category', () => {
                const newRecord1 = RecordSettings.create({
                    id: record1.id,
                    name: TranslatedString.create('vraag 1'),
                    // type changed but same class -> should not throw
                    type: RecordType.Text
                });

                const newRecord2 = RecordSettings.create({
                    id: record2.id,
                    name: TranslatedString.create('vraag 2'),
                    type: RecordType.Integer
                });

                const newRecord3 = RecordSettings.create({
                    id: record3.id,
                    name: TranslatedString.create('vraag 3'),
                    type: RecordType.Text
                });

                const newRecord4 = RecordSettings.create({
                    id: record4.id,
                    name: TranslatedString.create('vraag 4'),
                    // type changed from date to text -> should throw
                    type: RecordType.Text
                });

                const newRecord5 = RecordSettings.create({
                    id: record5.id,
                    name: TranslatedString.create('vraag 5'),
                    type: RecordType.MultipleChoice,
                    choices: [
                        RecordChoice.create({ name: TranslatedString.create('keuze 1') }),
                        RecordChoice.create({ name: TranslatedString.create('keuze 2') }),
                    ]
                });

                const newRecord6 = RecordSettings.create({
                    id: record6.id,
                    name: TranslatedString.create('vraag 6'),
                    type: RecordType.Email
                });

                const newRecord7 = RecordSettings.create({
                    id: record7.id,
                    name: TranslatedString.create('vraag 7'),
                    type: RecordType.Price
                });

                const newRecord8 = RecordSettings.create({
                    id: record8.id,
                    name: TranslatedString.create('vraag 8'),
                    type: RecordType.File,
                    fileType: FileType.PDF
                });

                const newChildCategory1 = RecordCategory.create({
                    id: childCategory1.id,
                    name: TranslatedString.create('subcategorie 1'),
                    records: [newRecord3,newRecord4]
                });

                const newChildCategory2 = RecordCategory.create({
                    id: childCategory2.id,
                    name: TranslatedString.create('subcategorie 2'),
                    records: [newRecord5]
                })

                const newRecordCategory1 = RecordCategory.create({
                    id: recordCategory1.id,
                    name: TranslatedString.create('categorie 1'),
                    records: [ newRecord1, newRecord2 ],
                    childCategories: [newChildCategory1, newChildCategory2]
                });

                const newRecordCategory2 = RecordCategory.create({
                    id: recordCategory2.id,
                    name: TranslatedString.create('categorie 2'),
                    records: [newRecord6, newRecord7, newRecord8]
                });

                const newRecordCategories = [newRecordCategory1, newRecordCategory2];

                // should throw
                expect(() => RecordAnswerHelper.throwIfPatchOrPutIsInvalid(originalRecordCategories, newRecordCategories)).toThrow('Cannot change record type from Date to Text');
            })
        });

        test('combination of patch and put - happy path should not throw', () => {
            const patches = new PatchableArray<string, RecordCategory, AutoEncoderPatchType<RecordCategory>>();
            const recordPatches1 = new PatchableArray<string, RecordSettings, AutoEncoderPatchType<RecordSettings>>();

            const recordPatch1 = RecordSettings.patch({
                id: record1.id,
                name: TranslatedString.create('vraag 1 - updated'),
                type: RecordType.Textarea
            });

            const recordPatch2 = RecordSettings.patch({
                id: record2.id,
                name: TranslatedString.create('vraag 2 - updated'),
                type: RecordType.Integer
            });

            recordPatches1.addPatch(recordPatch1);
            recordPatches1.addPatch(recordPatch2);

            const recordPatches2 = new PatchableArray<string, RecordSettings, AutoEncoderPatchType<RecordSettings>>();

            const recordPatch3 = RecordSettings.patch({
                id: record3.id,
                name: TranslatedString.create('vraag 3 - updated'),
                type: RecordType.Email
            });

            const recordPatch4 = RecordSettings.patch({
                id: record4.id,
                name: TranslatedString.create('vraag 4 - updated'),
            });

            recordPatches2.addPatch(recordPatch3);
            recordPatches2.addPatch(recordPatch4);

            const recordPatches3 = new PatchableArray<string, RecordSettings, AutoEncoderPatchType<RecordSettings>>();

            const recordPatch5 = RecordSettings.patch({
                id: record5.id,
                name: TranslatedString.create('vraag 5 - updated'),
            });
            
            recordPatches3.addPatch(recordPatch5);

            const recordPatches4 = new PatchableArray<string, RecordSettings, AutoEncoderPatchType<RecordSettings>>();

            const recordPatch7 = RecordSettings.patch({
                id: record7.id,
                name: TranslatedString.create('vraag 7 - updated'),
            });

            recordPatches4.addPatch(recordPatch7);

            const childCategoriesPatch1 = new PatchableArray<string, RecordCategory, AutoEncoderPatchType<RecordCategory>>();

            const newRecord3 = RecordSettings.create({
                id: record3.id,
                name: TranslatedString.create('vraag 3'),
                type: RecordType.Text
            });

            const newRecord4 = RecordSettings.create({
                id: record4.id,
                name: TranslatedString.create('vraag 4'),
                type: RecordType.Date
            });

            const newChildCategory1 = RecordCategory.create({
                id: childCategory1.id,
                name: TranslatedString.create('subcategorie 1'),
                records: [newRecord3,newRecord4]
            });

            childCategoriesPatch1.addPut(newChildCategory1);

            childCategoriesPatch1.addPatch(RecordCategory.patch({
                id: childCategory2.id,
                records: recordPatches3
            }));


            const patch1 = RecordCategory.patch({
                id: recordCategory1.id,
                records: recordPatches1,
                childCategories: childCategoriesPatch1
            });

            const patch2 = RecordCategory.patch({
                id: recordCategory2.id,
                records: recordPatches4
            });

            patches.addPatch(patch1);
            patches.addPatch(patch2);

            // should not throw
            expect(() => RecordAnswerHelper.throwIfPatchOrPutIsInvalid(originalRecordCategories, patches)).not.toThrow();
        })

        test('combination of patch and put - should throw if type changes', () => {
            const patches = new PatchableArray<string, RecordCategory, AutoEncoderPatchType<RecordCategory>>();
            const recordPatches1 = new PatchableArray<string, RecordSettings, AutoEncoderPatchType<RecordSettings>>();

            const recordPatch1 = RecordSettings.patch({
                id: record1.id,
                name: TranslatedString.create('vraag 1 - updated'),
                type: RecordType.Textarea
            });

            const recordPatch2 = RecordSettings.patch({
                id: record2.id,
                name: TranslatedString.create('vraag 2 - updated'),
                type: RecordType.Integer
            });

            recordPatches1.addPatch(recordPatch1);
            recordPatches1.addPatch(recordPatch2);

            const recordPatches2 = new PatchableArray<string, RecordSettings, AutoEncoderPatchType<RecordSettings>>();

            const recordPatch3 = RecordSettings.patch({
                id: record3.id,
                name: TranslatedString.create('vraag 3 - updated'),
                type: RecordType.Email
            });

            const recordPatch4 = RecordSettings.patch({
                id: record4.id,
                name: TranslatedString.create('vraag 4 - updated'),
            });

            recordPatches2.addPatch(recordPatch3);
            recordPatches2.addPatch(recordPatch4);

            const recordPatches3 = new PatchableArray<string, RecordSettings, AutoEncoderPatchType<RecordSettings>>();

            const recordPatch5 = RecordSettings.patch({
                id: record5.id,
                name: TranslatedString.create('vraag 5 - updated'),
            });
            
            recordPatches3.addPatch(recordPatch5);

            const recordPatches4 = new PatchableArray<string, RecordSettings, AutoEncoderPatchType<RecordSettings>>();

            const recordPatch7 = RecordSettings.patch({
                id: record7.id,
                name: TranslatedString.create('vraag 7 - updated'),
            });

            recordPatches4.addPatch(recordPatch7);

            const childCategoriesPatch1 = new PatchableArray<string, RecordCategory, AutoEncoderPatchType<RecordCategory>>();

            const newRecord3 = RecordSettings.create({
                id: record3.id,
                name: TranslatedString.create('vraag 3'),
                type: RecordType.Text
            });

            const newRecord4 = RecordSettings.create({
                id: record4.id,
                name: TranslatedString.create('vraag 4'),
                // type changes from date to text -> should throw
                type: RecordType.Text
            });

            const newChildCategory1 = RecordCategory.create({
                id: childCategory1.id,
                name: TranslatedString.create('subcategorie 1'),
                records: [newRecord3,newRecord4]
            });

            childCategoriesPatch1.addPut(newChildCategory1);

            childCategoriesPatch1.addPatch(RecordCategory.patch({
                id: childCategory2.id,
                records: recordPatches3
            }));


            const patch1 = RecordCategory.patch({
                id: recordCategory1.id,
                records: recordPatches1,
                childCategories: childCategoriesPatch1
            });

            const patch2 = RecordCategory.patch({
                id: recordCategory2.id,
                records: recordPatches4
            });

            patches.addPatch(patch1);
            patches.addPatch(patch2);

            // should not throw
            expect(() => RecordAnswerHelper.throwIfPatchOrPutIsInvalid(originalRecordCategories, patches)).toThrow('Cannot change record type from Date to Text');
        })
    })
})
