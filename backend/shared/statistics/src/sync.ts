import { Group, Member, MemberPlatformMembership, MemberResponsibilityRecord, Organization, Platform, Registration, RegistrationPeriod } from '@stamhoofd/models';
import { SQL, SQLWhereSign } from '@stamhoofd/sql';
import { getStatisticsConnection } from './connection.js';
import type { StatisticsRow } from './rows.js';
import { flattenDefaultAgeGroup, flattenGroup, flattenMember, flattenMembership, flattenNamedConfig, flattenOrganization, flattenRegistration, flattenRegistrationPeriod, flattenResponsibilityRecord } from './rows.js';
import { nextWatermark, readSyncState, writeSyncState } from './sync-state.js';
import { applyImportedCutoff, getImportedUntil, isFrozen, loadFrozenPeriodIds } from './periods.js';
import { syncSource } from './sources.js';
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
    /**
     * The column holding the period a row belongs to. Rows of a frozen period are neither rewritten
     * nor excluded, which is what keeps a settled year settled. Absent for tables that are not tied
     * to a period at all, such as members.
     */
    periodColumn?: string;
    /**
     * Rows that stay even when their source row is gone. Members and organizations are what the facts
     * of a settled year join to for their demographics, and deleting one cascades to its
     * registrations — the ones in frozen years included. Keeping a de-identified row of a birth year
     * and a gender costs nothing next to losing those numbers.
     */
    neverDelete?: boolean;
};

/**
 * Marks which pipeline wrote a row, so the reconciliation only ever checks its own against the main
 * database and leaves imported rows alone.
 */
export const sourceColumns = ['source'];

function withSource(rows: StatisticsRow[]): StatisticsRow[] {
    return rows.map(row => ({ ...row, source: syncSource }));
}

function idsOf(rows: { id: string }[]): string[] {
    return rows.map(row => row.id);
}

