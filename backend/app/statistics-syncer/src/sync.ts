import type { SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { Group, Member, MemberPlatformMembership, MemberResponsibilityRecord, Organization, Platform, Registration, RegistrationPeriod } from '@stamhoofd/models';
import { SQL, SQLSelect, SQLWhereSign } from '@stamhoofd/sql';
import { getStatisticsConnection } from './database.js';
import { applyImportedCutoff, getImportedUntil, isFrozen, loadFrozenPeriodIds } from './periods.js';
import type { StatisticsRow } from './rows.js';
import { flattenDefaultAgeGroup, flattenGroup, flattenMember, flattenMembership, flattenNamedConfig, flattenOrganization, flattenPlatform, flattenRegistration, flattenRegistrationPeriod, flattenResponsibilityRecord } from './rows.js';
import { syncSource } from './sources.js';
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
    /**
     * The column holding the period a row belongs to. Rows of a frozen period are neither rewritten
     * nor excluded, which is what keeps a settled year settled. Absent for tables that are not tied
     * to a period at all.
     */
    periodColumn?: string;
    /**
     * What identifies a row, when it takes more than an id. A table keyed on more than its id can
     * hold several rows per id, which the delete reconciliation has no way to tell apart -- so it
     * has to be `neverDelete` as well.
     */
    keyColumns?: string[];
    /**
     * Rows that stay even when their source row is gone. Members and organizations are what the facts
     * of a settled year join to for their demographics, and without one every registration it carried
     * drops out of that year — an organization takes its registrations with it outright, through the
     * cascade. Keeping a de-identified row of a birth year and a gender costs nothing next to losing
     * those numbers.
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
        } else {
            grouped.set(organization.periodId, [organization]);
        }
    }

    return grouped;
}

async function existingModelIds(model: { select: () => any }, ids: string[]): Promise<Set<string>> {
    const rows = await model.select().where(SQL.column('id'), ids).fetch();
    return new Set(idsOf(rows as { id: string }[]));
}

/**
 * The periods each of these members or units holds a registration in.
 *
 * Both are recorded per year, and the source has no such row: a member is simply a member there and
 * a unit simply a unit, and it is the registrations that place them in a year.
 *
 * Limited to the periods the statistics database already holds. A registration can point at a period
 * that has not been synced yet, and a row for it would be refused by the foreign key, which would
 * stall the whole table over one row.
 */
async function periodIdsByRegistration(column: 'memberId' | 'organizationId', ids: string[]): Promise<Map<string, Set<string>>> {
    const byId = new Map<string, Set<string>>();
    if (ids.length === 0) {
        return byId;
    }

    const rows = await new SQLSelect(
        (row: SQLResultNamespacedRow) => ({
            key: row[Registration.table][column] as string,
            periodId: row[Registration.table].periodId as string | null,
        }),
        SQL.column(column),
        SQL.column('periodId'),
    )
        .from(Registration.table)
        .where(SQL.column(column), ids)
        .fetch();

    const known = await existingPeriodIds(rows.map(row => row.periodId).filter((id): id is string => id !== null));

    for (const row of rows) {
        if (row.periodId !== null && known.has(row.periodId)) {
            addTo(byId, row.key, row.periodId);
        }
    }

    return byId;
}

function periodIdsByMember(memberIds: string[]): Promise<Map<string, Set<string>>> {
    return periodIdsByRegistration('memberId', memberIds);
}

/**
 * Which of these members are charged the platform's verlaagd lidgeld: those with financiële
 * ondersteuning or an active UITPAS.
 *
 * That status is the input the price of a lidgeld is calculated from, and the only record of which
 * tarief was charged -- the membership itself keeps the amount and not what it was made of. Read off
 * the member here so a lidgeld row can carry it, which is the grain the reports split on.
 *
 * It answers what is true of the member now, like their gender and postal code, and lands in the
 * years still open only: a settled year keeps the tarief it was counted with.
 */
async function reducedPriceByMember(memberIds: string[]): Promise<Set<string>> {
    const unique = [...new Set(memberIds)];
    if (unique.length === 0) {
        return new Set();
    }

    const members = await Member.select().where(SQL.column('id'), unique).fetch() as Member[];
    return new Set(members.filter(member => member.details.shouldApplyReducedPrice).map(member => member.id));
}

/**
 * A unit also gets a row for the period it is in now, before anyone has registered in it: its netwerk
 * is recorded against that period, and a netwerk link to a unit that has no row yet is a link to
 * nothing.
 */
async function periodIdsByOrganization(organizations: Organization[]): Promise<Map<string, Set<string>>> {
    const byOrganization = await periodIdsByRegistration('organizationId', idsOf(organizations));
    const known = await existingPeriodIds(organizations.map(organization => organization.periodId));

    for (const organization of organizations) {
        if (known.has(organization.periodId)) {
            addTo(byOrganization, organization.id, organization.periodId);
        }
    }

    return byOrganization;
}

function addTo(map: Map<string, Set<string>>, key: string, value: string): void {
    const values = map.get(key);
    if (values) {
        values.add(value);
    } else {
        map.set(key, new Set([value]));
    }
}

async function existingPeriodIds(ids: string[]): Promise<Set<string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
        return new Set();
    }

    const connection = getStatisticsConnection();
    const [rows] = await connection.select('SELECT `id` FROM `registration_periods` WHERE `id` IN (?)', [unique], { nestTables: false });
    return new Set((rows as unknown as { id: string }[]).map(row => row.id));
}

