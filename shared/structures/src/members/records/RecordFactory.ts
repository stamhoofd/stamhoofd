import { PropertyFilter } from '../../filters/PropertyFilter.js';
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
                    name: $t(`Privacy`),
                });

            case LegacyRecordType.FoodAllergies:
            case LegacyRecordType.MedicineAllergies:
            case LegacyRecordType.HayFever:
            case LegacyRecordType.OtherAllergies:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.Allergies',
                    name: $t(`Allergieën`),
                });

            case LegacyRecordType.Vegetarian:
            case LegacyRecordType.Vegan:
            case LegacyRecordType.Halal:
            case LegacyRecordType.Kosher:
            case LegacyRecordType.Diet:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.Diet',
                    name: $t(`Dieet`),
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
                    name: $t(`Gezondheid, hygiëne & slapen`),
                });

            case LegacyRecordType.CanNotSwim:
            case LegacyRecordType.TiredQuickly:
            case LegacyRecordType.CanNotParticipateInSport:
            case LegacyRecordType.SpecialSocialCare:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.Sport',
                    name: $t(`Sport, spel en sociale omgang`),
                });

            case LegacyRecordType.Other:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.Other',
                    name: $t(`Andere inlichtingen`),
                });

            case LegacyRecordType.TetanusVaccine:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.TetanusVaccine',
                    name: $t(`Tetanusvaccinatie (klem)`),
                });

            case LegacyRecordType.MedicinePermissions: {
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: 'RecordCategory.MedicinePermissions',
                    name: $t(`Toedienen van medicatie`),
                    description: $t(`Het is verboden om als begeleid(st)er, behalve EHBO, op eigen initiatief medische handelingen uit te voeren. Ook het verstrekken van lichte pijnstillende en koortswerende medicatie zoals Perdolan, Dafalgan of Aspirine is, zonder toelating van de ouders, voorbehouden aan een arts. Daarom is het noodzakelijk om via deze steekkaart vooraf toestemming van ouders te hebben voor het eventueel toedienen van dergelijke hulp.`),

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
                    name: $t(`Steekkaart`),
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
                record.name = $t(`Toestemming foto's`);
                record.label = $t(`Toestemming publicatie foto's`);
                record.choices = [
                    RecordChoice.create({
                        id: 'no',
                        name: $t(`Nee, ik geef geen toestemming`),
                        warning: RecordWarning.create({
                            id: '',
                            text: $t(`Geen toestemming voor publicatie foto's`),
                            type: RecordWarningType.Error,
                        }),
                    }),
                    RecordChoice.create({
                        id: 'yes',
                        name: $t(`Ja, ik geef toestemming`),
                    }),

                ];

                if (type == LegacyRecordType.GroupPicturePermissions) {
                    record.choices.push(
                        RecordChoice.create({
                            id: 'groups_only',
                            name: $t(`Ik geef enkel toestemming voor groepsfoto's`),
                            warning: RecordWarning.create({
                                id: '',
                                text: $t(`Enkel toestemming voor groepsfoto's`),
                                type: RecordWarningType.Error,
                            }),
                        }),
                    );
                }
                record.description = $t(`Tijdens de activiteiten maken we soms foto's die we publiceren op de website en sociale media.`);
                break;

            case LegacyRecordType.FoodAllergies:
                record.type = RecordType.Checkbox;
                record.name = $t(`Allergisch of overgevoelig voor bepaalde voeding`);
                record.askComments = true;
                record.inputPlaceholder = $t(`Som hier op welke zaken (bv. noten, lactose, ...). Vul eventueel aan met enkele voorbeelden`);

                record.warning = RecordWarning.create({
                    text: $t(`Allergisch of overgevoelig voor bepaalde voeding`),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.MedicineAllergies:
                record.type = RecordType.Checkbox;
                record.name = $t(`Allergisch voor geneesmiddelen`);
                record.askComments = true;
                record.inputPlaceholder = $t(`Som hier op welke zaken (bv. bepaalde antibiotica, ontsmettingsmiddelen, pijnstillers, ...). Vul eventueel aan met enkele voorbeelden`);

                record.warning = RecordWarning.create({
                    text: $t(`Allergisch voor geneesmiddelen`),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.HayFever:
                record.type = RecordType.Checkbox;
                record.name = $t(`Hooikoorts`);

                record.warning = RecordWarning.create({
                    text: $t(`Hooikoorts`),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.OtherAllergies:
                record.type = RecordType.Checkbox;
                record.name = $t(`Allergisch voor bepaalde zaken`);
                record.askComments = true;
                record.description = $t(`Zoals verf, insecten...`);
                record.inputPlaceholder = $t(`Som hier op welke zaken`);

                record.warning = RecordWarning.create({
                    text: $t(`Allergisch voor bepaalde zaken`),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.Vegetarian:
                record.type = RecordType.Checkbox;
                record.name = $t(`Vegetarisch dieet`);

                record.warning = RecordWarning.create({
                    text: $t(`Vegetarisch`),
                    type: RecordWarningType.Info,
                    inverted: false,
                });

                break;

            case LegacyRecordType.Vegan:
                record.type = RecordType.Checkbox;
                record.name = $t(`Veganistisch dieet`);
                record.description = $t(`Geen dierlijke producten`);

                record.warning = RecordWarning.create({
                    text: $t(`Veganistisch`),
                    type: RecordWarningType.Info,
                    inverted: false,
                });

                break;

            case LegacyRecordType.Halal:
                record.type = RecordType.Checkbox;
                record.name = $t(`Halal dieet`);

                record.warning = RecordWarning.create({
                    text: $t(`Halal dieet`),
                    type: RecordWarningType.Info,
                    inverted: false,
                });

                break;

            case LegacyRecordType.Kosher:
                record.type = RecordType.Checkbox;
                record.name = $t(`Koosjer dieet`);

                record.warning = RecordWarning.create({
                    text: $t(`Koosjer dieet`),
                    type: RecordWarningType.Info,
                    inverted: false,
                });

                break;

            case LegacyRecordType.Diet:
                record.type = RecordType.Checkbox;
                record.name = $t(`Speciaal dieet`);

                record.askComments = true;
                record.label = $t(`Ander dieet`);
                record.description = $t(`Geen allergieën`);
                record.inputPlaceholder = $t(`Beschrijving van ander soort dieet. Allergieën hoef je hier niet nog eens te vermelden.`);

                record.warning = RecordWarning.create({
                    text: $t(`Speciaal dieet`),
                    type: RecordWarningType.Info,
                    inverted: false,
                });

                break;

            case LegacyRecordType.CovidHighRisk:
                record.type = RecordType.Checkbox;
                record.name = $t(`Hoog-risicogroep voor coronavirus`);

                record.askComments = true;
                record.inputPlaceholder = $t(`Optioneel`);

                record.warning = RecordWarning.create({
                    text: $t(`Hoog-risicogroep voor coronavirus`),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.TetanusVaccine:
                record.type = RecordType.Checkbox;
                record.name = $t(`Tetanusvaccinatie`);

                record.askComments = true;
                record.label = $t(`Is gevaccineerd tegen tetanus/klem in de afgelopen 10 jaar`);
                record.description = $t(`In de afgelopen 10 jaar`);
                record.inputPlaceholder = $t(`In welk jaar? (mag maximaal 10 jaar geleden zijn)`);
                record.commentsDescription = $t(`Een vaccinatie voor tetanus/klem is 10 jaar werkzaam, daarna is een nieuwe vaccinatie noodzakelijk.`);

                record.warning = RecordWarning.create({
                    text: $t(`Geen tetanusvaccinatie in de afgelopen 10 jaar`),
                    type: RecordWarningType.Info,
                    inverted: true,
                });

                break;

            case LegacyRecordType.Asthma:
                record.type = RecordType.Checkbox;
                record.name = $t(`Astma`);

                record.askComments = true;
                record.inputPlaceholder = $t(`Optioneel`);

                record.warning = RecordWarning.create({
                    text: $t(`Astma`),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;
            case LegacyRecordType.BedWaters:
                record.type = RecordType.Checkbox;
                record.name = $t(`Bedwateren`);

                record.askComments = true;
                record.inputPlaceholder = $t(`Optioneel`);

                record.warning = RecordWarning.create({
                    text: $t(`Bedwateren`),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;
            case LegacyRecordType.Epilepsy:
                record.type = RecordType.Checkbox;
                record.name = $t(`Epilepsie`);

                record.askComments = true;
                record.inputPlaceholder = $t(`Optioneel`);

                record.warning = RecordWarning.create({
                    text: $t(`Epilepsie`),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;
            case LegacyRecordType.HeartDisease:
                record.type = RecordType.Checkbox;
                record.name = $t(`Hartaandoening`);

                record.askComments = true;
                record.inputPlaceholder = $t(`Optioneel`);

                record.warning = RecordWarning.create({
                    text: $t(`Hartaandoening`),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;
            case LegacyRecordType.SkinCondition:
                record.type = RecordType.Checkbox;
                record.name = $t(`Huidaandoening`);

                record.askComments = true;
                record.inputPlaceholder = $t(`Optioneel`);

                record.warning = RecordWarning.create({
                    text: $t(`Huidaandoening`),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;
            case LegacyRecordType.Rheumatism:
                record.type = RecordType.Checkbox;
                record.name = $t(`Reuma`);

                record.askComments = true;
                record.inputPlaceholder = $t(`Optioneel`);

                record.warning = RecordWarning.create({
                    text: $t(`Reuma`),
                    type: RecordWarningType.Info,
                    inverted: false,
                });
                break;
            case LegacyRecordType.SleepWalking:
                record.type = RecordType.Checkbox;
                record.name = $t(`Slaapwandelen`);

                record.askComments = true;
                record.inputPlaceholder = $t(`Optioneel`);

                record.warning = RecordWarning.create({
                    text: $t(`Slaapwandelen`),
                    type: RecordWarningType.Info,
                    inverted: false,
                });
                break;
            case LegacyRecordType.Diabetes:
                record.type = RecordType.Checkbox;
                record.name = $t(`Diabetes`);

                record.askComments = true;
                record.inputPlaceholder = $t(`Optioneel`);

                record.warning = RecordWarning.create({
                    text: $t(`Diabetes`),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;

            case LegacyRecordType.Medicines:
                record.type = RecordType.Checkbox;
                record.name = $t(`Moet geneesmiddelen nemen`);

                record.askComments = true;
                record.description = $t(`Dagelijks, wekelijks...`);
                record.inputPlaceholder = $t(`Welke, wanneer en hoe vaak?`);
                record.commentsDescription = $t(`Gelieve ons ook de noodzakelijke doktersattesten te bezorgen.`);

                record.warning = RecordWarning.create({
                    text: $t(`Moet geneesmiddelen nemen (dagelijks/wekelijks/...)`),
                    type: RecordWarningType.Error,
                    inverted: false,
                });
                break;

            case LegacyRecordType.SpecialHealthCare:
                record.type = RecordType.Checkbox;
                record.name = $t(`Speciale zorg om risico's te voorkomen`);

                record.askComments = true;
                record.inputPlaceholder = $t(`Welke?`);

                record.warning = RecordWarning.create({
                    text: $t(`Speciale zorg om risico's te voorkomen`),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });

                break;

            case LegacyRecordType.CanNotSwim:
                record.type = RecordType.Checkbox;
                record.name = $t(`Kan niet (of onvoldoende) zwemmen`);
                record.askComments = false;

                record.warning = RecordWarning.create({
                    text: $t(`Kan niet (of onvoldoende) zwemmen`),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;

            case LegacyRecordType.TiredQuickly:
                record.type = RecordType.Checkbox;
                record.name = $t(`Is snel moe`);

                record.askComments = true;
                record.inputPlaceholder = $t(`Meer informatie`);

                record.warning = RecordWarning.create({
                    text: $t(`Is snel moe`),
                    type: RecordWarningType.Info,
                    inverted: false,
                });
                break;

            case LegacyRecordType.CanNotParticipateInSport:
                record.type = RecordType.Checkbox;
                record.name = $t(`Kan niet deelnemen aan sport en spel afgestemd op leeftijd`);

                record.askComments = true;
                record.inputPlaceholder = $t(`Meer informatie`);

                record.warning = RecordWarning.create({
                    text: $t(`Kan niet deelnemen aan sport en spel afgestemd op leeftijd`),
                    type: RecordWarningType.Info,
                    inverted: false,
                });
                break;

            case LegacyRecordType.SpecialSocialCare:
                record.type = RecordType.Checkbox;
                record.name = $t(`Bijzondere aandacht nodig bij sociale omgang`);
                record.askComments = true;
                record.inputPlaceholder = $t(`Meer informatie`);

                record.warning = RecordWarning.create({
                    text: $t(`Bijzondere aandacht nodig bij sociale omgang`),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;

            case LegacyRecordType.Other:
                record.name = $t(`Andere opmerking`);

                record.required = false;
                record.type = RecordType.Textarea;
                record.inputPlaceholder = $t(`Enkel invullen indien van toepassing`);

                record.warning = RecordWarning.create({
                    text: $t(`Andere opmerking!`),
                    type: RecordWarningType.Warning,
                    inverted: false,
                });
                break;

            case LegacyRecordType.MedicinePermissions:
                record.type = RecordType.Checkbox;
                record.name = $t(`Toedienen van medicatie`);

                record.sensitive = false;

                record.label = $t(`Wij geven toestemming aan de begeleiders om bij hoogdringendheid aan onze zoon of dochter een dosis via de apotheek vrij verkrijgbare pijnstillende en koortswerende medicatie toe te dienen*`);
                record.description = $t(`* gebaseerd op aanbeveling Kind & Gezin 09.12.2009 – Aanpak van koorts / Toedienen van geneesmiddelen in de kinderopvang`);

                record.warning = RecordWarning.create({
                    text: $t(`Geen toestemming voor het toedienen van medicatie`),
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
            name: $t(`Naam huisarts`),
            inputPlaceholder: $t(`Huisarts of praktijknaam`),
            type: RecordType.Text,
            required: true,
            sensitive: true,
            label: $t(`Naam`),
        });
    }

    static createDoctorPhone() {
        return RecordSettings.create({
            id: 'template-doctor-phone',
            name: $t(`Telefoon huisarts`),
            inputPlaceholder: $t(`Telefoonnummer`),
            type: RecordType.Phone,
            required: true,
            label: $t(`Telefoonnummer`),
        });
    }

    static createDoctorCategory(required = true) {
        return RecordCategory.create({
            name: $t(`Contactgegevens huisarts`),
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
