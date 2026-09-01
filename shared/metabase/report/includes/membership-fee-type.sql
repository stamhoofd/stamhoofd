-- description: Het tarief waaraan een lidgeld (member_platform_memberships) werd aangerekend: het standaardtarief of het verlaagde tarief, onder de naam die het platform eraan geeft.
CASE WHEN member_platform_memberships.reducedPrice = 1
    THEN COALESCE((SELECT platform.reducedPriceName FROM platform WHERE platform.reducedPriceName IS NOT NULL LIMIT 1), 'Verlaagd tarief')
    ELSE 'Standaardtarief'
END
