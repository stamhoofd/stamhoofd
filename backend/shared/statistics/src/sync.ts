import { Group, Member, MemberPlatformMembership, MemberResponsibilityRecord, Organization, Platform, Registration, RegistrationPeriod } from '@stamhoofd/models';
import { SQL, SQLWhereSign } from '@stamhoofd/sql';
import { getStatisticsConnection } from './connection.js';
import type { StatisticsRow } from './rows.js';
import { flattenDefaultAgeGroup, flattenGroup, flattenMember, flattenMembership, flattenNamedConfig, flattenOrganization, flattenRegistration, flattenRegistrationPeriod, flattenResponsibilityRecord } from './rows.js';
import { nextWatermark, readSyncState, writeSyncState } from './sync-state.js';
import { deleteRows, iterateIds, upsertRows } from './writer.js';

/**
 * How far before the watermark a run starts reading again. A row that was written while the previous
 * run was reading may carry an `updatedAt` below the watermark that run ended on, so re-reading a
 * window costs a few redundant upserts and closes that gap.
 */
export const watermarkOverlap = 5 * 60 * 1000;

/** Source rows read per query. */
export const fetchBatchSize = 500;

type IncrementalTable = {
    table: string;
    columns: string[];
    /**
     * Source rows updated at or after `since` with an id after `afterId`, ordered by id. Paging on
     * the id alone is what makes the cursor strictly advance; rows that move into the window while a
     * run is going are picked up by the next one through the overlap.
     */
    fetch: (since: Date | null, afterId: string, limit: number) => Promise<{ rows: StatisticsRow[]; updatedAt: Date[]; lastId: string }>;
    /** Which of these ids still exist in the source, used to reconcile deletes. */
    existingIds: (ids: string[]) => Promise<Set<string>>;
};

function idsOf(rows: { id: string }[]): string[] {
    return rows.map(row => row.id);
}

async function existingModelIds(model: { select: () => any }, ids: string[]): Promise<Set<string>> {
    const rows = await model.select().where(SQL.column('id'), ids).fetch();
    return new Set(idsOf(rows as { id: string }[]));
}

function incrementalQuery(model: { select: () => any }, since: Date | null, afterId: string, limit: number) {
    const query = model.select().where(SQL.column('id'), SQLWhereSign.Greater, afterId);
    if (since) {
        query.where(SQL.column('updatedAt'), SQLWhereSign.GreaterEqual, since);
    }
    return query.orderBy(SQL.column('id'), 'ASC').limit(limit);
}

/**
 * The dimension ids the statistics database currently knows. Rows referring to anything else are
 * dropped or nulled before writing: platform configuration can lose an age group or a membership
 * type while rows still point at it, and a foreign key error would otherwise stall the table for
 * good instead of skipping one row.
 */
async function loadIdSet(table: string): Promise<Set<string>> {
    const connection = getStatisticsConnection();
    const [rows] = await connection.select(`SELECT \`id\` FROM ${connection.escapeId(table)}`, [], { nestTables: false });
    return new Set((rows as unknown as { id: string }[]).map(row => row.id));
}

