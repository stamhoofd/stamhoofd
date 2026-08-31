-- @tab jeugdbewegingen
-- title: Jeugdbewegingen
-- dashboard: Groepen en Deelnemers - Departement Jeugd
-- description: De jaarlijkse aanlevering 'Groepen en Deelnemers Jeugdbewegingen' aan het Departement Cultuur, Jeugd en Media. Eén kaart per tabblad van het sjabloon: download ze via het pijltje rechtsonder op de kaart als .xlsx en plak ze in het aanleversjabloon.
-- filters: scoutsjaar
-- required: scoutsjaar

-- @card organisatie-bovenlokaal
-- title: Organisatie_Bovenlokaal
-- display: table
-- size: full
-- columns: ID_Organisatie, Naam_Organisatie
-- description: Tabblad 'Organisatie_Bovenlokaal': de bovenlokale of nationale ondersteuningsstructuur, namelijk de eigen organisatie van de koepel.
SELECT
    o.uri AS `ID_Organisatie`,
    o.name AS `Naam_Organisatie`
FROM organizations o
JOIN platform pf ON pf.membershipOrganizationId = o.id
JOIN registration_periods p ON p.id = o.periodId [[AND p.name = {{scoutsjaar}}]]
WHERE o.active = 1
GROUP BY o.uri, o.name
ORDER BY o.name

-- @card deelnemers-bovenlokaal
-- title: Deelnemers_Bovenlokaal
-- display: table
-- size: full
-- columns: ID_Organisatie, Geboortejaar_deelnemers, Gender_deelnemers, Aantal_deelnemers
-- description: Tabblad 'Deelnemers_Bovenlokaal': de structuurvrijwilligers van de koepel, per geboortejaar en geslacht, met een aansluiting in dat werkjaar. Unieke personen, geen inschrijvingen: zo vraagt de metadatafiche het voor de nationale ploegen.
-- @include facts
SELECT
    f.organization_uri AS `ID_Organisatie`,
    YEAR(f.birth_date) AS `Geboortejaar_deelnemers`,
    CASE f.`Geslacht` WHEN 'Man' THEN 'M' WHEN 'Vrouw' THEN 'V' ELSE NULL END AS `Gender_deelnemers`,
    COUNT(DISTINCT f.member_id) AS `Aantal_deelnemers`
FROM all_registrations f
JOIN platform pf ON pf.membershipOrganizationId = f.organization_id
WHERE
    -- @include aangesloten
  -- A ploeg of the koepel, never one of the national events it also runs its registrations for: those
  -- are open to the deelnemers of every group, and counted here every one of them would be delivered
  -- as a structuurvrijwilliger of the bovenlokale structuur.
  AND f.group_type = 'Membership'
GROUP BY `ID_Organisatie`, `Geboortejaar_deelnemers`, `Gender_deelnemers`
ORDER BY `Geboortejaar_deelnemers`, `Gender_deelnemers`

-- @card organisatie-lokale-groep
-- title: Organisatie_Lokale_groep
-- display: table
-- size: full
-- columns: ID_Organisatie, Naam_Organisatie, Postcode
-- description: Tabblad 'Organisatie_Lokale_groep': elke lokale jeugdbewegingsgroep met haar postcode. De eigen organisatie van de koepel staat hier niet in, die hoort op het tabblad Organisatie_Bovenlokaal. DCJM vult zelf Werkjaar, Type_organisatie en NIS-code aan.
SELECT
    o.uri AS `ID_Organisatie`,
    o.name AS `Naam_Organisatie`,
    CASE WHEN o.postalCode REGEXP '^[0-9]{4}$' THEN CAST(o.postalCode AS UNSIGNED) END AS `Postcode`
FROM organizations o
JOIN registration_periods p ON p.id = o.periodId [[AND p.name = {{scoutsjaar}}]]
WHERE o.active = 1
  AND NOT EXISTS (SELECT 1 FROM platform pf WHERE pf.membershipOrganizationId = o.id)
GROUP BY `ID_Organisatie`, `Naam_Organisatie`, `Postcode`
ORDER BY `Naam_Organisatie`

-- @card deelnemers-lokale-groep
-- title: Deelnemers_Lokale_groep
-- display: table
-- size: full
-- columns: ID_Organisatie, Type_deelnemers, Geboortejaar_deelnemers, Gender_deelnemers, Aantal_deelnemers
-- description: Tabblad 'Deelnemers_Lokale_groep': de leden en de leiding van elke lokale groep, per geboortejaar en geslacht, met een aansluiting in dat werkjaar. Wie leiding is in de ene tak en lid in de andere, telt enkel als leiding. Takken zonder categorie leveren niemand: vul die eerst aan.
-- description@ravot: Tabblad 'Deelnemers_Lokale_groep': de leden en de leiding van elke lokale groep, per geboortejaar en geslacht, met een aansluiting in dat werkjaar. De tak 'Ondersteunende leden' telt hier mee als leiding. Wie leiding is in de ene tak en lid in de andere, telt enkel als leiding. Takken zonder categorie leveren niemand: vul die eerst aan.
-- @include facts
, inschrijvingen AS (
    SELECT
        f.organization_uri,
        f.member_id,
        f.birth_date,
        f.`Geslacht`,
        f.deactivated_at,
        -- @include type-deelnemers
            AS type_number
    FROM all_registrations f
    WHERE
        -- @include aangesloten
      AND f.group_type = 'Membership'
      AND NOT EXISTS (SELECT 1 FROM platform pf WHERE pf.membershipOrganizationId = f.organization_id)
),
deelnemers AS (
    SELECT
        i.organization_uri,
        i.member_id,
        MAX(i.birth_date) AS birth_date,
        MAX(i.`Geslacht`) AS `Geslacht`,
        COALESCE(
            MAX(CASE WHEN i.deactivated_at IS NULL THEN i.type_number END),
            MAX(i.type_number)
        ) AS type_number
    FROM inschrijvingen i
    GROUP BY i.organization_uri, i.member_id
)
SELECT
    d.organization_uri AS `ID_Organisatie`,
    CASE WHEN d.type_number = 2 THEN 'leiding' ELSE 'leden' END AS `Type_deelnemers`,
    YEAR(d.birth_date) AS `Geboortejaar_deelnemers`,
    CASE d.`Geslacht` WHEN 'Man' THEN 'M' WHEN 'Vrouw' THEN 'V' ELSE NULL END AS `Gender_deelnemers`,
    COUNT(DISTINCT d.member_id) AS `Aantal_deelnemers`
FROM deelnemers d
where d.type_number > 0
GROUP BY `ID_Organisatie`, `Type_deelnemers`, `Geboortejaar_deelnemers`, `Gender_deelnemers`
ORDER BY `ID_Organisatie`, `Type_deelnemers`, `Geboortejaar_deelnemers`, `Gender_deelnemers`
