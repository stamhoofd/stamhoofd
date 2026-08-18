-- @tab jeugdbewegingen
-- title: Jeugdbewegingen
-- dashboard: groepen en deelnemers - departement jeugd
-- description: De jaarlijkse aanlevering 'Groepen en Deelnemers Jeugdbewegingen' aan het Departement Cultuur, Jeugd en Media. Eén kaart per tabblad van het sjabloon: download ze via het pijltje rechtsonder op de kaart als .xlsx en plak ze in het aanleversjabloon.
-- filters: scoutsjaar
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
-- @include facts
SELECT
    f.organization_id AS `ID_Organisatie`,
    YEAR(f.birth_date) AS `Geboortejaar_deelnemers`,
    CASE f.`Geslacht` WHEN 'Man' THEN 'M' WHEN 'Vrouw' THEN 'V' WHEN 'Andere' THEN 'X' END AS `Gender_deelnemers`,
    COUNT(DISTINCT f.member_id) AS `Aantal_deelnemers`
FROM facts f
JOIN platform pf ON pf.membershipOrganizationId = f.organization_id
GROUP BY `ID_Organisatie`, `Geboortejaar_deelnemers`, `Gender_deelnemers`
ORDER BY `Geboortejaar_deelnemers`, `Gender_deelnemers`
