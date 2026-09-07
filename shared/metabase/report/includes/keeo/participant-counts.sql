-- description: Wat een rij van Deelnemers_Lokale_groep telt: het aantal deelnemers, en hoeveel van hen stam of ondersteunend lid zijn. Die twee tellen mee in het aantal en staan er enkel apart bij omdat de koepel ze zelf wil zien; het aanleversjabloon heeft geen kolom voor hen.
COUNT(DISTINCT deelnemers.member_id) AS `Aantal_deelnemers`,
COUNT(DISTINCT CASE WHEN deelnemers.type_number = 1 AND deelnemers.subgroup = 'stam' THEN deelnemers.member_id END) AS `Waarvan Stam`,
COUNT(DISTINCT CASE WHEN deelnemers.type_number = 2 AND deelnemers.subgroup = 'ondersteunende leden' THEN deelnemers.member_id END) AS `Waarvan Ondersteunende leden`