function buildIncrementalTables(known: { ageGroups: Set<string>; membershipTypes: Set<string>; responsibilities: Set<string> }): IncrementalTable[] {
    return [
        {
            table: 'registration_periods',
            columns: ['id', 'startDate', 'endDate', 'locked', 'organizationId', 'previousPeriodId', 'nextPeriodId', 'customName', 'createdAt', 'updatedAt'],
            fetch: async (since, afterId, limit) => {
                const periods = await incrementalQuery(RegistrationPeriod, since, afterId, limit).fetch() as RegistrationPeriod[];
                return { rows: periods.map(flattenRegistrationPeriod), updatedAt: periods.map(period => period.updatedAt), lastId: periods.at(-1)?.id ?? afterId };
            },
            existingIds: ids => existingModelIds(RegistrationPeriod, ids),
        },
        {
            table: 'organizations',
            columns: ['id', 'name', 'uri', 'city', 'periodId', 'active', 'createdAt', 'updatedAt'],
            fetch: async (since, afterId, limit) => {
                const organizations = await incrementalQuery(Organization, since, afterId, limit).fetch() as Organization[];
                await syncOrganizationTagsAndResponsibilities(organizations);
                return { rows: organizations.map(flattenOrganization), updatedAt: organizations.map(organization => organization.updatedAt), lastId: organizations.at(-1)?.id ?? afterId };
            },
            existingIds: ids => existingModelIds(Organization, ids),
        },
        {
            table: 'groups',
            columns: ['id', 'type', 'name', 'organizationId', 'periodId', 'defaultAgeGroupId', 'cycle', 'status', 'deletedAt', 'createdAt', 'updatedAt'],
            fetch: async (since, afterId, limit) => {
                const groups = await incrementalQuery(Group, since, afterId, limit).fetch() as Group[];
                const rows = groups.map((group) => {
                    const row = flattenGroup(group);
                    if (typeof row.defaultAgeGroupId === 'string' && !known.ageGroups.has(row.defaultAgeGroupId)) {
                        row.defaultAgeGroupId = null;
                    }
                    return row;
                });
                return { rows, updatedAt: groups.map(group => group.updatedAt), lastId: groups.at(-1)?.id ?? afterId };
            },
            existingIds: ids => existingModelIds(Group, ids),
        },
        {
            table: 'members',
            columns: ['id', 'birthYear', 'gender', 'organizationId', 'createdAt', 'updatedAt', 'lastRegisteredAt'],
            fetch: async (since, afterId, limit) => {
                const members = await incrementalQuery(Member, since, afterId, limit).fetch() as Member[];
                return { rows: members.map(flattenMember), updatedAt: members.map(member => member.updatedAt), lastId: members.at(-1)?.id ?? afterId };
            },
            existingIds: ids => existingModelIds(Member, ids),
        },
        {
            table: 'registrations',
            columns: ['id', 'organizationId', 'memberId', 'groupId', 'periodId', 'registeredAt', 'startDate', 'endDate', 'trialUntil', 'deactivatedAt', 'waitingList', 'cycle', 'createdAt', 'updatedAt'],
            fetch: async (since, afterId, limit) => {
                const registrations = await incrementalQuery(Registration, since, afterId, limit).fetch() as Registration[];
                return { rows: registrations.map(flattenRegistration), updatedAt: registrations.map(registration => registration.updatedAt), lastId: registrations.at(-1)?.id ?? afterId };
            },
            existingIds: ids => existingModelIds(Registration, ids),
        },
        {
            table: 'member_platform_memberships',
            columns: ['id', 'memberId', 'membershipTypeId', 'organizationId', 'periodId', 'startDate', 'endDate', 'expireDate', 'trialUntil', 'deletedAt', 'createdAt', 'updatedAt'],
            fetch: async (since, afterId, limit) => {
                const memberships = await incrementalQuery(MemberPlatformMembership, since, afterId, limit).fetch() as MemberPlatformMembership[];
                const kept = memberships.filter(membership => known.membershipTypes.has(membership.membershipTypeId));
                return { rows: kept.map(flattenMembership), updatedAt: kept.map(membership => membership.updatedAt), lastId: memberships.at(-1)?.id ?? afterId };
            },
            existingIds: ids => existingModelIds(MemberPlatformMembership, ids),
        },
    ];
}

/**
 * Copy the platform configuration that lives in json on the platform record into the dimension
 * tables. Small enough to write on every run, and it has to happen before the tables pointing at it.
 */
async function syncPlatformConfig(): Promise<void> {
    const platform = await Platform.getShared();
    const config = platform.config;

    await upsertRows('organization_tags', ['id', 'name'], config.tags.map(flattenNamedConfig));
    await upsertRows('default_age_groups', ['id', 'name', 'minAge', 'maxAge'], config.defaultAgeGroups.map(group => flattenDefaultAgeGroup({ id: group.id, name: group.name, minAge: group.minAge, maxAge: group.maxAge })));
    await upsertRows('platform_membership_types', ['id', 'name'], config.membershipTypes.map(flattenNamedConfig));
    await upsertRows('responsibilities', ['id', 'name'], config.responsibilities.map(flattenNamedConfig));
}

/**
 * The tags an organization carries and the responsibilities it defines itself. Both hang off the
 * organization record, so they are written along with the batch of organizations they belong to
 * rather than by scanning every organization again.
 */