function incrementalQuery(model: { select: () => any }, since: Date | null, afterId: string, limit: number) {
    const query = model.select().where(SQL.column('id'), SQLWhereSign.Greater, afterId);
    if (since) {
        query.where(SQL.column('updatedAt'), SQLWhereSign.GreaterEqual, since);
    }
    return query.orderBy(SQL.column('id'), 'ASC').limit(limit);
}

/**
 * The dimension ids the statistics database currently knows, across every period it holds them for.
 * Rows referring to anything else are dropped or nulled before writing: platform configuration can
 * lose an age group or a membership type while rows still point at it, and the reports would
 * otherwise group by a name that is no longer there.
 */
async function loadIdSet(table: string): Promise<Set<string>> {
    const connection = getStatisticsConnection();
    const [rows] = await connection.select(`SELECT DISTINCT \`id\` FROM ${connection.escapeId(table)}`, [], { nestTables: false });
    return new Set((rows as unknown as { id: string }[]).map(row => row.id));
}

/**
 * The periods, which every other table here is keyed by and therefore has to be synced before any of
 * them: which periods exist, and which of them are still open, decides what the rest of a run writes
 * at all.
 */
function periodsTable(): IncrementalTable {
    return {
        table: 'registration_periods',
        columns: ['id', 'startDate', 'endDate', 'locked', 'organizationId', 'previousPeriodId', 'nextPeriodId', 'customName', 'name', 'createdAt', 'updatedAt'],
        fetch: async (since, afterId, limit) => {
            const periods = await incrementalQuery(RegistrationPeriod, since, afterId, limit).fetch() as RegistrationPeriod[];
            return { rows: periods.map(flattenRegistrationPeriod), updatedAt: periods.map(period => period.updatedAt), lastId: periods.at(-1)?.id ?? afterId };
        },
        existingIds: ids => existingModelIds(RegistrationPeriod, ids),
        periodColumn: 'id',
        // A period is what every historical figure hangs off, and everything else points at it with
        // ON DELETE RESTRICT. Removing one would either be refused by the database or take a settled
        // year's numbers with it, so a period that disappears from the administration stays here,
        // like its members and organizations.
        neverDelete: true,
    };
}

