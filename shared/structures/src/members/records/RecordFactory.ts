import { PropertyFilter } from '../../filters/PropertyFilter.js';
import { TranslatedString } from '../../TranslatedString.js';
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
                    name: TranslatedString.create($t(`%l`)),
                });

            case LegacyRecordType.FoodAllergies:
            case LegacyRecordType.MedicineAllergies:
            case LegacyRecordType.HayFever:
            case LegacyRecordType.OtherAllergies:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.Allergies',
                    name: TranslatedString.create($t(`%qy`)),
                });

            case LegacyRecordType.Vegetarian:
            case LegacyRecordType.Vegan:
            case LegacyRecordType.Halal:
            case LegacyRecordType.Kosher:
            case LegacyRecordType.Diet:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.Diet',
                    name: TranslatedString.create($t(`%qz`)),
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
                    name: TranslatedString.create($t(`%r0`)),
                });

            case LegacyRecordType.CanNotSwim:
            case LegacyRecordType.TiredQuickly:
            case LegacyRecordType.CanNotParticipateInSport:
            case LegacyRecordType.SpecialSocialCare:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.Sport',
                    name: TranslatedString.create($t(`%r1`)),
                });

            case LegacyRecordType.Other:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.Other',
                    name: TranslatedString.create($t(`%r2`)),
                });

            case LegacyRecordType.TetanusVaccine:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.TetanusVaccine',
                    name: TranslatedString.create($t(`%r3`)),
                });

            case LegacyRecordType.MedicinePermissions: {
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.MedicinePermissions',
                    name: TranslatedString.create($t(`%r4`)),
                    description: TranslatedString.create($t(`%r5`)),

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
                    name: TranslatedString.create($t(`%r6`)),
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
                record.name = TranslatedString.create($t(`%r7`));
                record.label = TranslatedString.create($t(`%r8`));
                record.choices = [
                    RecordChoice.create({
                        id: 'no',
                        name: TranslatedString.create($t(`%r9`)),
                        warning: RecordWarning.create({
                            id: '',
                            text: TranslatedString.create($t(`%rA`)),
                            type: RecordWarningType.Error,
                        }),
                    }),
                    RecordChoice.create({
                        id: 'yes',
                        name: TranslatedString.create($t(`%rB`)),
                    }),

                ];

                if (type == LegacyRecordType.GroupPicturePermissions) {
                    record.choices.push(
                        RecordChoice.create({
                            id: 'groups_only',
                            name: TranslatedString.create($t(`%rC`)),
                            warning: RecordWarning.create({
                                id: '',
                                text: TranslatedString.create($t(`%rD`)),
                                type: RecordWarningType.Error,
                            }),
                        }),
                    );
                }
                record.description = TranslatedString.create($t(`%rE`));
                break;

            case LegacyRecordType.FoodAllergies:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rF`));
                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`%rG`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rF`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.MedicineAllergies:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rH`));
                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`%rI`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rH`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.HayFever:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rJ`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rJ`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.OtherAllergies:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rK`));
                record.askComments = true;
                record.description = TranslatedString.create($t(`%rL`));
                record.inputPlaceholder = TranslatedString.create($t(`%rM`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rK`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.Vegetarian:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rN`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rO`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });

                break;

            case LegacyRecordType.Vegan:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rP`));
                record.description = TranslatedString.create($t(`%rQ`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rR`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });

                break;

            case LegacyRecordType.Halal:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rS`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rS`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });

                break;

            case LegacyRecordType.Kosher:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rT`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rT`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });

                break;

            case LegacyRecordType.Diet:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rU`));

                record.askComments = true;
                record.label = TranslatedString.create($t(`%rV`));
                record.description = TranslatedString.create($t(`%rW`));
                record.inputPlaceholder = TranslatedString.create($t(`%rX`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rU`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });

                break;

            case LegacyRecordType.CovidHighRisk:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rY`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`%14p`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rY`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.TetanusVaccine:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rZ`));

                record.askComments = true;
                record.label = TranslatedString.create($t(`%ra`));
                record.description = TranslatedString.create($t(`%rb`));
                record.inputPlaceholder = TranslatedString.create($t(`%rc`));
                record.commentsDescription = TranslatedString.create($t(`%rd`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%re`)),
                    type: RecordWarningType.Info,
                    inverted: true,
                });

                break;

            case LegacyRecordType.Asthma:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rf`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`%14p`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rf`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;
            case LegacyRecordType.BedWaters:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rg`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`%14p`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rg`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;
            case LegacyRecordType.Epilepsy:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rh`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`%14p`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rh`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;
            case LegacyRecordType.HeartDisease:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%ri`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`%14p`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%ri`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;
            case LegacyRecordType.SkinCondition:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rj`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`%14p`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rj`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;
            case LegacyRecordType.Rheumatism:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rk`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`%14p`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rk`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });
                break;
            case LegacyRecordType.SleepWalking:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rl`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`%14p`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rl`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });
                break;
            case LegacyRecordType.Diabetes:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%s`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`%14p`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%s`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;

            case LegacyRecordType.Medicines:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rm`));

                record.askComments = true;
                record.description = TranslatedString.create($t(`%rn`));
                record.inputPlaceholder = TranslatedString.create($t(`%ro`));
                record.commentsDescription = TranslatedString.create($t(`%rp`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rq`)),
                    type: RecordWarningType.Error,
                    inverted: false,
                });
                break;

            case LegacyRecordType.SpecialHealthCare:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rr`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`%rs`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rr`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.CanNotSwim:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rt`));
                record.askComments = false;

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rt`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;

            case LegacyRecordType.TiredQuickly:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%ru`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`%rv`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%ru`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });
                break;

            case LegacyRecordType.CanNotParticipateInSport:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rw`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`%rv`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rw`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });
                break;

            case LegacyRecordType.SpecialSocialCare:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%rx`));
                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`%rv`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%rx`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;

            case LegacyRecordType.Other:
                record.name = TranslatedString.create($t(`%ry`));

                record.required = false;
                record.type = RecordType.Textarea;
                record.inputPlaceholder = TranslatedString.create($t(`%rz`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%s0`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;

            case LegacyRecordType.MedicinePermissions:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`%r4`));

                record.sensitive = false;

                record.label = TranslatedString.create($t(`%s1`));
                record.description = TranslatedString.create($t(`%s2`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`%s3`)),
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
            name: TranslatedString.create($t(`%s4`)),
            inputPlaceholder: TranslatedString.create($t(`%s5`)),
            type: RecordType.Text,
            required: true,
            sensitive: true,
            label: TranslatedString.create($t(`%1Os`)),
        });
    }

    static createDoctorPhone() {
        return RecordSettings.create({
            id: 'template-doctor-phone',
            name: TranslatedString.create($t(`%s6`)),
            inputPlaceholder: TranslatedString.create($t(`%wD`)),
            type: RecordType.Phone,
            required: true,
            label: TranslatedString.create($t(`%wD`)),
        });
    }

    static createDoctorCategory(required = true) {
        return RecordCategory.create({
            name: TranslatedString.create($t(`%s7`)),
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
