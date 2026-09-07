-- description: Wat een rij van Deelnemers_Lokale_groep telt. Een koepel die een deel van haar deelnemers ook apart wil zien, zet die in kolommen naast het aantal.
COUNT(DISTINCT deelnemers.member_id) AS `Aantal_deelnemers`
