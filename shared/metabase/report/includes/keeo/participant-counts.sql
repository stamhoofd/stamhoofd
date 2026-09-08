-- description: Wat een rij van Deelnemers_Lokale_groep telt: het aantal deelnemers, en hoeveel van hen als stam of als ondersteunend lid geleverd worden. Die twee tellen mee in het aantal en staan er enkel apart bij omdat de koepel ze zelf wil zien; het aanleversjabloon heeft geen kolom voor hen.
COUNT(DISTINCT deelnemers.member_id) AS `Aantal_deelnemers`,
COUNT(DISTINCT CASE WHEN deelnemers.subgroup_number = 1 THEN deelnemers.member_id END) AS `Waarvan Stam`,
COUNT(DISTINCT CASE WHEN deelnemers.subgroup_number = 2 THEN deelnemers.member_id END) AS `Waarvan Ondersteunende leden`
