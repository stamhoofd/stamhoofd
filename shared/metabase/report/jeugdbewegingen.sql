-- @tab jeugdbewegingen
-- title: Jeugdbewegingen
-- dashboard: Groepen en Deelnemers - Departement Jeugd
-- description: De jaarlijkse aanlevering 'Groepen en Deelnemers Jeugdbewegingen' aan het Departement Cultuur, Jeugd en Media. Eén kaart per tabblad van het sjabloon: download ze via het pijltje rechtsonder op de kaart als .xlsx en plak ze in het aanleversjabloon.
-- filters: werkjaar
-- required: werkjaar

-- @card organisatie-bovenlokaal
-- title: Organisatie_Bovenlokaal
-- display: table
-- size: full
-- columns: ID_Organisatie, Naam_Organisatie
-- description: Tabblad 'Organisatie_Bovenlokaal': de bovenlokale of nationale ondersteuningsstructuur, namelijk de eigen organisatie van de koepel.
SELECT
    organizations.uri AS `ID_Organisatie`,
    organizations.name AS `Naam_Organisatie`
FROM organizations
JOIN platform ON platform.membershipOrganizationId = organizations.id
JOIN registration_periods ON registration_periods.id = organizations.periodId [[AND registration_periods.name = {{werkjaar}}]]
WHERE organizations.active = 1
GROUP BY organizations.uri, organizations.name
ORDER BY organizations.name

-- @card deelnemers-bovenlokaal
-- title: Deelnemers_Bovenlokaal
-- display: table
-- size: full
-- columns: ID_Organisatie, Geboortejaar_deelnemers, Gender_deelnemers, Aantal_deelnemers
-- columns@keeo: ID_Organisatie, Geboortejaar_deelnemers, Aantal_deelnemers
-- description: Tabblad 'Deelnemers_Bovenlokaal': de structuurvrijwilligers van de koepel, per geboortejaar en geslacht, met een aansluiting in dat werkjaar. Unieke personen, geen inschrijvingen: zo vraagt de metadatafiche het voor de nationale ploegen.
-- description@keeo: Tabblad 'Deelnemers_Bovenlokaal': de structuurvrijwilligers van de koepel, per geboortejaar, met een aansluiting in dat werkjaar. Unieke personen, geen inschrijvingen: zo vraagt de metadatafiche het voor de nationale ploegen.
-- The rows before the koepel is dropped: this sheet is about nothing else.
WITH all_registrations AS (
    -- @include all-registrations
)
SELECT
    all_registrations.organization_uri AS `ID_Organisatie`,
    -- @include participant-details
    COUNT(DISTINCT all_registrations.member_id) AS `Aantal_deelnemers`
FROM all_registrations
JOIN platform ON platform.membershipOrganizationId = all_registrations.organization_id
WHERE
    -- @include filter-has-delivery-membership
  -- A ploeg of the koepel, never one of the national events it also runs its registrations for: those
  -- are open to the deelnemers of every group, and counted here every one of them would be delivered
  -- as a structuurvrijwilliger of the bovenlokale structuur.
  AND all_registrations.group_type = 'Membership'
GROUP BY `ID_Organisatie`,
    -- @include participant-detail-columns
ORDER BY
    -- @include participant-detail-columns

-- @card organisatie-lokale-groep
-- title: Organisatie_Lokale_groep
-- display: table
-- size: full
-- columns: ID_Organisatie, Naam_Organisatie, Postcode
-- description: Tabblad 'Organisatie_Lokale_groep': elke lokale jeugdbewegingsgroep met haar postcode. De eigen organisatie van de koepel staat hier niet in, die hoort op het tabblad Organisatie_Bovenlokaal. DCJM vult zelf Werkjaar, Type_organisatie en NIS-code aan.
SELECT
    organizations.uri AS `ID_Organisatie`,
    organizations.name AS `Naam_Organisatie`,
    CASE WHEN organizations.postalCode REGEXP '^[0-9]{4}$' THEN CAST(organizations.postalCode AS UNSIGNED) END AS `Postcode`
FROM organizations
JOIN registration_periods ON registration_periods.id = organizations.periodId [[AND registration_periods.name = {{werkjaar}}]]
WHERE organizations.active = 1
  AND NOT EXISTS (SELECT 1 FROM platform WHERE platform.membershipOrganizationId = organizations.id)
