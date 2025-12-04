import { Factory } from '@simonbackx/simple-database';
import { File, Image, RecordAddressAnswer, RecordAnswer, RecordCategory, RecordCheckboxAnswer, RecordChooseOneAnswer, RecordDateAnswer, RecordFileAnswer, RecordImageAnswer, RecordIntegerAnswer, RecordMultipleChoiceAnswer, RecordPriceAnswer, RecordSettings, RecordTextAnswer, RecordType } from '@stamhoofd/structures';
import { AddressFactory } from './AddressFactory.js';

type Options = ({
    records: RecordSettings[];
} | {
    recordCategories: RecordCategory[];
}) & {
    /**
     * Defaults to true
     */
    complete?: boolean;
};

export class RecordAnswerFactory extends Factory<Options, Map<string, RecordAnswer>> {
    async create(): Promise<Map<string, RecordAnswer>> {
        const records = 'records' in this.options ? this.options.records : this.options.recordCategories.flatMap(c => c.getAllRecords());

        const map: Map<string, RecordAnswer> = new Map();

        for (const record of records) {
            const answer = RecordAnswer.createDefaultAnswer(record);

            if (this.options.complete !== false) {
                // Make sure it is filled in
                answer.markReviewed();

                switch (true) {
                    case answer instanceof RecordCheckboxAnswer: {
                        // If it is a checkbox, set the first one to true
                        answer.selected = true;
                        break;
                    }
                    case answer instanceof RecordTextAnswer: {
                        answer.value = 'Test ' + Math.floor(Math.random() * 100000);

                        switch (record.type) {
                            case RecordType.Phone:{
                                answer.value = '+32 477 77 77 77';
                                break;
                            }
                            case RecordType.Email: {
                                answer.value = 'example@example.domain';
                                break;
                            }
                            case RecordType.Textarea: {
                                answer.value = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.\nVivamus lacinia odio vitae vestibulum.';
                                break;
                            }
                        }
                        break;
                    }

                    case answer instanceof RecordMultipleChoiceAnswer: {
                        // If it is a multiple choice, select all
                        answer.selectedChoices = record.choices.map(c => c.clone());
                        break;
                    };

                    case answer instanceof RecordChooseOneAnswer: {
                        // Select first
                        answer.selectedChoice = record.choices[0]?.clone() ?? null;
                        break;
                    };

                    case answer instanceof RecordAddressAnswer: {
                        answer.address = await new AddressFactory({}).create();
                        break;
                    }

                    case answer instanceof RecordDateAnswer: {
                        answer.dateValue = new Date();
                        break;
                    }

                    case answer instanceof RecordPriceAnswer: {
                        answer.value = 1234;
                        break;
                    }

                    case answer instanceof RecordImageAnswer: {
                        answer.image = Image.create({});
                        break;
                    }

                    case answer instanceof RecordIntegerAnswer: {
                        answer.value = 5;
                        break;
                    }

                    case answer instanceof RecordFileAnswer: {
                        answer.file = new File({
                            id: 'example-id',
                            server: 'https://example.domain',
                            path: 'example/path/to/file',
                            size: 1234,
                            name: 'example.txt',
                            isPrivate: false,
                            signedUrl: null,
                            signature: null,
                        });
                        break;
                    }
                }
            }

            map.set(record.id, answer);
        }

        return map;
    }
}
