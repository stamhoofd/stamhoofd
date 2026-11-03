import { PropertyFilter } from '../../filters/PropertyFilter.js';
import { TranslatedRichText } from '../../TranslatedRichText.js';
import { TranslatedLongText } from '../../TranslatedLongText.js';
import { TranslatedString } from '../../TranslatedString.js';
import { TranslatedText } from '../../TranslatedText.js';
import { LegacyRecordType } from './LegacyRecordType.js';
import { RecordCategory } from './RecordCategory.js';
import { RecordChoice, RecordSettings, RecordType, RecordWarning, RecordWarningType } from './RecordSettings.js';

export class RecordFactory {
    static getRecordCategory(type: LegacyRecordType): RecordCategory | undefined {
        switch (type) {
            case LegacyRecordType.FinancialProblems:
            case LegacyRecordType.DataPermissions:
                return undefined;

            case LegacyRecordType.PicturePermissions:
            case LegacyRecordType.GroupPicturePermissions:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.Privacy',
                    name: TranslatedText.create($t(`%l`)),
                });

            case LegacyRecordType.FoodAllergies:
            case LegacyRecordType.MedicineAllergies:
            case LegacyRecordType.HayFever:
            case LegacyRecordType.OtherAllergies:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.Allergies',
                    name: TranslatedText.create($t(`%qy`)),
                });

            case LegacyRecordType.Vegetarian:
            case LegacyRecordType.Vegan:
            case LegacyRecordType.Halal:
            case LegacyRecordType.Kosher:
            case LegacyRecordType.Diet:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.Diet',
                    name: TranslatedText.create($t(`%qz`)),
                });

            case LegacyRecordType.CovidHighRisk:
            case LegacyRecordType.Asthma:
            case LegacyRecordType.BedWaters:
            case LegacyRecordType.Medicines:
            case LegacyRecordType.SpecialHealthCare:
            case LegacyRecordType.Epilepsy:
            case LegacyRecordType.HeartDisease:
            case LegacyRecordType.SkinCondition:
            case LegacyRecordType.Rheumatism:
            case LegacyRecordType.SleepWalking:
            case LegacyRecordType.Diabetes:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.Health',
                    name: TranslatedText.create($t(`%r0`)),
                });

            case LegacyRecordType.CanNotSwim:
            case LegacyRecordType.TiredQuickly:
            case LegacyRecordType.CanNotParticipateInSport:
            case LegacyRecordType.SpecialSocialCare:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.Sport',
                    name: TranslatedText.create($t(`%r1`)),
                });

            case LegacyRecordType.Other:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.Other',
                    name: TranslatedText.create($t(`%r2`)),
                });

            case LegacyRecordType.TetanusVaccine:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.TetanusVaccine',
                    name: TranslatedText.create($t(`%r3`)),
                });

            case LegacyRecordType.MedicinePermissions: {
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.MedicinePermissions',
                    name: TranslatedText.create($t(`%r4`)),
                    description: TranslatedLongText.create($t(`%r5`)),

                    // Only ask if <18y
                    filter: new PropertyFilter(
                        {
                            age: {
                                $lt: 18,
                            },
                        },
                        {},
                    ),
                });
            }

            default: {
                // If you get a compile error here, you are missing a type in the switch
                const other: never = type;
                throw new Error('Unsupported category for type ' + other);
            }
        }

        // others: keep name, don't repeat name
    }

    static convert(types: LegacyRecordType[]): RecordCategory[] {
        // Make sure all the types are sorted in the default ordering
        const allTypes = Object.values(LegacyRecordType);

        types.sort((a, b) => {
            const index1 = allTypes.findIndex(q => q == a);
            const index2 = allTypes.findIndex(q => q == b);
            return index1 - index2;
        });

        let categories: RecordCategory[] = [];

        for (const type of types) {
            const category = this.getRecordCategory(type);
            const settings = this.create(type);

            if (!category || !settings) {
                // Has custom migration
                continue;
            }

            if (type == LegacyRecordType.PicturePermissions && types.includes(LegacyRecordType.GroupPicturePermissions)) {
                // Skip: we ask group picture permissions alreadys
                continue;
            }

            let exists = categories.find(c => c.id === category.id);

            if (!exists) {
                categories.push(category);
                exists = category;
            }
            exists.records.push(settings);
        }

        if (categories.length > 0) {
            categories = [
                RecordCategory.create({
                    name: TranslatedText.create($t(`%r6`)),
                    childCategories: categories,
                }),
            ];
        }

        return categories;
    }

    static create(type: LegacyRecordType): RecordSettings | null {
        const record = new RecordSettings();
        record.id = 'legacy-type-' + type;

        // Defaults
        record.required = false;
        record.sensitive = true;

        // record.encrypted = !this.isPublic(type)
        // record.sensitive = !this.isPublic(type)

        // record.type = RecordType.Checkbox
        // record.name = this.getName(type)

        switch (type) {
            case LegacyRecordType.FinancialProblems:
            case LegacyRecordType.DataPermissions:
                return null;

            case LegacyRecordType.PicturePermissions:
            case LegacyRecordType.GroupPicturePermissions:

                // Force same id for group and normal pictures
                record.id = 'legacy-type-' + LegacyRecordType.PicturePermissions;
                record.sensitive = false;
                record.type = RecordType.ChooseOne;
                record.required = true;
                record.name = TranslatedText.create($t(`%r7`));
                record.label = TranslatedText.create($t(`%r8`));
                record.choices = [
                    RecordChoice.create({
                        id: 'no',
                        name: TranslatedText.create($t(`%r9`)),
                        warning: RecordWarning.create({
                            id: '',
                            text: TranslatedRichText.fromText($t(`%rA`)),
                            type: RecordWarningType.Error,
                        }),
                    }),
                    RecordChoice.create({
                        id: 'yes',
                        name: TranslatedText.create($t(`%rB`)),
                    }),

                ];

                if (type == LegacyRecordType.GroupPicturePermissions) {
                    record.choices.push(
                        RecordChoice.create({
                            id: 'groups_only',
                            name: TranslatedText.create($t(`%rC`)),
                            warning: RecordWarning.create({
                                id: '',
                                text: TranslatedRichText.fromText($t(`%rD`)),
                                type: RecordWarningType.Error,
                            }),
                        }),
                    );
                }
                record.description = TranslatedLongText.create($t(`%rE`));
                break;

            case LegacyRecordType.FoodAllergies:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rF`));
                record.askComments = true;
                record.inputPlaceholder = TranslatedText.create($t(`%rG`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rF`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.MedicineAllergies:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rH`));
                record.askComments = true;
                record.inputPlaceholder = TranslatedText.create($t(`%rI`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rH`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.HayFever:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rJ`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rJ`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.OtherAllergies:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rK`));
                record.askComments = true;
                record.description = TranslatedLongText.create($t(`%rL`));
                record.inputPlaceholder = TranslatedText.create($t(`%rM`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rK`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.Vegetarian:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rN`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rO`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });

                break;

            case LegacyRecordType.Vegan:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rP`));
                record.description = TranslatedLongText.create($t(`%rQ`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rR`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });

                break;

            case LegacyRecordType.Halal:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rS`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rS`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });

                break;

            case LegacyRecordType.Kosher:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rT`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rT`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });

                break;

            case LegacyRecordType.Diet:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rU`));

                record.askComments = true;
                record.label = TranslatedText.create($t(`%rV`));
                record.description = TranslatedLongText.create($t(`%rW`));
                record.inputPlaceholder = TranslatedText.create($t(`%rX`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rU`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });

                break;

            case LegacyRecordType.CovidHighRisk:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rY`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedText.create($t(`%14p`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rY`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.TetanusVaccine:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rZ`));

                record.askComments = true;
                record.label = TranslatedText.create($t(`%ra`));
                record.description = TranslatedLongText.create($t(`%rb`));
                record.inputPlaceholder = TranslatedText.create($t(`%rc`));
                record.commentsDescription = TranslatedLongText.create($t(`%rd`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%re`)),
                    type: RecordWarningType.Info,
                    inverted: true,
                });

                break;

            case LegacyRecordType.Asthma:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rf`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedText.create($t(`%14p`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rf`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;
            case LegacyRecordType.BedWaters:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rg`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedText.create($t(`%14p`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rg`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;
            case LegacyRecordType.Epilepsy:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rh`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedText.create($t(`%14p`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rh`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;
            case LegacyRecordType.HeartDisease:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%ri`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedText.create($t(`%14p`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%ri`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;
            case LegacyRecordType.SkinCondition:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rj`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedText.create($t(`%14p`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rj`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;
            case LegacyRecordType.Rheumatism:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rk`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedText.create($t(`%14p`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rk`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });
                break;
            case LegacyRecordType.SleepWalking:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rl`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedText.create($t(`%14p`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rl`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });
                break;
            case LegacyRecordType.Diabetes:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%s`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedText.create($t(`%14p`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%s`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;

            case LegacyRecordType.Medicines:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rm`));

                record.askComments = true;
                record.description = TranslatedLongText.create($t(`%rn`));
                record.inputPlaceholder = TranslatedText.create($t(`%ro`));
                record.commentsDescription = TranslatedLongText.create($t(`%rp`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rq`)),
                    type: RecordWarningType.Error,
                    inverted: false,
                });
                break;

            case LegacyRecordType.SpecialHealthCare:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rr`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedText.create($t(`%rs`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rr`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.CanNotSwim:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rt`));
                record.askComments = false;

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rt`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;

            case LegacyRecordType.TiredQuickly:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%ru`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedText.create($t(`%rv`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%ru`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });
                break;

            case LegacyRecordType.CanNotParticipateInSport:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rw`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedText.create($t(`%rv`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rw`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });
                break;

            case LegacyRecordType.SpecialSocialCare:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%rx`));
                record.askComments = true;
                record.inputPlaceholder = TranslatedText.create($t(`%rv`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%rx`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;

            case LegacyRecordType.Other:
                record.name = TranslatedText.create($t(`%ry`));

                record.required = false;
                record.type = RecordType.Textarea;
                record.inputPlaceholder = TranslatedText.create($t(`%rz`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%s0`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;

            case LegacyRecordType.MedicinePermissions:
                record.type = RecordType.Checkbox;
                record.name = TranslatedText.create($t(`%r4`));

                record.sensitive = false;

                record.label = TranslatedText.create($t(`%s1`));
                record.description = TranslatedLongText.create($t(`%s2`));

                record.warning = RecordWarning.create({
                    text: TranslatedRichText.fromText($t(`%s3`)),
                    type: RecordWarningType.Error,
                    inverted: true,
                });

                break;

            default: {
                // If you get a compile error here, you are missing a type in the switch
                const other: never = type;
                throw new Error('Unsupported migration for type ' + other);
            }
        }

        return record;
    }

    static createDoctorName() {
        return RecordSettings.create({
            id: 'template-doctor-name',
            name: TranslatedText.create($t(`%s4`)),
            inputPlaceholder: TranslatedText.create($t(`%s5`)),
            type: RecordType.Text,
            required: true,
            sensitive: true,
            label: TranslatedText.create($t(`%1Os`)),
        });
    }

    static createDoctorPhone() {
        return RecordSettings.create({
            id: 'template-doctor-phone',
            name: TranslatedText.create($t(`%s6`)),
            inputPlaceholder: TranslatedText.create($t(`%wD`)),
            type: RecordType.Phone,
            required: true,
            label: TranslatedText.create($t(`%wD`)),
        });
    }

    static createDoctorCategory(required = true) {
        return RecordCategory.create({
            name: TranslatedText.create($t(`%s7`)),
            records: [
                this.createDoctorName(),
                this.createDoctorPhone(),
            ],
            // Allow to skip this step?
            filter: required
                ? undefined
                // Optional
                : new PropertyFilter(
                    {},
                    null,
                ),
        });
    }
}
