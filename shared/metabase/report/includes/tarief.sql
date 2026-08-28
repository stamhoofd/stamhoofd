-- Het tarief waaraan een lidgeld is aangerekend: het standaardtarief, of het verlaagde tarief van de
-- koepel. Dat is wat de rapporten "type lidgeld" noemen -- de aansluiting zegt waarvoor iemand is
-- aangesloten, dit zegt wat ervoor betaald werd.
--
-- De naam van het verlaagde tarief is die van de koepel zelf (SOMkort, kansentarief). Ze staat op de
-- platformrij, want alleen het platform zelf weet hoe het dat tarief noemt. Er is één zo'n rij, dus
-- de subquery levert één naam; een platform dat er geen naam aan geeft valt terug op de bewoording
-- hier, en een databank waarin nog niets gesynchroniseerd is ook.
--
-- Hoort bij een query die de lidgelden als `mpm` heeft.
CASE WHEN mpm.reducedPrice = 1
    THEN COALESCE((SELECT pf.reducedPriceName FROM platform pf WHERE pf.reducedPriceName IS NOT NULL LIMIT 1), 'Verlaagd tarief')
    ELSE 'Standaardtarief'
END
