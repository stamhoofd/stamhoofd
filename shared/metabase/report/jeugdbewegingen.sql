-- @tab jeugdbewegingen
-- title: Jeugdbewegingen
-- dashboard: Groepen en Deelnemers - Departement Jeugd
-- description: De jaarlijkse aanlevering 'Groepen en Deelnemers Jeugdbewegingen' aan het Departement Cultuur, Jeugd en Media. Eén kaart per tabblad van het sjabloon: download ze via het pijltje rechtsonder op de kaart als .xlsx en plak ze in het aanleversjabloon.
-- filters: scoutsjaar, aansluiting
--
-- The dataset a koepel delivers every september, over the werkjaar that ended in august. One card per
-- sheet of the delivery template, holding the columns the koepel fills in, in the order and under the
-- exact names that template gives them. The columns the department fills in itself -- Werkjaar,
-- Type_organisatie, NIS-code -- are deliberately absent.
--
-- On a dashboard of its own, unlike every other tab here: this mirrors no page of the client's own
-- report, and what it is for -- an aanlevering to a government department, once a year -- has nothing
-- to do with the figures the ledenstatistieken are read for.
--
-- A werkjaar runs september to august, which is what a period spans here, so the scoutsjaar filter is
-- what picks one. No sheet carries it as a column, since the department fills that in itself, but it
-- decides which organisations and which deelnemers each of them holds.
--
-- The aansluiting filter reaches the two deelnemers sheets and neither of the organisatie ones:
-- those list which groups existed in the werkjaar, which is not a question about members. Delivering
-- under a chosen aansluiting therefore hands the department groups whose deelnemers were counted
-- under it only -- the aanlevering itself is filed with the filter empty.

-- @card organisatie-bovenlokaal
-- title: Organisatie_Bovenlokaal
-- display: table
-- size: full
-- columns: ID_Organisatie, Naam_Organisatie
-- description: Tabblad 'Organisatie_Bovenlokaal': de bovenlokale of nationale ondersteuningsstructuur, namelijk de eigen organisatie van de koepel.
--
-- One row: the organization the platform runs itself, which `platform.membershipOrganizationId`
-- points at. Everything else in the administration is a local group, and the ploegen of the koepel
-- count as a single structure, so this sheet holds exactly that one organization.
--
-- Named as it stood in the werkjaar, which is why the name comes from `organizations` and not from
-- the platform: a unit's name is recorded per period, and a rename lands in the year it happened in.
-- A werkjaar the koepel's own organization holds no row for -- one it had no registrations in --
-- delivers nothing rather than a name from another year.
SELECT
    o.id AS `ID_Organisatie`,
    o.name AS `Naam_Organisatie`
FROM organizations o
JOIN platform pf ON pf.membershipOrganizationId = o.id
JOIN registration_periods p ON p.id = o.periodId [[AND p.name = {{scoutsjaar}}]]
GROUP BY o.id, o.name
ORDER BY o.name

