-- description: De kenmerken waarmee het aanleversjabloon een deelnemer beschrijft: geboortejaar en geslacht, dat laatste in de letters die de metadatafiche toelaat. Eén rij van een deelnemerstabblad staat voor één combinatie ervan, dus `participant-detail-columns` noemt dezelfde kolommen.
YEAR(`birth_date`) AS `Geboortejaar_deelnemers`,
CASE `Geslacht` WHEN 'Man' THEN 'M' WHEN 'Vrouw' THEN 'V' ELSE NULL END AS `Gender_deelnemers`,
