import { PropertyFilter } from "../../filters/PropertyFilter"
import { LegacyRecordType } from "./LegacyRecordType"
import { RecordCategory } from "./RecordCategory"
import { RecordChoice, RecordSettings, RecordType, RecordWarning, RecordWarningType } from "./RecordSettings"

export class RecordFactory {
    static getRecordCategory(type: LegacyRecordType): RecordCategory | undefined {
        switch (type) {
            case LegacyRecordType.FinancialProblems:
            case LegacyRecordType.DataPermissions:
                return undefined

            case LegacyRecordType.PicturePermissions:
            case LegacyRecordType.GroupPicturePermissions:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: "RecordCategory.Privacy",
                    name: "Privacy"
                })

            case LegacyRecordType.FoodAllergies:
            case LegacyRecordType.MedicineAllergies:
            case LegacyRecordType.HayFever:
            case LegacyRecordType.OtherAllergies:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: "RecordCategory.Allergies",
                    name: "Allergieën"
                })

            case LegacyRecordType.Vegetarian:
            case LegacyRecordType.Vegan:
            case LegacyRecordType.Halal:
            case LegacyRecordType.Kosher:
            case LegacyRecordType.Diet:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: "RecordCategory.Diet",
                    name: "Dieet"
                })

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
                    id: "RecordCategory.Health",
                    name: "Gezondheid, hygiëne & slapen"
                })

            case LegacyRecordType.CanNotSwim:
            case LegacyRecordType.TiredQuickly:
            case LegacyRecordType.CanNotParticipateInSport:
            case LegacyRecordType.SpecialSocialCare:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: "RecordCategory.Sport",
                    name: "Sport, spel en sociale omgang"
                })

            case LegacyRecordType.Other:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: "RecordCategory.Other",
                    name: "Andere inlichtingen"
                })

            case LegacyRecordType.TetanusVaccine:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: "RecordCategory.TetanusVaccine",
                    name: "Tetanusvaccinatie (klem)"
                })

            case LegacyRecordType.MedicinePermissions: {
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: "RecordCategory.MedicinePermissions",
                    name: "Toedienen van medicatie",
                    description: "Het is verboden om als begeleid(st)er, behalve EHBO, op eigen initiatief medische handelingen uit te voeren. Ook het verstrekken van lichte pijnstillende en koortswerende medicatie zoals Perdolan, Dafalgan of Aspirine is, zonder toelating van de ouders, voorbehouden aan een arts. Daarom is het noodzakelijk om via deze steekkaart vooraf toestemming van ouders te hebben voor het eventueel toedienen van dergelijke hulp.",
                    
                    // Only ask if <18y
                    filter: new PropertyFilter(
                        {
                            age: {
                                $lt: 18
                            }
                        }, 
                        {}
                    )
                })
            }

            default: {
                // If you get a compile error here, you are missing a type in the switch
                const other: never = type
                throw new Error("Unsupported category for type "+other)
            }
        }

        // others: keep name, don't repeat name
    }
    
    static convert(types: LegacyRecordType[]): RecordCategory[] {
        // Make sure all the types are sorted in the default ordering
        const allTypes = Object.values(LegacyRecordType)

        types.sort((a, b) => {
            const index1 = allTypes.findIndex(q => q == a)
            const index2 = allTypes.findIndex(q => q == b)
            return index1 - index2
        })

        let categories: RecordCategory[] = []

        for (const type of types) {
            const category = this.getRecordCategory(type)
            const settings = this.create(type)

            if (!category || !settings) {
                // Has custom migration
                continue
            }

            if (type == LegacyRecordType.PicturePermissions && types.includes(LegacyRecordType.GroupPicturePermissions) ) {
                // Skip: we ask group picture permissions alreadys
                continue
            }

            let exists = categories.find(c => c.id === category.id)

            if (!exists) {
                categories.push(category)
                exists = category
            }
            exists.records.push(settings)

        }

        if (categories.length > 0) {
            categories = [
                RecordCategory.create({
                    name: "Steekkaart",
                    childCategories: categories
                })
            ]
        }

        return categories
    }

    static create(type: LegacyRecordType): RecordSettings | null {
        const record = new RecordSettings()
        record.id = "legacy-type-"+type

        // Defaults
        record.required = false
        record.sensitive = true

        //record.encrypted = !this.isPublic(type)
        //record.sensitive = !this.isPublic(type)

        //record.type = RecordType.Checkbox
        //record.name = this.getName(type)


        switch (type) {
            case LegacyRecordType.FinancialProblems:
            case LegacyRecordType.DataPermissions:
                return null

            case LegacyRecordType.PicturePermissions:
            case LegacyRecordType.GroupPicturePermissions:

                // Force same id for group and normal pictures
                record.id = "legacy-type-"+LegacyRecordType.PicturePermissions
                record.sensitive = false
                record.type = RecordType.ChooseOne
                record.required = true
                record.name = "Toestemming foto's"
                record.label = "Toestemming publicatie foto's"
                record.choices = [
                    RecordChoice.create({
                        id: "no",
                        name: "Nee, ik geef geen toestemming",
                        warning: RecordWarning.create({
                            id: "",
                            text: "Geen toestemming voor publicatie foto's",
                            type: RecordWarningType.Error
                        })
                    }),
                    RecordChoice.create({
                        id: "yes",
                        name: "Ja, ik geef toestemming"
                    }),
                   
                ]

                if (type == LegacyRecordType.GroupPicturePermissions) {
                    record.choices.push( 
                        RecordChoice.create({
                            id: "groups_only",
                            name: "Ik geef enkel toestemming voor groepsfoto's",
                            warning: RecordWarning.create({
                                id: "",
                                text: "Enkel toestemming voor groepsfoto's",
                                type: RecordWarningType.Error
                            })
                        })
                    )
                }
                record.description = "Tijdens de activiteiten maken we soms foto's die we publiceren op de website en sociale media."
                break

            case LegacyRecordType.FoodAllergies:
                record.type = RecordType.Checkbox
                record.name = "Allergisch of overgevoelig voor bepaalde voeding"
                record.askComments = true
                record.inputPlaceholder = "Som hier op welke zaken (bv. noten, lactose, ...). Vul eventueel aan met enkele voorbeelden";
                
                record.warning = RecordWarning.create({
                    text: "Allergisch of overgevoelig voor bepaalde voeding",
                    type: RecordWarningType.Warning,
                    inverted: false
                })

                break

            case LegacyRecordType.MedicineAllergies:
                record.type = RecordType.Checkbox
                record.name = "Allergisch voor geneesmiddelen"
                record.askComments = true
                record.inputPlaceholder = "Som hier op welke zaken (bv. bepaalde antibiotica, ontsmettingsmiddelen, pijnstillers, ...). Vul eventueel aan met enkele voorbeelden";
                
                record.warning = RecordWarning.create({
                    text: "Allergisch voor geneesmiddelen",
                    type: RecordWarningType.Warning,
                    inverted: false
                })

                break

            case LegacyRecordType.HayFever:
                record.type = RecordType.Checkbox
                record.name = "Hooikoorts"

                record.warning = RecordWarning.create({
                    text: "Hooikoorts",
                    type: RecordWarningType.Warning,
                    inverted: false
                })

                break

            case LegacyRecordType.OtherAllergies:
                record.type = RecordType.Checkbox
                record.name = "Allergisch voor bepaalde zaken"
                record.askComments = true
                record.description = "Zoals verf, insecten..."
                record.inputPlaceholder = "Som hier op welke zaken";

                record.warning = RecordWarning.create({
                    text: "Allergisch voor bepaalde zaken",
                    type: RecordWarningType.Warning,
                    inverted: false
                })

                break

            case LegacyRecordType.Vegetarian:
                record.type = RecordType.Checkbox
                record.name = "Vegetarisch dieet"

                record.warning = RecordWarning.create({
                    text: "Vegetarisch",
                    type: RecordWarningType.Info,
                    inverted: false
                })
                
                break

            case LegacyRecordType.Vegan:
                record.type = RecordType.Checkbox
                record.name = "Veganistisch dieet"
                record.description = "Geen dierlijke producten"

                record.warning = RecordWarning.create({
                    text: "Veganistisch",
                    type: RecordWarningType.Info,
                    inverted: false
                })
                
                break

            case LegacyRecordType.Halal:
                record.type = RecordType.Checkbox
                record.name = "Halal dieet"
                
                record.warning = RecordWarning.create({
                    text: "Halal dieet",
                    type: RecordWarningType.Info,
                    inverted: false
                })

                break

            case LegacyRecordType.Kosher:
                record.type = RecordType.Checkbox
                record.name = "Koosjer dieet"

                record.warning = RecordWarning.create({
                    text: "Koosjer dieet",
                    type: RecordWarningType.Info,
                    inverted: false
                })
                
                break

            case LegacyRecordType.Diet:
                record.type = RecordType.Checkbox
                record.name = "Speciaal dieet"
                
                record.askComments = true
                record.label = "Ander dieet"
                record.description = "Geen allergieën"
                record.inputPlaceholder = "Beschrijving van ander soort dieet. Allergieën hoef je hier niet nog eens te vermelden.";
                
                record.warning = RecordWarning.create({
                    text: "Speciaal dieet",
                    type: RecordWarningType.Info,
                    inverted: false
                })

                break

            case LegacyRecordType.CovidHighRisk:
                record.type = RecordType.Checkbox
                record.name = "Hoog-risicogroep voor coronavirus"
                
                record.askComments = true
                record.inputPlaceholder = "Optioneel";

                record.warning = RecordWarning.create({
                    text: "Hoog-risicogroep voor coronavirus",
                    type: RecordWarningType.Warning,
                    inverted: false
                })
                
                break

            case LegacyRecordType.TetanusVaccine:
                record.type = RecordType.Checkbox
                record.name = "Tetanusvaccinatie"
                
                record.askComments = true
                record.label = "Is gevaccineerd tegen tetanus/klem in de afgelopen 10 jaar"
                record.description = "In de afgelopen 10 jaar"
                record.inputPlaceholder = "In welk jaar? (mag maximaal 10 jaar geleden zijn)";
                record.commentsDescription = "Een vaccinatie voor tetanus/klem is 10 jaar werkzaam, daarna is een nieuwe vaccinatie noodzakelijk."
                
                record.warning = RecordWarning.create({
                    text: "Geen tetanusvaccinatie in de afgelopen 10 jaar",
                    type: RecordWarningType.Info,
                    inverted: true
                })

                break

            case LegacyRecordType.Asthma:
                record.type = RecordType.Checkbox
                record.name = "Astma"
                
                record.askComments = true
                record.inputPlaceholder = "Optioneel";

                record.warning = RecordWarning.create({
                    text: "Astma",
                    type: RecordWarningType.Warning,
                    inverted: false
                })

                break
            case LegacyRecordType.BedWaters:
                record.type = RecordType.Checkbox
                record.name = "Bedwateren"
                
                record.askComments = true
                record.inputPlaceholder = "Optioneel";

                record.warning = RecordWarning.create({
                    text: "Bedwateren",
                    type: RecordWarningType.Warning,
                    inverted: false
                })
                break
            case LegacyRecordType.Epilepsy:
                record.type = RecordType.Checkbox
                record.name = "Epilepsie"
                
                record.askComments = true
                record.inputPlaceholder = "Optioneel";

                record.warning = RecordWarning.create({
                    text: "Epilepsie",
                    type: RecordWarningType.Warning,
                    inverted: false
                })
                break
            case LegacyRecordType.HeartDisease:
                record.type = RecordType.Checkbox
                record.name = "Hartaandoening"
                
                record.askComments = true
                record.inputPlaceholder = "Optioneel";

                record.warning = RecordWarning.create({
                    text: "Hartaandoening",
                    type: RecordWarningType.Warning,
                    inverted: false
                })

                break
            case LegacyRecordType.SkinCondition:
                record.type = RecordType.Checkbox
                record.name = "Huidaandoening"
                
                record.askComments = true
                record.inputPlaceholder = "Optioneel";

                record.warning = RecordWarning.create({
                    text: "Huidaandoening",
                    type: RecordWarningType.Warning,
                    inverted: false
                })
                break
            case LegacyRecordType.Rheumatism:
                record.type = RecordType.Checkbox
                record.name = "Reuma"
                
                record.askComments = true
                record.inputPlaceholder = "Optioneel";

                record.warning = RecordWarning.create({
                    text: "Reuma",
                    type: RecordWarningType.Info,
                    inverted: false
                })
                break
            case LegacyRecordType.SleepWalking:
                record.type = RecordType.Checkbox
                record.name = "Slaapwandelen"
                
                record.askComments = true
                record.inputPlaceholder = "Optioneel";

                record.warning = RecordWarning.create({
                    text: "Slaapwandelen",
                    type: RecordWarningType.Info,
                    inverted: false
                })
                break
            case LegacyRecordType.Diabetes:
                record.type = RecordType.Checkbox
                record.name = "Diabetes"
                
                record.askComments = true
                record.inputPlaceholder = "Optioneel";

                record.warning = RecordWarning.create({
                    text: "Diabetes",
                    type: RecordWarningType.Warning,
                    inverted: false
                })
                break

            case LegacyRecordType.Medicines:
                record.type = RecordType.Checkbox
                record.name = "Moet geneesmiddelen nemen"
                
                record.askComments = true
                record.description = "Dagelijks, wekelijks..."
                record.inputPlaceholder = "Welke, wanneer en hoe vaak?";
                record.commentsDescription = "Gelieve ons ook de noodzakelijke doktersattesten te bezorgen."

                record.warning = RecordWarning.create({
                    text: "Moet geneesmiddelen nemen (dagelijks/wekelijks/...)",
                    type: RecordWarningType.Error,
                    inverted: false
                })
                break

            case LegacyRecordType.SpecialHealthCare:
                record.type = RecordType.Checkbox
                record.name = "Speciale zorg om risico's te voorkomen"
                
                record.askComments = true
                record.inputPlaceholder = "Welke?";

                record.warning = RecordWarning.create({
                    text: "Speciale zorg om risico's te voorkomen",
                    type: RecordWarningType.Warning,
                    inverted: false
                })

                break

            case LegacyRecordType.CanNotSwim:
                record.type = RecordType.Checkbox
                record.name = "Kan niet (of onvoldoende) zwemmen"
                record.askComments = false

                record.warning = RecordWarning.create({
                    text: "Kan niet (of onvoldoende) zwemmen",
                    type: RecordWarningType.Warning,
                    inverted: false
                })
                break

            case LegacyRecordType.TiredQuickly:
                record.type = RecordType.Checkbox
                record.name = "Is snel moe"
                
                record.askComments = true
                record.inputPlaceholder = "Meer informatie";

                record.warning = RecordWarning.create({
                    text: "Is snel moe",
                    type: RecordWarningType.Info,
                    inverted: false
                })
                break
                            
            case LegacyRecordType.CanNotParticipateInSport:
                record.type = RecordType.Checkbox
                record.name = "Kan niet deelnemen aan sport en spel afgestemd op leeftijd"
                
                record.askComments = true
                record.inputPlaceholder = "Meer informatie";

                record.warning = RecordWarning.create({
                    text: "Kan niet deelnemen aan sport en spel afgestemd op leeftijd",
                    type: RecordWarningType.Info,
                    inverted: false
                })
                break

            case LegacyRecordType.SpecialSocialCare:
                record.type = RecordType.Checkbox
                record.name = "Bijzondere aandacht nodig bij sociale omgang"
                record.askComments = true
                record.inputPlaceholder = "Meer informatie";

                record.warning = RecordWarning.create({
                    text: "Bijzondere aandacht nodig bij sociale omgang",
                    type: RecordWarningType.Warning,
                    inverted: false
                })
                break


            case LegacyRecordType.Other:
                record.name = "Andere opmerking"
                
                record.required = false
                record.type = RecordType.Textarea
                record.inputPlaceholder = "Enkel invullen indien van toepassing";

                record.warning = RecordWarning.create({
                    text: "Andere opmerking!",
                    type: RecordWarningType.Warning,
                    inverted: false
                })
                break

            case LegacyRecordType.MedicinePermissions:
                record.type = RecordType.Checkbox
                record.name = "Toedienen van medicatie"

                record.sensitive = false
                
                record.label = "Wij geven toestemming aan de begeleiders om bij hoogdringendheid aan onze zoon of dochter een dosis via de apotheek vrij verkrijgbare pijnstillende en koortswerende medicatie toe te dienen*"
                record.description = "* gebaseerd op aanbeveling Kind & Gezin 09.12.2009 – Aanpak van koorts / Toedienen van geneesmiddelen in de kinderopvang";
                
                record.warning = RecordWarning.create({
                    text: "Geen toestemming voor het toedienen van medicatie",
                    type: RecordWarningType.Error,
                    inverted: true
                })

                break

            default: {
                // If you get a compile error here, you are missing a type in the switch
                const other: never = type
                throw new Error("Unsupported migration for type "+other)
            }
        }

        return record
    }

    static createDoctorName() {
        return RecordSettings.create({
            id: "template-doctor-name",
            name: "Naam huisarts",
            inputPlaceholder: "Huisarts of praktijknaam",
            type: RecordType.Text,
            required: true,
            sensitive: true,
            label: "Naam"
        })
    }

    static createDoctorPhone() {
        return RecordSettings.create({
            id: "template-doctor-phone",
            name: "Telefoon huisarts",
            inputPlaceholder: "Telefoonnummer",
            type: RecordType.Phone,
            required: true,
            label: "Telefoonnummer"
        })
    }

    static createDoctorCategory(required = true) {
        return RecordCategory.create({
            name: "Contactgegevens huisarts",
            records: [
                this.createDoctorName(),
                this.createDoctorPhone()
            ],
            // Allow to skip this step?
            filter: required ? 
                undefined
                // Optional
                : new PropertyFilter(
                    {}, 
                    null
                )
        })
    }
}
