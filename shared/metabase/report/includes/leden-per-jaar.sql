-- Wie in welk scoutsjaar lid was, over het hele platform en zonder filters.
--
-- Dit is de "is nog lid"-kant van het ledenbehoud. Een lid dat het jaar erna bij een andere eenheid
-- opduikt telt als blijver: zo rekent het rapport van de klant het ook. De cijfers van 9e Wandelaar
-- tonen het verschil — 38, 54 en 46 blijvers met deze telling, 37, 51 en 45 als alleen dezelfde
-- eenheid meetelt.
--
-- Bewust niet uit `facts` gehaald: die is gefilterd op de gekozen eenheid, en dan zou een lid dat
-- verhuist juist wel als vertrekker tellen.
, leden_per_jaar AS (
    SELECT DISTINCT
        r.memberId AS member_id,
        p.name AS `Scoutsjaar`
    FROM registrations r
    JOIN registration_periods p ON p.id = r.periodId
    JOIN `groups` g ON g.id = r.groupId AND g.deletedAt IS NULL
    WHERE r.deactivatedAt IS NULL
      AND r.registeredAt IS NOT NULL
)