function buildIncrementalTables(known: { ageGroups: Set<string>; membershipTypes: Set<string>; responsibilities: Set<string> }, frozen: Set<string>, openPeriodIds: string[]): IncrementalTable[] {
    return [
        {
            table: 'organizations',
            columns: ['id', 'periodId', 'name', 'uri', 'postalCode', 'city', 'active', 'createdAt', 'updatedAt'],
            fetch: async (since, afterId, limit) => {
                const organizations = await incrementalQuery(Organization, since, afterId, limit).fetch() as Organization[];
                await syncOrganizationTagsAndResponsibilities(organizations, frozen, openPeriodIds);
                const periodIds = await periodIdsByOrganization(organizations);
                const rows = organizations.flatMap(organization => [...periodIds.get(organization.id) ?? []].map(periodId => flattenOrganization(organization, periodId)));
                return { rows, updatedAt: organizations.map(organization => organization.updatedAt), lastId: organizations.at(-1)?.id ?? afterId };
            },
            existingIds: ids => existingModelIds(Organization, ids),
            periodColumn: 'periodId',
            keyColumns: ['id', 'periodId'],
            neverDelete: true,
        },
        {
            table: 'groups',
            columns: ['id', 'type', 'name', 'organizationId', 'periodId', 'defaultAgeGroupId', 'status', 'deletedAt', 'createdAt', 'updatedAt'],
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
            columns: ['id', 'periodId', 'birthDate', 'gender', 'postalCode', 'organizationId', 'createdAt', 'updatedAt', 'lastRegisteredAt'],
            fetch: async (since, afterId, limit) => {
                const members = await incrementalQuery(Member, since, afterId, limit).fetch() as Member[];
                const periodIds = await periodIdsByMember(members.map(member => member.id));
                const rows = members.flatMap(member => [...periodIds.get(member.id) ?? []].map(periodId => flattenMember(member, periodId)));
                return { rows, updatedAt: members.map(member => member.updatedAt), lastId: members.at(-1)?.id ?? afterId };
            },
            existingIds: ids => existingModelIds(Member, ids),
            periodColumn: 'periodId',
            keyColumns: ['id', 'periodId'],
            neverDelete: true,
        },
        {
            table: 'registrations',
            columns: ['id', 'organizationId', 'memberId', 'groupId', 'periodId', 'registeredAt', 'startDate', 'endDate', 'trialUntil', 'deactivatedAt', 'createdAt', 'updatedAt'],
            fetch: async (since, afterId, limit) => {
                const registrations = await incrementalQuery(Registration, since, afterId, limit).fetch() as Registration[];
                return { rows: registrations.map(flattenRegistration), updatedAt: registrations.map(registration => registration.updatedAt), lastId: registrations.at(-1)?.id ?? afterId };
            },
            existingIds: ids => existingModelIds(Registration, ids),
            periodColumn: 'periodId',
        },
        {
            table: 'member_platform_memberships',
            columns: ['id', 'memberId', 'membershipTypeId', 'reducedPrice', 'organizationId', 'periodId', 'startDate', 'endDate', 'expireDate', 'trialUntil', 'deletedAt', 'createdAt', 'updatedAt'],
            fetch: async (since, afterId, limit) => {
                const memberships = await incrementalQuery(MemberPlatformMembership, since, afterId, limit).fetch() as MemberPlatformMembership[];
                const kept = memberships.filter(membership => known.membershipTypes.has(membership.membershipTypeId));
                const reduced = await reducedPriceByMember(kept.map(membership => membership.memberId));
                const rows = kept.map(membership => flattenMembership(membership, reduced.has(membership.memberId)));
                return { rows, updatedAt: kept.map(membership => membership.updatedAt), lastId: memberships.at(-1)?.id ?? afterId };
            },
            existingIds: ids => existingModelIds(MemberPlatformMembership, ids),
            periodColumn: 'periodId',
        },
    ];
}

/**
 * Copy the platform record and the configuration that lives in json on it into the dimension tables.
 * Small enough to write on every run, and it has to happen before the tables pointing at it.
 *
 * The configuration holds one answer -- the name a tak, netwerk, lidgeldtype or functie carries
 * today -- and no history at all, so that answer is written against every period still open. The
 * frozen ones keep the answer they were counted with.
 */
