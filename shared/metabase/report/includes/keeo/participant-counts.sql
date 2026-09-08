-- description: Wat een rij van Deelnemers_Lokale_groep telt: het aantal deelnemers, en hoeveel van hen als stam of als ondersteunend lid geleverd worden. Die twee tellen mee in het aantal en staan er enkel apart bij omdat de koepel ze zelf wil zien; het aanleversjabloon heeft geen kolom voor hen. De stam wordt enkel bij de leden geleverd en de ondersteunende leden enkel bij de leiding, dus in de andere rij blijft de kolom leeg.
COUNT(DISTINCT deelnemers.member_id) AS `Aantal_deelnemers`,
-- Leeg en niet nul in de rij waarin de leeftijdsgroep nooit geleverd wordt: een nul leest als
-- "geen van deze leiding is stam" in plaats van als "leiding is hier nooit stam".
CASE WHEN MAX(deelnemers.type_number) = 1
    THEN COUNT(DISTINCT CASE WHEN deelnemers.subgroup_number = 1 THEN deelnemers.member_id END)
END AS `Waarvan Stam`,
CASE WHEN MAX(deelnemers.type_number) = 2
    THEN COUNT(DISTINCT CASE WHEN deelnemers.subgroup_number = 2 THEN deelnemers.member_id END)
END AS `Waarvan Ondersteunende leden`