function groupByPeriod(organizations: Organization[]): Map<string, Organization[]> {
    const grouped = new Map<string, Organization[]>();

    for (const organization of organizations) {
        const group = grouped.get(organization.periodId);
        if (group) {
            group.push(organization);
        }
        else {
            grouped.set(organization.periodId, [organization]);
        }
    }

    return grouped;
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

function buildIncrementalTables(known: { ageGroups: Set<string>; membershipTypes: Set<string>; responsibilities: Set<string> }, frozen: Set<string>): IncrementalTable[] {
    return [
        {
            table: 'registration_periods',
            columns: ['id', 'startDate', 'endDate', 'locked', 'organizationId', 'previousPeriodId', 'nextPeriodId', 'customName', 'createdAt', 'updatedAt'],
            fetch: async (since, afterId, limit) => {
                const periods = await incrementalQuery(RegistrationPeriod, since, afterId, limit).fetch() as RegistrationPeriod[];
                return { rows: periods.map(flattenRegistrationPeriod), updatedAt: periods.map(period => period.updatedAt), lastId: periods.at(-1)?.id ?? afterId };
            },
            existingIds: ids => existingModelIds(RegistrationPeriod, ids),
            periodColumn: 'id',
        },
        {
            table: 'organizations',
            columns: ['id', 'name', 'uri', 'postalCode', 'city', 'periodId', 'active', 'createdAt', 'updatedAt'],
            fetch: async (since, afterId, limit) => {
                const organizations = await incrementalQuery(Organization, since, afterId, limit).fetch() as Organization[];
                await syncOrganizationTagsAndResponsibilities(organizations, frozen);
                return { rows: organizations.map(flattenOrganization), updatedAt: organizations.map(organization => organization.updatedAt), lastId: organizations.at(-1)?.id ?? afterId };
            },
            existingIds: ids => existingModelIds(Organization, ids),
            neverDelete: true,
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
            periodColumn: 'periodId',
        },
        {
            table: 'members',
            columns: ['id', 'birthDate', 'gender', 'postalCode', 'organizationId', 'createdAt', 'updatedAt', 'lastRegisteredAt'],
            fetch: async (since, afterId, limit) => {
                const members = await incrementalQuery(Member, since, afterId, limit).fetch() as Member[];
                return { rows: members.map(flattenMember), updatedAt: members.map(member => member.updatedAt), lastId: members.at(-1)?.id ?? afterId };
            },
            existingIds: ids => existingModelIds(Member, ids),
            neverDelete: true,
        },
        {
            table: 'registrations',
            columns: ['id', 'organizationId', 'memberId', 'groupId', 'periodId', 'registeredAt', 'startDate', 'endDate', 'trialUntil', 'deactivatedAt', 'waitingList', 'cycle', 'createdAt', 'updatedAt'],
            fetch: async (since, afterId, limit) => {
                const registrations = await incrementalQuery(Registration, since, afterId, limit).fetch() as Registration[];
                return { rows: registrations.map(flattenRegistration), updatedAt: registrations.map(registration => registration.updatedAt), lastId: registrations.at(-1)?.id ?? afterId };
            },
            existingIds: ids => existingModelIds(Registration, ids),
            periodColumn: 'periodId',
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
            periodColumn: 'periodId',
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
async function syncOrganizationTagsAndResponsibilities(organizations: Organization[], frozen: Set<string>): Promise<void> {
    if (organizations.length === 0) {
        return;
    }

    await upsertRows('responsibilities', ['id', 'name'], organizations.flatMap(organization => organization.privateMeta.responsibilities.map(flattenNamedConfig)));

    // The source only knows the tags an organization carries now, so they are recorded against the
    // period it is in. A frozen period keeps the netwerk it was recorded with while it was live.
    const knownPeriods = await loadIdSet('registration_periods');
    const live = organizations.filter(organization => knownPeriods.has(organization.periodId) && !isFrozen(frozen, organization.periodId));
    if (live.length === 0) {
        return;
    }

    const knownTags = await loadIdSet('organization_tags');
    const connection = getStatisticsConnection();

    // Replace the links of these organizations for the period they are in, leaving every other
    // period exactly as it was recorded.
    for (const [periodId, group] of groupByPeriod(live)) {
        await connection.delete(
            `DELETE FROM ${connection.escapeId('_organizations_organization_tags')} WHERE \`organizationsId\` IN (?) AND \`periodId\` = ?`,
            [idsOf(group), periodId],
        );
    }

    const links = live.flatMap(organization => organization.meta.tags
        .filter(tagId => knownTags.has(tagId))
        .map(tagId => ({ organizationsId: organization.id, organizationTagsId: tagId, periodId: organization.periodId })));
    await upsertRows('_organizations_organization_tags', ['organizationsId', 'organizationTagsId', 'periodId', ...sourceColumns], withSource(links));
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

        await upsertRows('member_responsibility_records', [...columns, ...sourceColumns], withSource(records
            .filter(record => knownResponsibilities.has(record.responsibilityId))
            .map(flattenResponsibilityRecord)));
        afterId = records[records.length - 1].id;
    }
}

/**
 * Of these statistics rows, the ones that do not belong to a frozen period. A deleted source row in a
 * settled year stays exactly as it was counted.
 */
async function withoutFrozen(table: string, ids: string[], frozen: Set<string>, periodColumn: string): Promise<string[]> {
    if (ids.length === 0 || frozen.size === 0) {
        return ids;
    }

    const connection = getStatisticsConnection();
    const column = connection.escapeId(periodColumn);
    const [rows] = await connection.select(
        `SELECT \`id\` FROM ${connection.escapeId(table)} WHERE \`id\` IN (?) AND (${column} IS NULL OR ${column} NOT IN (?))`,
        [ids, [...frozen]],
        { nestTables: false },
    );
    return (rows as unknown as { id: string }[]).map(row => row.id);
}

async function syncIncrementalTable(definition: IncrementalTable, frozen: Set<string>): Promise<void> {
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

        const live = definition.periodColumn
            ? rows.filter(row => !isFrozen(frozen, row[definition.periodColumn!] as string | null))
            : rows;
        await upsertRows(definition.table, [...definition.columns, ...sourceColumns], withSource(live));
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
    await applyImportedCutoff(getImportedUntil());
    const frozen = await loadFrozenPeriodIds();

    const known = {
        ageGroups: await loadIdSet('default_age_groups'),
        membershipTypes: await loadIdSet('platform_membership_types'),
        responsibilities: await loadIdSet('responsibilities'),
    };

    // Parents before children: the foreign keys are what let Metabase suggest joins, so a row is
    // only written once the rows it points at are there.
    for (const definition of buildIncrementalTables(known, frozen)) {
        await syncIncrementalTable(definition, frozen);
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
    const frozen = await loadFrozenPeriodIds();

    for (const definition of buildIncrementalTables(known, frozen)) {
        if (definition.neverDelete) {
            continue;
        }

        for await (const ids of iterateIds(definition.table, syncSource)) {
            const existing = await definition.existingIds(ids);
            const missing = ids.filter(id => !existing.has(id));
            await deleteRows(definition.table, definition.periodColumn ? await withoutFrozen(definition.table, missing, frozen, definition.periodColumn) : missing);
        }
        await writeSyncState(definition.table, { lastReconciledAt: new Date() });
    }

    for await (const ids of iterateIds('member_responsibility_records', syncSource)) {
        const existing = await existingModelIds(MemberResponsibilityRecord, ids);
        await deleteRows('member_responsibility_records', ids.filter(id => !existing.has(id)));
    }
    await writeSyncState('member_responsibility_records', { lastReconciledAt: new Date() });
}
