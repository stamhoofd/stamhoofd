-- Wie in welk scoutsjaar lid was, over het hele platform en zonder filters op wie meetelt.
--
-- Dit is de "is nog lid"-kant van het ledenbehoud. Een lid dat het jaar erna bij een andere eenheid
-- opduikt telt als blijver: zo rekent het rapport van de klant het ook. De cijfers van 9e Wandelaar
-- tonen het verschil — 38, 54 en 46 blijvers met deze telling, 37, 51 en 45 als alleen dezelfde
-- eenheid meetelt.
--
-- Bewust niet uit `facts` gehaald: die is gefilterd op de gekozen eenheid, en dan zou een lid dat
-- verhuist juist wel als vertrekker tellen.
--
-- Op één filter na. Waar iemand lid is doet er niet toe, wat voor inschrijving het is wel: als de
-- teller enkel leeftijdsgroepen telt en de noemer elke inschrijving, dan is wie vertrokken is maar
-- het jaar erna één activiteit meedoet een blijver. `ingeschreven-voor.sql` staat daarom aan beide
-- kanten van de breuk, zodat "is nog lid" hetzelfde betekent als "was lid".
, leden_per_jaar AS (
    SELECT DISTINCT
        r.memberId AS member_id,
        p.name AS `Scoutsjaar`
    FROM registrations r
    JOIN registration_periods p ON p.id = r.periodId
    JOIN `groups` g ON g.id = r.groupId AND g.deletedAt IS NULL
    WHERE r.deactivatedAt IS NULL
      AND r.registeredAt IS NOT NULL
      -- Wie het jaar erna alleen nog bij de koepel zelf ingeschreven staat is geen blijver: dat is
      -- dezelfde organisatie die `facts` weglaat, en een cijfer dat hier wel meetelt en daar niet zou
      -- een ledenbehoud boven de leden zetten waar het over gaat.
      AND NOT EXISTS (SELECT 1 FROM platform pf WHERE pf.membershipOrganizationId = r.organizationId)
      -- @include ingeschreven-voor
)
