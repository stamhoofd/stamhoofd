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
--
-- What the ledenstatistieken offer as "Ingeschreven voor" is not offered here. The department counts
-- the deelnemers of a jeugdbeweging: someone waiting for a place has not joined one, and someone who
-- came to a single activity is a deelnemer of that activity rather than of the group that held it.
-- Both sheets therefore say `group_type = 'Membership'` themselves rather than leaving it to a filter
-- this dashboard does not show -- an unanswered filter counts every registration, which is the wrong
-- way for a sheet to fail.

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
-- description: Tabblad 'Deelnemers_Lokale_groep': de leden en de leiding van elke lokale groep, per geboortejaar en geslacht, met een aansluiting in dat werkjaar. Wie leiding is in de ene tak en lid in de andere, telt enkel als leiding. Takken zonder categorie leveren niemand: vul die eerst aan.
--
-- The deelnemers of the groups the sheet above delivers, split into the two words the template
-- allows: 'leden' and 'leiding', that exact spelling.
--
-- Read from `tak_category`, what the takken were recorded as, and never from `effective_category`,
-- which the ledenstatistieken split by. That one falls back to the ages so nobody drops out of a
-- total, and the ages cannot tell leiding from anything: a leider of seventeen reads as a kind and
-- one of twenty as nothing at all. A sheet that goes to a department may not guess, so a tak nobody
-- has categorised delivers nobody here -- visibly missing rather than quietly counted as leden.
--
-- Only the two the template allows are delivered. A tak recorded as volwassenen is neither, and its
-- members are left out of the sheet entirely; the metadatafiche does count the volwassen
-- begeleiders, kassabeheerders and secretarissen of a group as leiding, so a koepel with such a tak
-- has to say whether it is leiding rather than leaving it as volwassenen.
--
-- The numbers rank rather than label: leiding beats leden, and leden beats a tak that is neither,
-- so the MAX below picks the strongest thing any registration of that member says.
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
        CASE WHEN f.tak_category = 'leader' THEN 2 WHEN f.tak_category = 'child' THEN 1 ELSE 0 END AS type_number
    FROM all_registrations f
    WHERE
        -- @include aangesloten
      -- The takken of the group and nothing else. A wachtlijst and an activiteit carry no tak, so
      -- they already deliver nobody through `type_number` below; said here as well because that is a
      -- consequence of a group nobody categorised rather than a rule, and a koepel that categorises
      -- one of its wachtlijsten would start delivering the people waiting on it as leden.
      AND f.group_type = 'Membership'
      AND NOT EXISTS (SELECT 1 FROM platform pf WHERE pf.membershipOrganizationId = f.organization_id)
),
deelnemers AS (
    SELECT
        i.organization_id,
        i.member_id,
        MAX(i.birth_date) AS birth_date,
        MAX(i.`Geslacht`) AS `Geslacht`,
        COALESCE(
            MAX(CASE WHEN i.deactivated_at IS NULL THEN i.type_number END),
            MAX(i.type_number)
        ) AS type_number
    FROM inschrijvingen i
    GROUP BY i.organization_id, i.member_id
)
SELECT
    d.organization_id AS `ID_Organisatie`,
    CASE WHEN d.type_number = 2 THEN 'leiding' ELSE 'leden' END AS `Type_deelnemers`,
    YEAR(d.birth_date) AS `Geboortejaar_deelnemers`,
    CASE d.`Geslacht` WHEN 'Man' THEN 'M' WHEN 'Vrouw' THEN 'V' ELSE NULL END AS `Gender_deelnemers`,
    COUNT(DISTINCT d.member_id) AS `Aantal_deelnemers`
FROM deelnemers d
where d.type_number > 0
GROUP BY `ID_Organisatie`, `Type_deelnemers`, `Geboortejaar_deelnemers`, `Gender_deelnemers`
ORDER BY `ID_Organisatie`, `Type_deelnemers`, `Geboortejaar_deelnemers`, `Gender_deelnemers`
