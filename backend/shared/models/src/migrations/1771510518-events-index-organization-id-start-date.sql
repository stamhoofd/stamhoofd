ALTER TABLE events
ADD INDEX idx_org_startdate (organizationId, startDate);
