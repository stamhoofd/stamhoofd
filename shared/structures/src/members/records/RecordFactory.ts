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
                    name: TranslatedString.create($t(`9ce28983-01ef-44bc-bc02-b76575bda1ce`)),
                });

            case LegacyRecordType.FoodAllergies:
            case LegacyRecordType.MedicineAllergies:
            case LegacyRecordType.HayFever:
            case LegacyRecordType.OtherAllergies:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.Allergies',
                    name: TranslatedString.create($t(`7bd0870e-3a5b-4533-899b-086de10ffaf5`)),
                });

            case LegacyRecordType.Vegetarian:
            case LegacyRecordType.Vegan:
            case LegacyRecordType.Halal:
            case LegacyRecordType.Kosher:
            case LegacyRecordType.Diet:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.Diet',
                    name: TranslatedString.create($t(`dd3e85ad-13af-4b65-9d02-5de3a616f192`)),
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
                    name: TranslatedString.create($t(`182f0993-3ee1-4ab9-806d-92ddd550ff10`)),
                });

            case LegacyRecordType.CanNotSwim:
            case LegacyRecordType.TiredQuickly:
            case LegacyRecordType.CanNotParticipateInSport:
            case LegacyRecordType.SpecialSocialCare:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.Sport',
                    name: TranslatedString.create($t(`1229e816-6508-417c-9523-f440e540de5e`)),
                });

            case LegacyRecordType.Other:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.Other',
                    name: TranslatedString.create($t(`69c9daf1-0d59-424d-a2fe-7301b312bc1a`)),
                });

            case LegacyRecordType.TetanusVaccine:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.TetanusVaccine',
                    name: TranslatedString.create($t(`ec30bede-5e9a-4153-a5cb-a1216398f52e`)),
                });

            case LegacyRecordType.MedicinePermissions: {
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.MedicinePermissions',
                    name: TranslatedString.create($t(`e3233072-9d41-4ed5-998f-c5647d6863ac`)),
                    description: TranslatedString.create($t(`d6d1b68b-b130-4210-ada4-967ad218f291`)),

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
                    name: TranslatedString.create($t(`be9c1f7e-6c6e-494c-b4bc-e9bf2a84c614`)),
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
                record.name = TranslatedString.create($t(`0c6c5935-9e97-473d-8e11-1273db291f02`));
                record.label = TranslatedString.create($t(`08bc3847-7b53-4f6a-9abf-68db402ea304`));
                record.choices = [
                    RecordChoice.create({
                        id: 'no',
                        name: TranslatedString.create($t(`bdccf69a-32c1-4a6d-b8d9-de97aa49a51f`)),
                        warning: RecordWarning.create({
                            id: '',
                            text: TranslatedString.create($t(`c000ad61-8b7a-4b44-ae50-f4b79cf38e0f`)),
                            type: RecordWarningType.Error,
                        }),
                    }),
                    RecordChoice.create({
                        id: 'yes',
                        name: TranslatedString.create($t(`ba71e7f2-5f97-4465-990e-677b24314f1a`)),
                    }),

                ];

                if (type == LegacyRecordType.GroupPicturePermissions) {
                    record.choices.push(
                        RecordChoice.create({
                            id: 'groups_only',
                            name: TranslatedString.create($t(`00e66af4-75a2-4e00-8b2e-f51ff670b800`)),
                            warning: RecordWarning.create({
                                id: '',
                                text: TranslatedString.create($t(`abde66eb-7ff2-4b18-894b-6b4061683b1d`)),
                                type: RecordWarningType.Error,
                            }),
                        }),
                    );
                }
                record.description = TranslatedString.create($t(`854847f7-2b76-4e2c-9579-012ea3e2272d`));
                break;

            case LegacyRecordType.FoodAllergies:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`9c2c1637-73b8-4cdb-9bc3-d521f1e8d4aa`));
                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`d6ed422e-faa8-4c1a-9bb0-1b9dd4c6fd64`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`9c2c1637-73b8-4cdb-9bc3-d521f1e8d4aa`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.MedicineAllergies:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`fa6ad9cc-81c6-4aab-857d-13168b0efeba`));
                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`2923f267-87b5-40a6-a1c2-101ad11ee0d7`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`fa6ad9cc-81c6-4aab-857d-13168b0efeba`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.HayFever:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`c88c0bac-2060-4e01-8484-4ae17ef37419`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`c88c0bac-2060-4e01-8484-4ae17ef37419`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.OtherAllergies:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`cde60c40-882f-4141-9d00-76d756621311`));
                record.askComments = true;
                record.description = TranslatedString.create($t(`c1514221-7fc2-4f2f-b72f-354c4fca161d`));
                record.inputPlaceholder = TranslatedString.create($t(`f7f21afc-b5ca-4039-b5d8-8c6d3dfb1757`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`cde60c40-882f-4141-9d00-76d756621311`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.Vegetarian:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`d956d123-dcac-4540-a5a6-e926767eb81b`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`cbe34d44-f421-4540-88b2-619c9ac213d4`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });

                break;

            case LegacyRecordType.Vegan:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`6aa550eb-fb90-4c5d-ae6f-ede0b23f4a60`));
                record.description = TranslatedString.create($t(`83c3c1be-6cd2-4360-a2f1-c6e807d1b23e`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`b5da58dd-0464-4b00-a45b-866ee7d5f993`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });

                break;

            case LegacyRecordType.Halal:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`4ec1c92b-1a1f-48d3-b680-9781b4a7c4fe`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`4ec1c92b-1a1f-48d3-b680-9781b4a7c4fe`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });

                break;

            case LegacyRecordType.Kosher:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`ffc67862-4e9c-4e04-9e06-7f0e349cdae0`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`ffc67862-4e9c-4e04-9e06-7f0e349cdae0`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });

                break;

            case LegacyRecordType.Diet:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`45da6a86-bef5-4876-a0c3-42133f173c3b`));

                record.askComments = true;
                record.label = TranslatedString.create($t(`6f09d81f-abca-4051-9911-3e880b70c022`));
                record.description = TranslatedString.create($t(`8d81c5e6-bb18-4d9f-ae0a-f6baadec6f16`));
                record.inputPlaceholder = TranslatedString.create($t(`d7b7f1ec-378e-41a7-b36a-20b1d67898e3`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`45da6a86-bef5-4876-a0c3-42133f173c3b`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });

                break;

            case LegacyRecordType.CovidHighRisk:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`c6898362-6352-4fe2-94d6-900e4ac10d3f`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`9e0461d2-7439-4588-837c-750de6946287`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`c6898362-6352-4fe2-94d6-900e4ac10d3f`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.TetanusVaccine:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`24cdd6b7-600b-48cd-acb4-2bd08527f945`));

                record.askComments = true;
                record.label = TranslatedString.create($t(`b3d1a53f-d24b-4f97-a07c-88f68eaee6dc`));
                record.description = TranslatedString.create($t(`ab064569-3380-4d02-9b81-ddc58ff25583`));
                record.inputPlaceholder = TranslatedString.create($t(`0fadc0c2-62b3-4e26-be91-1c05c0951be5`));
                record.commentsDescription = TranslatedString.create($t(`bcb4b068-4fcc-4edf-8ac7-7027f03616b3`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`d77cf693-37ae-4377-9aed-fffb30b6ae4d`)),
                    type: RecordWarningType.Info,
                    inverted: true,
                });

                break;

            case LegacyRecordType.Asthma:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`41a4c3ff-87e7-437e-89fc-65fdf72cbae6`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`9e0461d2-7439-4588-837c-750de6946287`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`41a4c3ff-87e7-437e-89fc-65fdf72cbae6`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;
            case LegacyRecordType.BedWaters:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`051f713e-dd20-44c3-9d68-d3c875641bb6`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`9e0461d2-7439-4588-837c-750de6946287`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`051f713e-dd20-44c3-9d68-d3c875641bb6`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;
            case LegacyRecordType.Epilepsy:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`3da1025f-617e-4d73-bf7a-29fb01b99481`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`9e0461d2-7439-4588-837c-750de6946287`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`3da1025f-617e-4d73-bf7a-29fb01b99481`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;
            case LegacyRecordType.HeartDisease:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`2c173797-5c56-49e4-8df3-93c975f2604c`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`9e0461d2-7439-4588-837c-750de6946287`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`2c173797-5c56-49e4-8df3-93c975f2604c`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;
            case LegacyRecordType.SkinCondition:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`b0073f07-9ec6-4a3b-9a29-b33305e6daaf`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`9e0461d2-7439-4588-837c-750de6946287`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`b0073f07-9ec6-4a3b-9a29-b33305e6daaf`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;
            case LegacyRecordType.Rheumatism:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`9cfc8622-6c37-4abb-871c-27c049792509`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`9e0461d2-7439-4588-837c-750de6946287`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`9cfc8622-6c37-4abb-871c-27c049792509`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });
                break;
            case LegacyRecordType.SleepWalking:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`0a6588e4-d367-4b57-b5a0-76a04bf49e63`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`9e0461d2-7439-4588-837c-750de6946287`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`0a6588e4-d367-4b57-b5a0-76a04bf49e63`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });
                break;
            case LegacyRecordType.Diabetes:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`425f3938-b431-406b-90c2-cdbb896ca21b`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`9e0461d2-7439-4588-837c-750de6946287`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`425f3938-b431-406b-90c2-cdbb896ca21b`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;

            case LegacyRecordType.Medicines:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`433cf808-ea38-4281-a793-e1b3c122e0aa`));

                record.askComments = true;
                record.description = TranslatedString.create($t(`348e8998-9cd8-430a-9091-f881c5556372`));
                record.inputPlaceholder = TranslatedString.create($t(`8e5b044b-36f1-4ba0-b4c4-3fe874cb2c69`));
                record.commentsDescription = TranslatedString.create($t(`cedb7dd6-0d70-4879-b8df-a9484376a8e4`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`1440d493-fa19-46d8-a888-1ef0f47587a5`)),
                    type: RecordWarningType.Error,
                    inverted: false,
                });
                break;

            case LegacyRecordType.SpecialHealthCare:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`f1d21fbd-4de7-4fa2-b385-51139a6c386c`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`8387966c-a43b-44ec-bcf5-f144a82078b5`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`f1d21fbd-4de7-4fa2-b385-51139a6c386c`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.CanNotSwim:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`1693bd3e-8bbf-4484-8941-fa58bb56a622`));
                record.askComments = false;

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`1693bd3e-8bbf-4484-8941-fa58bb56a622`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;

            case LegacyRecordType.TiredQuickly:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`04eb6bf0-a46b-47f4-bed8-6638802118f3`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`5f5561e5-1d01-4ba0-8b17-5ae69377b391`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`04eb6bf0-a46b-47f4-bed8-6638802118f3`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });
                break;

            case LegacyRecordType.CanNotParticipateInSport:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`8270f8f1-5a2b-4e78-9f7d-176ede0c1a0f`));

                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`5f5561e5-1d01-4ba0-8b17-5ae69377b391`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`8270f8f1-5a2b-4e78-9f7d-176ede0c1a0f`)),
                    type: RecordWarningType.Info,
                    inverted: false,
                });
                break;

            case LegacyRecordType.SpecialSocialCare:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`da49a991-dbb2-47fb-a635-ad6da01cbdee`));
                record.askComments = true;
                record.inputPlaceholder = TranslatedString.create($t(`5f5561e5-1d01-4ba0-8b17-5ae69377b391`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`da49a991-dbb2-47fb-a635-ad6da01cbdee`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;

            case LegacyRecordType.Other:
                record.name = TranslatedString.create($t(`200c66f5-c733-4a45-a70c-46f7b74d0798`));

                record.required = false;
                record.type = RecordType.Textarea;
                record.inputPlaceholder = TranslatedString.create($t(`80c477bb-cce1-45e6-95fb-c99e13b91019`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`d16f24db-050b-4b0a-a882-ddf92669f024`)),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;

            case LegacyRecordType.MedicinePermissions:
                record.type = RecordType.Checkbox;
                record.name = TranslatedString.create($t(`e3233072-9d41-4ed5-998f-c5647d6863ac`));

                record.sensitive = false;

                record.label = TranslatedString.create($t(`927f39c3-d73a-4d7e-b28e-c15b15e3e03f`));
                record.description = TranslatedString.create($t(`e38d5c19-993d-4689-8b33-af2ab38f3f26`));

                record.warning = RecordWarning.create({
                    text: TranslatedString.create($t(`c3735b67-dc33-401c-8da8-fe955dd93fec`)),
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
            name: TranslatedString.create($t(`b8bb0bd9-9f7a-410f-8563-ec752575cf63`)),
            inputPlaceholder: TranslatedString.create($t(`b3048a81-7f4d-46e0-857f-0aeb912fcb4b`)),
            type: RecordType.Text,
            required: true,
            sensitive: true,
            label: TranslatedString.create($t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)),
        });
    }

    static createDoctorPhone() {
        return RecordSettings.create({
            id: 'template-doctor-phone',
            name: TranslatedString.create($t(`da302836-9634-4dc0-9f21-c4743357d6b1`)),
            inputPlaceholder: TranslatedString.create($t(`de70b659-718d-445a-9dca-4d14e0a7a4ec`)),
            type: RecordType.Phone,
            required: true,
            label: TranslatedString.create($t(`de70b659-718d-445a-9dca-4d14e0a7a4ec`)),
        });
    }

    static createDoctorCategory(required = true) {
        return RecordCategory.create({
            name: TranslatedString.create($t(`20c6d52e-f748-434d-935e-cb11b7a6dd2b`)),
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
