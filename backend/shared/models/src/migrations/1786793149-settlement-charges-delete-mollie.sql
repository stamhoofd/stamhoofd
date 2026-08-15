-- Aggregated Mollie period costs: the sync stores one fee charge per settled transaction instead,
-- and a manual re-sync rebuilds them
DELETE `settlement_charges` FROM `settlement_charges`
JOIN `settlements` ON `settlements`.`id` = `settlement_charges`.`settlementId`
WHERE `settlements`.`provider` = 'Mollie';
