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
-- description: Tabblad 'Deelnemers_Bovenlokaal': de structuurvrijwilligers van de koepel, per geboortejaar en geslacht, met een aansluiting in dat werkjaar. Unieke personen, geen inschrijvingen: zo vraagt de metadatafiche het voor de nationale ploegen.
-- The rows before the koepel is dropped: this sheet is about nothing else.
WITH all_registrations AS (
    -- @include all-registrations
)
SELECT
    all_registrations.organization_uri AS `ID_Organisatie`,
    YEAR(all_registrations.birth_date) AS `Geboortejaar_deelnemers`,
    CASE all_registrations.`Geslacht` WHEN 'Man' THEN 'M' WHEN 'Vrouw' THEN 'V' ELSE NULL END AS `Gender_deelnemers`,
    COUNT(DISTINCT all_registrations.member_id) AS `Aantal_deelnemers`
FROM all_registrations
JOIN platform ON platform.membershipOrganizationId = all_registrations.organization_id
WHERE
    -- @include filter-has-delivery-membership
  -- A ploeg of the koepel, never one of the national events it also runs its registrations for: those
  -- are open to the deelnemers of every group, and counted here every one of them would be delivered
  -- as a structuurvrijwilliger of the bovenlokale structuur.
  AND all_registrations.group_type = 'Membership'
GROUP BY `ID_Organisatie`, `Geboortejaar_deelnemers`, `Gender_deelnemers`
ORDER BY `Geboortejaar_deelnemers`, `Gender_deelnemers`

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
-- description: Tabblad 'Deelnemers_Lokale_groep': de leden en de leiding van elke lokale groep, per geboortejaar en geslacht, met een aansluiting in dat werkjaar. Wie leiding is in de ene leeftijdsgroep en lid in de andere, telt enkel als leiding. Leeftijdsgroepen zonder categorie leveren niemand: vul die eerst aan.
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
            AS type_number
    FROM all_registrations
    WHERE
        -- @include filter-has-delivery-membership
      AND all_registrations.group_type = 'Membership'
      AND NOT EXISTS (SELECT 1 FROM platform WHERE platform.membershipOrganizationId = all_registrations.organization_id)
),
deelnemers AS (
    SELECT
        inschrijvingen.organization_uri,
        inschrijvingen.member_id,
        MAX(inschrijvingen.birth_date) AS birth_date,
        MAX(inschrijvingen.`Geslacht`) AS `Geslacht`,
        COALESCE(
            MAX(CASE WHEN inschrijvingen.deactivated_at IS NULL THEN inschrijvingen.type_number END),
            MAX(inschrijvingen.type_number)
        ) AS type_number
    FROM inschrijvingen
    GROUP BY inschrijvingen.organization_uri, inschrijvingen.member_id
)
SELECT
    deelnemers.organization_uri AS `ID_Organisatie`,
    CASE WHEN deelnemers.type_number = 2 THEN 'leiding' ELSE 'leden' END AS `Type_deelnemers`,
    YEAR(deelnemers.birth_date) AS `Geboortejaar_deelnemers`,
    CASE deelnemers.`Geslacht` WHEN 'Man' THEN 'M' WHEN 'Vrouw' THEN 'V' ELSE NULL END AS `Gender_deelnemers`,
    COUNT(DISTINCT deelnemers.member_id) AS `Aantal_deelnemers`
FROM deelnemers
WHERE deelnemers.type_number > 0
GROUP BY `ID_Organisatie`, `Type_deelnemers`, `Geboortejaar_deelnemers`, `Gender_deelnemers`
ORDER BY `ID_Organisatie`, `Type_deelnemers`, `Geboortejaar_deelnemers`, `Gender_deelnemers`
