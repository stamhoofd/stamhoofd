-- Where a postal code is, so Metabase can put a point on the map for it.
--
-- The maps attach this with a LEFT JOIN, because what members have in their postal code field is not
-- always a Belgian postal code: typos, a Dutch one, or a whole address typed into the box. Those
-- members keep counting towards the totals, they just get no pin. An INNER JOIN would drop them.
, postcode_coordinaten AS (
    SELECT postalCode, latitude, longitude FROM postal_codes
)