-- @card deelnemers-bovenlokaal
-- title: Deelnemers_Bovenlokaal
-- display: table
-- size: full
-- columns: ID_Organisatie, Geboortejaar_deelnemers, Gender_deelnemers, Aantal_deelnemers
-- description: Tabblad 'Deelnemers_Bovenlokaal': de structuurvrijwilligers van de koepel, per geboortejaar en geslacht, met een aansluiting in dat werkjaar. Unieke personen, geen inschrijvingen: zo vraagt de metadatafiche het voor de nationale ploegen.
--
-- The deelnemers of the structure the sheet above delivers: everyone aangesloten at the koepel's own
-- organization in that werkjaar. Being registered there is the engagement that makes someone a
-- structuurvrijwilliger -- nothing in the administration says what a person does within a ploeg -- so
-- a registration with an aansluiting behind it is what this counts.
--
-- Unique people rather than registrations, which is what the metadatafiche asks for at this one
-- organization: the national ploegen count as a single structure, so someone in two of them is one
-- deelnemer. Someone who is also leiding at a local group keeps counting there as well, on the sheet
-- of that group -- the two are counted at different organizations.
--
-- An empty cell wherever the administration has no answer, which is what the metadatafiche asks for
-- rather than a value of its own: a member without a date of birth gets no geboortejaar, and one
-- whose geslacht was never filled in gets no letter, since the CASE has no ELSE to fall back on.
--
-- Read from `all_registrations` rather than from `facts`, on two counts. The ledenstatistieken leave
-- this organization out and this sheet is the one thing that is about it; and they leave out a
-- registration that was cancelled during the year, while the department counts everyone who was
-- registered at some point in the werkjaar -- someone who stopped in november was a deelnemer of that
-- year, and the aansluiting the koepel charged them says so.
-- @include facts
SELECT
    f.organization_id AS `ID_Organisatie`,
    YEAR(f.birth_date) AS `Geboortejaar_deelnemers`,
    CASE f.`Geslacht` WHEN 'Man' THEN 'M' WHEN 'Vrouw' THEN 'V' ELSE NULL END AS `Gender_deelnemers`,
    COUNT(DISTINCT f.member_id) AS `Aantal_deelnemers`
FROM all_registrations f
JOIN platform pf ON pf.membershipOrganizationId = f.organization_id
WHERE
    -- @include aangesloten
GROUP BY `ID_Organisatie`, `Geboortejaar_deelnemers`, `Gender_deelnemers`
ORDER BY `Geboortejaar_deelnemers`, `Gender_deelnemers`

-- @card organisatie-lokale-groep
-- title: Organisatie_Lokale_groep
-- display: table
-- size: full
-- columns: ID_Organisatie, Naam_Organisatie, Postcode
-- description: Tabblad 'Organisatie_Lokale_groep': elke lokale jeugdbewegingsgroep met haar postcode. De eigen organisatie van de koepel staat hier niet in, die hoort op het tabblad Organisatie_Bovenlokaal. DCJM vult zelf Werkjaar, Type_organisatie en NIS-code aan.
--
-- Every organization in the administration except the one the platform runs itself: that one is the
-- bovenlokale structuur of the sheet above, and the department reads one organization per row across
-- the two, so a unit on both would be a unit counted twice. Dropped on
-- `platform.membershipOrganizationId`, the way every card of the ledenstatistieken drops it.
--
-- Read from `organizations` rather than from the members: what the sheet lists is which groups
-- existed in that werkjaar, so a unit that registered nobody is a group with no deelnemers rather
-- than no group. That also means a unit that has stopped keeps being delivered while its year is
-- still open, since a row here is not evidence of anything having happened.
--
-- The template's datatype for a postcode is a four digit number, and what the administration holds is
-- free text: a foreign postcode, or an entire address typed into the box. Anything that is not four
-- digits leaves the cell empty -- a required field the koepel can see and fill in -- rather than
-- delivering a number that is wrong.
SELECT
    o.id AS `ID_Organisatie`,
    o.name AS `Naam_Organisatie`,
    CASE WHEN o.postalCode REGEXP '^[0-9]{4}$' THEN CAST(o.postalCode AS UNSIGNED) END AS `Postcode`
FROM organizations o
JOIN registration_periods p ON p.id = o.periodId [[AND p.name = {{scoutsjaar}}]]
WHERE NOT EXISTS (SELECT 1 FROM platform pf WHERE pf.membershipOrganizationId = o.id)
GROUP BY `ID_Organisatie`, `Naam_Organisatie`, `Postcode`
ORDER BY `Naam_Organisatie`

