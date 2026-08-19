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
-- description: Tabblad 'Deelnemers_Bovenlokaal': de structuurvrijwilligers van de koepel, per geboortejaar en geslacht. Unieke personen, geen inschrijvingen: zo vraagt de metadatafiche het voor de nationale ploegen.
--
-- The deelnemers of the structure the sheet above delivers: everyone registered at the koepel's own
-- organization in that werkjaar. Being registered there is the engagement that makes someone a
-- structuurvrijwilliger -- nothing in the administration says what a person does within a ploeg -- so
-- a registration is what this counts.
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
-- Read from `all_facts` rather than from `facts`: the ledenstatistieken leave this organization out,
-- and this sheet is the one thing that is about it.
-- @include facts
SELECT
    f.organization_id AS `ID_Organisatie`,
    YEAR(f.birth_date) AS `Geboortejaar_deelnemers`,
    CASE f.`Geslacht` WHEN 'Man' THEN 'M' WHEN 'Vrouw' THEN 'V' ELSE NULL END AS `Gender_deelnemers`,
    COUNT(DISTINCT f.member_id) AS `Aantal_deelnemers`
FROM all_facts f
JOIN platform pf ON pf.membershipOrganizationId = f.organization_id
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
-- description: Tabblad 'Deelnemers_Lokale_groep': de leden en de leiding van elke lokale groep, per geboortejaar en geslacht. Wie in dezelfde groep zowel lid als leiding is, telt enkel als leiding.
--
-- The deelnemers of the groups the sheet above delivers, split into the two words the template
-- allows: 'leden' and 'leiding', that exact spelling. Kinderen are the leden; leiding is everyone
-- else registered at the group, which is what the metadatafiche asks for -- it counts the volwassen
-- begeleiders, kassabeheerders and secretarissen of a group as leiding as well, and a registration
-- the import could not place at all belongs to an adult, since anyone under 18 is read as a kind.
--
-- Classified per member per group before anything is counted, because someone can be a lid in one tak
-- and leiding in another of the same unit. The metadatafiche is explicit that they are leiding there
-- and not a lid, so leiding wins; counted straight off the registrations they would be one person
-- delivered in both rows.
--
-- One row per member per group is also what the counting asks for. The metadatafiche counts
-- inschrijvingen rather than unique inschrijvers, and says what it means by that: someone registered
-- at two groups counts at both. Within one group they are one deelnemer, however many takken they are
-- registered in.
-- @include facts
, deelnemers AS (
    SELECT
        f.organization_id,
        f.member_id,
        f.birth_date,
        f.`Geslacht`,
        MAX(CASE WHEN f.categorie = 'child' THEN 0 ELSE 1 END) AS is_leiding
    FROM facts f
    GROUP BY f.organization_id, f.member_id, f.birth_date, f.`Geslacht`
)
SELECT
    d.organization_id AS `ID_Organisatie`,
    CASE WHEN d.is_leiding = 1 THEN 'leiding' ELSE 'leden' END AS `Type_deelnemers`,
    YEAR(d.birth_date) AS `Geboortejaar_deelnemers`,
    CASE d.`Geslacht` WHEN 'Man' THEN 'M' WHEN 'Vrouw' THEN 'V' ELSE NULL END AS `Gender_deelnemers`,
    COUNT(*) AS `Aantal_deelnemers`
FROM deelnemers d
GROUP BY `ID_Organisatie`, `Type_deelnemers`, `Geboortejaar_deelnemers`, `Gender_deelnemers`
ORDER BY `ID_Organisatie`, `Type_deelnemers`, `Geboortejaar_deelnemers`, `Gender_deelnemers`