async function syncOrganizationTagsAndResponsibilities(organizations: Organization[]): Promise<void> {
    if (organizations.length === 0) {
        return;
    }

    await upsertRows('responsibilities', ['id', 'name'], organizations.flatMap(organization => organization.privateMeta.responsibilities.map(flattenNamedConfig)));

    const knownTags = await loadIdSet('organization_tags');
    const connection = getStatisticsConnection();
    await connection.delete(`DELETE FROM ${connection.escapeId('_organizations_organization_tags')} WHERE \`organizationsId\` IN (?)`, [idsOf(organizations)]);

    const links = organizations.flatMap(organization => organization.meta.tags
        .filter(tagId => knownTags.has(tagId))
        .map(tagId => ({ organizationsId: organization.id, organizationTagsId: tagId })));
    await upsertRows('_organizations_organization_tags', ['organizationsId', 'organizationTagsId'], links);
}

/**
 * Responsibility records carry no `updatedAt`, so there is no watermark to advance: they are written
 * in full on every run. Records pointing at a responsibility that no longer exists are skipped.
 */
async function syncResponsibilityRecords(knownResponsibilities: Set<string>): Promise<void> {
    const columns = ['id', 'memberId', 'groupId', 'organizationId', 'responsibilityId', 'startDate', 'endDate'];
    let afterId = '';

    for (;;) {
        const records = await MemberResponsibilityRecord.select()
            .where(SQL.column('id'), SQLWhereSign.Greater, afterId)
            .orderBy(SQL.column('id'), 'ASC')
            .limit(fetchBatchSize)
            .fetch() as MemberResponsibilityRecord[];

        if (records.length === 0) {
            return;
        }

        await upsertRows('member_responsibility_records', columns, records
            .filter(record => knownResponsibilities.has(record.responsibilityId))
            .map(flattenResponsibilityRecord));
        afterId = records[records.length - 1].id;
    }
}

async function syncIncrementalTable(definition: IncrementalTable): Promise<void> {
    const startedAt = new Date();
    const state = await readSyncState(definition.table);
    const since = state.watermark ? new Date(state.watermark.getTime() - watermarkOverlap) : null;
    const seen: Date[] = [];
    let afterId = '';

    for (;;) {
        const { rows, updatedAt, lastId } = await definition.fetch(since, afterId, fetchBatchSize);
        if (lastId === afterId) {
            break;
        }

        await upsertRows(definition.table, definition.columns, rows);
        seen.push(...updatedAt);
        afterId = lastId;
    }

    await writeSyncState(definition.table, {
        watermark: nextWatermark(state.watermark, seen, startedAt),
        lastSucceededAt: new Date(),
    });
}

/**
 * Bring the statistics database up to date with everything that changed since the last run.
 *
 * Written so a crash is harmless: every write is an upsert, and a table that throws keeps its old
 * watermark, so the next run reads the same window again instead of skipping it.
 */
export async function syncStatistics(): Promise<void> {
    await syncPlatformConfig();

    const known = {
        ageGroups: await loadIdSet('default_age_groups'),
        membershipTypes: await loadIdSet('platform_membership_types'),
        responsibilities: await loadIdSet('responsibilities'),
    };

    // Parents before children: the foreign keys are what let Metabase suggest joins, so a row is
    // only written once the rows it points at are there.
    for (const definition of buildIncrementalTables(known)) {
        await syncIncrementalTable(definition);
    }

    await syncResponsibilityRecords(await loadIdSet('responsibilities'));
}

/**
 * Remove statistics rows whose source row is gone. Deletes leave nothing behind to notice in an
 * incremental pass, so they are reconciled separately by walking the statistics ids and asking the
 * source which of them still exist.
 */
export async function syncStatisticsDeletes(): Promise<void> {
    const known = { ageGroups: new Set<string>(), membershipTypes: new Set<string>(), responsibilities: new Set<string>() };

    // Children before parents: deleting a parent cascades, so the child pass has less to do and
    // never trips over a row its parent already took with it.
    for (const definition of buildIncrementalTables(known).reverse()) {
        for await (const ids of iterateIds(definition.table)) {
            const existing = await definition.existingIds(ids);
            await deleteRows(definition.table, ids.filter(id => !existing.has(id)));
        }
        await writeSyncState(definition.table, { lastReconciledAt: new Date() });
    }

    for await (const ids of iterateIds('member_responsibility_records')) {
        const existing = await existingModelIds(MemberResponsibilityRecord, ids);
        await deleteRows('member_responsibility_records', ids.filter(id => !existing.has(id)));
    }
    await writeSyncState('member_responsibility_records', { lastReconciledAt: new Date() });
}