async function syncPlatformConfig(openPeriodIds: string[]): Promise<void> {
    const platform = await Platform.getShared();
    const config = platform.config;

    const perPeriod = <T>(items: T[], flatten: (item: T, periodId: string) => StatisticsRow) =>
        openPeriodIds.flatMap(periodId => items.map(item => flatten(item, periodId)));

    // The platform record itself rather than its configuration, and therefore not per period: the
    // reports read which organization it runs and what it calls its verlaagd lidgeld, and what they
    // print of that organization comes from `organizations`, which is recorded per year like
    // everything else.
    await upsertRows('platform', ['id', 'name', 'membershipOrganizationId', 'reducedPriceName'], [flattenPlatform(platform)], ['id']);

    await upsertRows('organization_tags', ['id', 'periodId', 'name'], perPeriod(config.tags, flattenNamedConfig), namedConfigKey);

    await upsertRows('default_age_groups', ['id', 'periodId', 'name', 'minAge', 'maxAge'], perPeriod(config.defaultAgeGroups, (group, periodId) => flattenDefaultAgeGroup({ id: group.id, names: group.names, minAge: group.minAge, maxAge: group.maxAge }, periodId)), namedConfigKey);
    await upsertRows('platform_membership_types', ['id', 'periodId', 'name'], perPeriod(config.membershipTypes, flattenNamedConfig), namedConfigKey);
    await upsertRows('responsibilities', ['id', 'periodId', 'name'], perPeriod(config.responsibilities, flattenNamedConfig), namedConfigKey);
}

/** The periods the sync still writes into: everything the statistics database knows, minus the frozen ones. */
async function loadOpenPeriodIds(frozen: Set<string>): Promise<string[]> {
    return [...await loadIdSet('registration_periods')].filter(id => !frozen.has(id));
}

const namedConfigKey = ['id', 'periodId'];

/**
 * The tags an organization carries and the responsibilities it defines itself. Both hang off the
 * organization record, so they are written along with the batch of organizations they belong to
 * rather than by scanning every organization again.
 */
async function syncOrganizationTagsAndResponsibilities(organizations: Organization[], frozen: Set<string>, openPeriodIds: string[]): Promise<void> {
    if (organizations.length === 0) {
        return;
    }

    const ownResponsibilities = organizations.flatMap(organization => organization.privateMeta.responsibilities);
    await upsertRows('responsibilities', ['id', 'periodId', 'name'], openPeriodIds.flatMap(periodId => ownResponsibilities.map(responsibility => flattenNamedConfig(responsibility, periodId))), namedConfigKey);

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

type PeriodRange = { id: string; organizationId: string | null; startDate: Date; endDate: Date };

/**
 * The years the sync still writes into, grouped by the unit holding them. Every unit keeps its own
 * row per year; the platform's own years are the ones under no unit at all.
 */
async function loadOpenPeriodsByOrganization(frozen: Set<string>): Promise<Map<string | null, PeriodRange[]>> {
    const connection = getStatisticsConnection();
    const [rows] = await connection.select(
        'SELECT `id`, `organizationId`, `startDate`, `endDate` FROM `registration_periods`',
        [],
        { nestTables: false },
    );

    const byOrganization = new Map<string | null, PeriodRange[]>();
    for (const period of rows as unknown as PeriodRange[]) {
        if (frozen.has(period.id)) {
            continue;
        }

        const periods = byOrganization.get(period.organizationId);
        if (periods) {
            periods.push(period);
        } else {
            byOrganization.set(period.organizationId, [period]);
        }
    }

    return byOrganization;
}

/**
 * The years a record runs through: the ones of its own unit that its date range overlaps, or the
 * platform's own when it belongs to no unit.
 *
 * A record with no end date runs until now rather than forever, so a functie someone still holds is
 * not also recorded against the years that have not happened yet.
 */
function periodIdsOfRecord(record: MemberResponsibilityRecord, byOrganization: Map<string | null, PeriodRange[]>, now: Date): string[] {
    const periods = byOrganization.get(record.organizationId) ?? byOrganization.get(null) ?? [];
    const runsUntil = record.endDate !== null && record.endDate < now ? record.endDate : now;

    return periods
        .filter(period => period.startDate <= runsUntil && period.endDate >= record.startDate)
        .map(period => period.id);
}

/**
 * Responsibility records carry no `updatedAt`, so there is no watermark to advance: they are written
 * in full on every run. Records pointing at a responsibility that no longer exists are skipped.
 */
async function syncResponsibilityRecords(knownResponsibilities: Set<string>, frozen: Set<string>): Promise<void> {
    const columns = ['id', 'periodId', 'memberId', 'groupId', 'organizationId', 'responsibilityId', 'startDate', 'endDate'];
    const byOrganization = await loadOpenPeriodsByOrganization(frozen);
    const connection = getStatisticsConnection();
    const now = new Date();
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

        // Which years a record runs through follows from its dates, so a record whose dates changed
        // has to lose the years it no longer covers. Only outside the frozen ones: those are settled.
        const ids = idsOf(records);
        if (frozen.size > 0) {
            await connection.delete('DELETE FROM `member_responsibility_records` WHERE `id` IN (?) AND `periodId` NOT IN (?)', [ids, [...frozen]]);
        } else {
            await connection.delete('DELETE FROM `member_responsibility_records` WHERE `id` IN (?)', [ids]);
        }

        await upsertRows('member_responsibility_records', [...columns, ...sourceColumns], withSource(records
            .filter(record => knownResponsibilities.has(record.responsibilityId))
            .flatMap(record => periodIdsOfRecord(record, byOrganization, now).map(periodId => flattenResponsibilityRecord(record, periodId)))), ['id', 'periodId']);
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
        await upsertRows(definition.table, [...definition.columns, ...sourceColumns], withSource(live), definition.keyColumns);
        seen.push(...updatedAt);
        afterId = lastId;
    }

    await writeSyncState(definition.table, {
        watermark: nextWatermark(state.watermark, seen, startedAt),
        lastSucceededAt: new Date(),
    });
}

