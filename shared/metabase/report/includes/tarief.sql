CASE WHEN mpm.reducedPrice = 1
    THEN COALESCE((SELECT pf.reducedPriceName FROM platform pf WHERE pf.reducedPriceName IS NOT NULL LIMIT 1), 'Verlaagd tarief')
    ELSE 'Standaardtarief'
END
