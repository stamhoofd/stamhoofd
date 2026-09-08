-- description: Wat een rij van Deelnemers_Lokale_groep telt: het aantal deelnemers, en hoeveel van hen een inschrijving bij de stam of bij de ondersteunende leden hebben. Die twee tellen mee in het aantal en staan er enkel apart bij omdat de koepel ze zelf wil zien; het aanleversjabloon heeft geen kolom voor hen.
COUNT(DISTINCT deelnemers.member_id) AS `Aantal_deelnemers`,
COUNT(DISTINCT CASE WHEN FIND_IN_SET('stam', deelnemers.subgroups) > 0 THEN deelnemers.member_id END) AS `Waarvan Stam`,
COUNT(DISTINCT CASE WHEN FIND_IN_SET('ondersteunende leden', deelnemers.subgroups) > 0 THEN deelnemers.member_id END) AS `Waarvan Ondersteunende leden`