function emptyKnownIds() {
    return { ageGroups: new Set<string>(), membershipTypes: new Set<string>(), responsibilities: new Set<string>() };
}

/** The tables the delete reconciliation walks, which is every table it may take a row out of. */
export function reconciledTables(): string[] {
    return [periodsTable(), ...buildIncrementalTables(emptyKnownIds(), new Set(), [])]
        .filter(definition => !definition.neverDelete)
        .map(definition => definition.table);
}

/**
 * Bring the statistics database up to date with everything that changed since the last run.
 *
 * Written so a crash is harmless: every write is an upsert, and a table that throws keeps its old
 * watermark, so the next run reads the same window again instead of skipping it.
 */
export async function syncStatistics(): Promise<void> {
    await applyImportedCutoff(getImportedUntil());
    const frozen = await loadFrozenPeriodIds();

    // The periods before anything else, and the configuration before the rows that group by it: every
    // table here is written per period, so a period that is not in yet is a period nothing can be
    // written against.
    await syncIncrementalTable(periodsTable(), frozen);

    const openPeriodIds = await loadOpenPeriodIds(frozen);
    await syncPlatformConfig(openPeriodIds);

    const known = {
        ageGroups: await loadIdSet('default_age_groups'),
        membershipTypes: await loadIdSet('platform_membership_types'),
        responsibilities: await loadIdSet('responsibilities'),
    };

    for (const definition of buildIncrementalTables(known, frozen, openPeriodIds)) {
        await syncIncrementalTable(definition, frozen);
    }

    await syncResponsibilityRecords(await loadIdSet('responsibilities'), frozen);
}

/**
 * Remove statistics rows whose source row is gone. Deletes leave nothing behind to notice in an
 * incremental pass, so they are reconciled separately by walking the statistics ids and asking the
 * source which of them still exist.
 */
export async function syncStatisticsDeletes(): Promise<void> {
    const frozen = await loadFrozenPeriodIds();

    for (const definition of [periodsTable(), ...buildIncrementalTables(emptyKnownIds(), frozen, [])]) {
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