GROUP BY `ID_Organisatie`, `Naam_Organisatie`, `Postcode`
ORDER BY `Naam_Organisatie`

-- @card deelnemers-lokale-groep
-- title: Deelnemers_Lokale_groep
-- display: table
-- size: full
-- columns: ID_Organisatie, Type_deelnemers, Geboortejaar_deelnemers, Gender_deelnemers, Aantal_deelnemers
-- columns@keeo: ID_Organisatie, Type_deelnemers, Geboortejaar_deelnemers, Aantal_deelnemers, Waarvan Stam, Waarvan Ondersteunende leden
-- description: Tabblad 'Deelnemers_Lokale_groep': de leden en de leiding van elke lokale groep, per geboortejaar en geslacht, met een aansluiting in dat werkjaar. Wie leiding is in de ene leeftijdsgroep en lid in de andere, telt enkel als leiding. Leeftijdsgroepen zonder categorie leveren niemand: vul die eerst aan.
-- description@keeo: Tabblad 'Deelnemers_Lokale_groep': de leden en de leiding van elke lokale groep, per geboortejaar, met een aansluiting in dat werkjaar. De stam telt hier mee bij de leden en de ondersteunende leden bij de leiding; de twee laatste kolommen zeggen hoeveel van de rij daaronder geleverd worden en horen niet in het sjabloon. Wie leiding is in de ene leeftijdsgroep en lid in de andere, telt enkel als leiding. Leeftijdsgroepen zonder categorie leveren niemand: vul die eerst aan.
-- description@ravot: Tabblad 'Deelnemers_Lokale_groep': de leden en de leiding van elke lokale groep, per geboortejaar en geslacht, met een aansluiting in dat werkjaar. De leeftijdsgroep 'Ondersteunende leden' telt hier mee als leiding. Wie leiding is in de ene leeftijdsgroep en lid in de andere, telt enkel als leiding. Leeftijdsgroepen zonder categorie leveren niemand: vul die eerst aan.
WITH all_registrations AS (
    -- @include all-registrations
),
inschrijvingen AS (
    SELECT
        all_registrations.organization_uri,
        all_registrations.member_id,
        all_registrations.birth_date,
        all_registrations.`Geslacht`,
        all_registrations.deactivated_at,
        -- @include participant-type
            AS type_number,
        -- @include participant-subgroup
            AS subgroup_number
    FROM all_registrations
    WHERE
        -- @include filter-has-delivery-membership
      AND all_registrations.group_type = 'Membership'
      AND NOT EXISTS (SELECT 1 FROM platform WHERE platform.membershipOrganizationId = all_registrations.organization_id)
),
deelnemers AS (
    -- The registration that speaks for the member, which says both what they are delivered as and
    -- which aparte leeftijdsgroep that came from. One that still stands beats one that was
    -- cancelled, leiding beats lid, and a gewone leeftijdsgroep beats an aparte one that delivers
    -- the same type: someone leiding beside the ondersteunende leden is leiding, not ondersteunend.
    SELECT gekozen.* FROM (
        SELECT
            inschrijvingen.organization_uri,
            inschrijvingen.member_id,
            inschrijvingen.birth_date,
            inschrijvingen.`Geslacht`,
            inschrijvingen.type_number,
            inschrijvingen.subgroup_number,
            ROW_NUMBER() OVER (
                PARTITION BY inschrijvingen.organization_uri, inschrijvingen.member_id
                ORDER BY
                    (inschrijvingen.deactivated_at IS NULL) DESC,
                    inschrijvingen.type_number DESC,
                    inschrijvingen.subgroup_number
            ) AS rang
        FROM inschrijvingen
    ) gekozen
    WHERE gekozen.rang = 1
)
SELECT
    deelnemers.organization_uri AS `ID_Organisatie`,
    CASE WHEN deelnemers.type_number = 2 THEN 'leiding' ELSE 'leden' END AS `Type_deelnemers`,
    -- @include participant-details
    -- @include participant-counts
FROM deelnemers
WHERE deelnemers.type_number > 0
GROUP BY `ID_Organisatie`, `Type_deelnemers`,
    -- @include participant-detail-columns
ORDER BY `ID_Organisatie`, `Type_deelnemers`,
    -- @include participant-detail-columns
