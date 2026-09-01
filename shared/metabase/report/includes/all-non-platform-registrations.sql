-- description: Eén rij per inschrijving voor het gekozen werkjaar; de eigen organisatie van de koepel telt enkel mee wanneer de dashboardfilter dat vraagt.
WITH all_registrations AS (
    -- @include all-registrations
)
-- The koepel is the national body rather than an eenheid, and the ledenstatistieken normally count
-- none of its structuurvrijwilligers. `platform.membershipOrganizationId` is the only thing that says
-- which organization it is; the import writes the koepel under that same id.
SELECT all_registrations.* FROM all_registrations
WHERE {{platformleden_opnemen}}
   OR NOT EXISTS (SELECT 1 FROM platform WHERE platform.membershipOrganizationId = all_registrations.organization_id)