-- @card deelnemers-lokale-groep
-- title: Deelnemers_Lokale_groep
-- display: table
-- size: full
-- columns: ID_Organisatie, Type_deelnemers, Geboortejaar_deelnemers, Gender_deelnemers, Aantal_deelnemers
-- description: Tabblad 'Deelnemers_Lokale_groep': de leden en de leiding van elke lokale groep, per geboortejaar en geslacht, met een aansluiting in dat werkjaar. Wie in de Leiding-tak zit, telt enkel als leiding, ook al is die daarnaast in een andere tak ingeschreven.
--
-- The deelnemers of the groups the sheet above delivers, split into the two words the template
-- allows: 'leden' and 'leiding', that exact spelling.
--
-- Leiding is read off the tak first: a registration in the Leiding tak makes someone leiding whatever
-- else they are registered for. That has to come before the categorie, which is what the rest of the
-- report splits by, because a platform that never filled in `default_age_groups`.`category` falls
-- back to the age -- and a leider of seventeen is then read as a kind.
--
-- After that the categorie decides: a kind is a lid, and everyone else is leiding. That covers the
-- volwassen begeleiders, kassabeheerders and secretarissen the metadatafiche counts as leiding, and
-- the imported registrations with no tak at all, which belong to adults -- anyone under 18 without a
-- tak was already read as a kind.
--
-- Decided once per member per group, before anything is counted. Someone can be a lid in one tak and
-- leiding in another of the same unit, and the metadatafiche is explicit that they are leiding there
-- and not a lid; counted per registration they would be one person delivered in both rows, and the
-- group would report more deelnemers than it has. The date of birth and the geslacht are taken the
-- same way, so that a member whose answer was corrected between two werkjaren cannot split into two
-- people either.
--
-- Decided by the registrations that still stand, and by the cancelled ones only when none of them do.
-- A cancelled registration says someone was there, not what they were: an administrator who puts a
-- lid in the Leiding tak by mistake and undoes it would otherwise leave them leiding for the rest of
-- the werkjaar, while the registration they really hold says what they are. A member whose
-- registrations at the group were all cancelled -- someone who left during the year -- has nothing
-- else to be read from, and is what the cancelled ones are kept for.
--
-- One row per member per group is also what the counting asks for. The metadatafiche counts
-- inschrijvingen rather than unique inschrijvers, and says what it means by that: someone registered
-- at two groups counts at both. Within one group they are one deelnemer, however many takken they are
-- registered in.
--
-- Read from `all_registrations`, which keeps the registrations that were cancelled during the year:
-- someone who stopped in november was a deelnemer of that werkjaar. The koepel's own organization is
-- dropped here rather than by reading `facts`, since that would drop those registrations with it.
-- @include facts
, inschrijvingen AS (
    SELECT
        f.organization_id,
        f.member_id,
        f.birth_date,
        f.`Geslacht`,
        f.deactivated_at,
        CASE WHEN f.`Tak` = 'Leiding' THEN 1 WHEN f.categorie = 'child' THEN 0 ELSE 1 END AS is_leiding
    FROM all_registrations f
    WHERE
        -- @include aangesloten
      AND NOT EXISTS (SELECT 1 FROM platform pf WHERE pf.membershipOrganizationId = f.organization_id)
),
deelnemers AS (
    SELECT
        i.organization_id,
        i.member_id,
        MAX(i.birth_date) AS birth_date,
        MAX(i.`Geslacht`) AS `Geslacht`,
        COALESCE(
            MAX(CASE WHEN i.deactivated_at IS NULL THEN i.is_leiding END),
            MAX(i.is_leiding)
        ) AS is_leiding
    FROM inschrijvingen i
    GROUP BY i.organization_id, i.member_id
)
SELECT
    d.organization_id AS `ID_Organisatie`,
    CASE WHEN d.is_leiding = 1 THEN 'leiding' ELSE 'leden' END AS `Type_deelnemers`,
    YEAR(d.birth_date) AS `Geboortejaar_deelnemers`,
    CASE d.`Geslacht` WHEN 'Man' THEN 'M' WHEN 'Vrouw' THEN 'V' ELSE NULL END AS `Gender_deelnemers`,
    COUNT(DISTINCT d.member_id) AS `Aantal_deelnemers`
FROM deelnemers d
GROUP BY `ID_Organisatie`, `Type_deelnemers`, `Geboortejaar_deelnemers`, `Gender_deelnemers`
ORDER BY `ID_Organisatie`, `Type_deelnemers`, `Geboortejaar_deelnemers`, `Gender_deelnemers`
