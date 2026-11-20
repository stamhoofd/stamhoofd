import { DataRetentionCategory } from '@stamhoofd/structures';

export type DataRetentionCategoryTexts = {
    start: string;
    /**
     * Why anonymizing or deleting is not possible. An action that is not possible is not shown, so this is only set
     * where administrators expect that action.
     */
    cannotAnonymize: string | null;
    cannotDelete: string | null;
    /**
     * What happens to the data: a short title and its explanation.
     */
    effects: { label: string; text: string }[];
};

export function getDataRetentionCategoryTexts(category: DataRetentionCategory): DataRetentionCategoryTexts {
    switch (category) {
        case DataRetentionCategory.Members:
            return {
                start: $t('De termijn start op het einde of de uitschrijving van de laatste inschrijving. Zonder inschrijving start ze op de aanmaakdatum.'),
                cannotAnonymize: null,
                cannotDelete: null,
                effects: [
                    {
                        label: $t('Bij anonimiseren verdwijnen'),
                        text: $t('Naam, geboortedatum, geslacht, adres, contactgegevens, ouders, noodcontacten, antwoorden, notities, rijksregisternummers, UiTPAS-nummer, geüploade bestanden en de koppeling met accounts.'),
                    },
                    {
                        label: $t('Blijven bewaard'),
                        text: $t('Inschrijvingen, aansluitingen, prijzen en aanrekeningen, zonder naam. De aantallen blijven kloppen.'),
                    },
                    {
                        label: $t('Bij verwijderen verdwijnen ook'),
                        text: $t('De inschrijvingen, de aansluitingen en de documenten. De aantallen van oude werkjaren dalen. Aanrekeningen en betalingen blijven bewaard.'),
                    },
                    {
                        label: $t('Documenten'),
                        text: $t('Bij anonimiseren blijven ze staan tot de termijn van Documenten, met de naam erin.'),
                    },
                ],
            };
        case DataRetentionCategory.SensitiveData:
            return {
                start: $t('De termijn start op het einde of de uitschrijving van de laatste inschrijving. Zonder inschrijving start ze op de aanmaakdatum.'),
                cannotAnonymize: null,
                cannotDelete: null,
                effects: [
                    {
                        label: $t('Verdwijnen'),
                        text: $t('Antwoorden op vragen die als gevoelig gemarkeerd zijn, ernstige beperking en financiële ondersteuning. De rest van het lid blijft bewaard.'),
                    },
                ],
            };
        case DataRetentionCategory.Documents:
            return {
                start: $t('De termijn start op de aanmaakdatum van het document.'),
                cannotAnonymize: null,
                cannotDelete: null,
                effects: [
                    {
                        label: $t('Verdwijnen'),
                        text: $t('Documenten en attesten, ook met gegevens van ouders en betalers.'),
                    },
                    {
                        label: $t('Altijd'),
                        text: $t('Wordt een lid verwijderd, dan verdwijnen de documenten van dat lid mee, ook als deze termijn nog loopt.'),
                    },
                ],
            };
        case DataRetentionCategory.Accounts:
            return {
                start: $t('De termijn start op de laatste activiteit.'),
                cannotAnonymize: null,
                cannotDelete: null,
                effects: [
                    {
                        label: $t('Verdwijnen'),
                        text: $t('Accounts die nergens meer aan gekoppeld zijn: geen enkel lid, geen beheerdersrechten en geen openstaand bedrag.'),
                    },
                    {
                        label: $t('Let op'),
                        text: $t('Bij een webshop met verplichte login kan een klant zijn oude bestellingen niet meer openen zodra het account verwijderd is.'),
                    },
                ],
            };
        case DataRetentionCategory.Orders:
            return {
                start: $t('De termijn start op de besteldatum, of op het afhaalmoment of evenement als dat later is.'),
                cannotAnonymize: null,
                cannotDelete: $t('Bestellingen worden niet automatisch verwijderd: ze zijn nodig voor betalingen, terugbetalingen en jullie omzetcijfers. Na het anonimiseren staan er geen persoonsgegevens meer op de bestelling zelf.'),
                effects: [
                    {
                        label: $t('Blijft bewaard'),
                        text: $t('Nummer, datum, bestelde producten, bedragen en status.'),
                    },
                    {
                        label: $t('Verdwijnt'),
                        text: $t('Naam, e-mail, telefoon, geboortedatum, adres, opmerkingen, antwoorden en UiTPAS-nummers, ook per ticket.'),
                    },
                ],
            };
        case DataRetentionCategory.Emails:
            return {
                start: $t('De termijn start op de verzenddatum.'),
                cannotAnonymize: $t('E-mails kan je niet anonimiseren: in de tekst kunnen namen en andere gegevens staan die we niet betrouwbaar kunnen herkennen.'),
                cannotDelete: null,
                effects: [
                    {
                        label: $t('Verdwijnen'),
                        text: $t('Verstuurde berichten, bijlagen en ontvangers. Concepten die nooit verstuurd werden, blijven staan.'),
                    },
                    {
                        label: $t('Blijft bewaard'),
                        text: $t('Uitschrijvingen en bounces, zodat we iemand die zich uitschreef niet opnieuw mailen.'),
                    },
                ],
            };
        case DataRetentionCategory.AuditLogs:
            return {
                start: $t('De termijn start op de datum van de regel.'),
                cannotAnonymize: null,
                cannotDelete: null,
                effects: [
                    {
                        label: $t('Blijft bewaard'),
                        text: $t('Regels over de bewaartermijnen zelf. Die blijven altijd 5 jaar bewaard, zodat zichtbaar blijft wie wat besliste.'),
                    },
                ],
            };
    }
}
