import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { patchObject } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { EmailAddress } from '@stamhoofd/email';
import type { Organization, User } from '@stamhoofd/models';
import { Group, Platform } from '@stamhoofd/models';
import { MailchimpCredential } from '@stamhoofd/models/models/MailchimpCredential.js';
import { MailchimpSync } from '@stamhoofd/models/models/MailchimpSync.js';
import { QueueHandler } from '@stamhoofd/queues';
import { v4 as uuidv4 } from 'uuid';
import type { RecordCategory, RecordSettings } from '@stamhoofd/structures';
import { RecordType } from '@stamhoofd/structures';
import { MailchimpAudience } from '@stamhoofd/structures/mailchimp/MailchimpAudience.js';
import { MailchimpSettings } from '@stamhoofd/structures/mailchimp/MailchimpSettings.js';
import { MailchimpSyncIssue, MailchimpSyncIssueReason, MailchimpSyncResult, MailchimpSyncStatus } from '@stamhoofd/structures/mailchimp/MailchimpSync.js';
import { MailchimpSyncPreview } from '@stamhoofd/structures/mailchimp/MailchimpSyncPreview.js';
import type { MailchimpSyncRequest } from '@stamhoofd/structures/mailchimp/MailchimpSyncRequest.js';
import { MailchimpSyncType } from '@stamhoofd/structures/mailchimp/MailchimpSyncRequest.js';
import { Context } from '../../helpers/Context.js';
import type { MailchimpContact } from './buildContacts.js';
import { buildContacts } from './buildContacts.js';
import type { MailchimpAbortSignal, MailchimpMergeField } from './MailchimpClient.js';
import { MailchimpApiError, MailchimpClient } from './MailchimpClient.js';
import { loadMailchimpSources } from './loadMailchimpSources.js';
import type { MailchimpEmailStatus, MailchimpMergeFieldTags } from './planSync.js';
import { planSync } from './planSync.js';
import { MailchimpTags } from './MailchimpTags.js';

const MAX_ISSUES = 1000;
const MAILCHIMP_RECORD_TYPES = [RecordType.Checkbox, RecordType.ChooseOne, RecordType.MultipleChoice];
const EMAIL_STATUS_BATCH_SIZE = 500;

export const MAILCHIMP_MERGE_FIELDS = {
    members: 'SH_LEDEN',
    groups: 'SH_GROEPEN',
    organizations: 'SH_VERENIG',
};

export class MailchimpService {
    /**
     * Syncs with a job in this process. Others that are still marked as running were interrupted.
     * Assumes a single API process, like the other QueueHandler based jobs.
     */
    static runningSyncIds = new Set<string>();

    /**
     * Connecting and synchronising requires full access to the organization, or full platform access when there is no organization
     */
    static async authenticate() {
        const organization = await Context.setOptionalOrganizationScope();
        const { user } = await Context.authenticate();

        const allowed = organization ? await Context.auth.hasFullAccess(organization.id) : Context.auth.hasPlatformFullAccess();
        if (!allowed) {
            throw Context.auth.error();
        }

        if (!await Context.checkFeatureFlag('mailchimp')) {
            throw new SimpleError({
                code: 'not_available',
                message: 'Mailchimp is not enabled',
                human: $t('%ZwQ'),
                statusCode: 400,
            });
        }
        return { organization, user };
    }

    static async saveSettings(organization: Organization | null, settings: MailchimpSettings | null) {
        if (organization) {
            organization.privateMeta.mailchimp = settings;
            await organization.save();
            return;
        }
        const platform = await Platform.getForEditing();
        platform.privateConfig.mailchimp = settings;
        await platform.save();
    }

    static async loadSettings(organization: Organization | null) {
        if (organization) {
            return organization.privateMeta.mailchimp;
        }
        return (await Platform.getSharedPrivateStruct()).privateConfig.mailchimp;
    }

    static getQueueName(organization: Organization | null) {
        return 'mailchimp-sync-' + (organization?.id ?? 'platform');
    }

    static async getClient(organization: Organization | null) {
        const credential = await MailchimpCredential.getFor(organization?.id ?? null);
        if (!credential) {
            throw new SimpleError({
                code: 'mailchimp_not_connected',
                message: 'Mailchimp is not connected',
                human: $t('%Zv5'),
                statusCode: 400,
            });
        }
        return new MailchimpClient(credential.apiKey);
    }

    static toSimpleError(error: unknown): unknown {
        if (!(error instanceof MailchimpApiError)) {
            return error;
        }
        if (error.status === 401 || error.status === 403) {
            return new SimpleError({
                code: 'mailchimp_unauthorized',
                message: error.message,
                human: $t('%ZvQ'),
                field: 'apiKey',
            });
        }
        return new SimpleError({
            code: 'mailchimp_error',
            message: error.message,
            human: $t('%ZxA', { message: error.detail || error.title }),
        });
    }

    static async connect(organization: Organization | null, apiKey: string): Promise<MailchimpSettings> {
        return await QueueHandler.schedule('mailchimp-connect-' + (organization?.id ?? 'platform'), async () => {
            return await this.connectInQueue(organization, apiKey);
        });
    }

    private static async connectInQueue(organization: Organization | null, apiKey: string): Promise<MailchimpSettings> {
        const client = new MailchimpClient(apiKey);
        let accountName: string;
        try {
            accountName = await client.getAccountName();
        }
        catch (e) {
            throw this.toSimpleError(e);
        }

        const settings = (await this.loadSettings(organization))?.clone() ?? MailchimpSettings.create({});
        settings.accountName = accountName;
        settings.dataCenter = client.dataCenter;

        // The key might belong to another account
        if (settings.audienceId) {
            const lists = await this.getAudiencesWithClient(client);
            const list = lists.find(l => l.id === settings.audienceId);
            settings.audienceId = list?.id ?? null;
            settings.audienceName = list?.name ?? null;
        }

        const credential = await MailchimpCredential.getFor(organization?.id ?? null) ?? new MailchimpCredential();
        credential.organizationId = organization?.id ?? null;
        credential.apiKey = client.apiKey;
        await credential.save();
        await this.saveSettings(organization, settings);
        return settings;
    }

    static async disconnect(organization: Organization | null) {
        if (QueueHandler.isRunning(this.getQueueName(organization))) {
            throw new SimpleError({
                code: 'sync_running',
                message: 'A synchronisation is running',
                human: $t('%Zty'),
            });
        }
        const credential = await MailchimpCredential.getFor(organization?.id ?? null);
        if (credential) {
            await credential.delete();
        }
        await this.saveSettings(organization, null);
    }

    static async getAudiencesWithClient(client: MailchimpClient) {
        try {
            const lists = await client.getLists();
            return lists.map(l => MailchimpAudience.create(l));
        }
        catch (e) {
            throw this.toSimpleError(e);
        }
    }

    static async getAudiences(organization: Organization | null) {
        return await this.getAudiencesWithClient(await this.getClient(organization));
    }

    static async patchSettings(organization: Organization | null, patch: AutoEncoderPatchType<MailchimpSettings>): Promise<MailchimpSettings> {
        const current = await this.loadSettings(organization);
        if (!current) {
            throw new SimpleError({
                code: 'mailchimp_not_connected',
                message: 'Mailchimp is not connected',
                human: $t('%Zv5'),
                statusCode: 400,
            });
        }
        const settings = current.clone();

        if (patch.audienceId !== undefined && patch.audienceId !== settings.audienceId) {
            if (patch.audienceId === null) {
                settings.audienceId = null;
                settings.audienceName = null;
            }
            else {
                const lists = await this.getAudiences(organization);
                const list = lists.find(l => l.id === patch.audienceId);
                if (!list) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Audience not found',
                        human: $t('%ZvA'),
                        field: 'audienceId',
                    });
                }
                settings.audienceId = list.id;
                settings.audienceName = list.name;
            }
        }

        if (patch.newsletterRecordId !== undefined) {
            settings.newsletterRecordId = patch.newsletterRecordId;
        }
        if (patch.newsletterChoiceIds !== undefined) {
            settings.newsletterChoiceIds = patchObject(settings.newsletterChoiceIds, patch.newsletterChoiceIds);
        }
        if (patch.tagRecordIds !== undefined) {
            settings.tagRecordIds = patchObject(settings.tagRecordIds, patch.tagRecordIds);
        }
        if (settings.newsletterRecordId === null) {
            settings.newsletterChoiceIds = [];
        }

        if (patch.newsletterRecordId !== undefined || patch.newsletterChoiceIds !== undefined || patch.tagRecordIds !== undefined) {
            await this.validateRecords(organization, settings, current);
        }

        await this.saveSettings(organization, settings);
        return settings;
    }

    /**
     * Records an organization can use: those of the platform, the organization and its groups in the current period.
     * A platform can only use its own records, because records of organizations have no shared meaning.
     */
    static async getSelectableRecords(organization: Organization | null): Promise<RecordSettings[]> {
        const platform = await Platform.getSharedStruct();
        const categories: RecordCategory[] = [...platform.config.recordsConfiguration.recordCategories];

        if (organization) {
            categories.push(...organization.meta.recordsConfiguration.recordCategories);
            const groups = await Group.select()
                .where('organizationId', organization.id)
                .where('periodId', organization.periodId)
                .where('deletedAt', null)
                .fetch();
            for (const group of groups) {
                categories.push(...group.settings.recordCategories);
            }
        }
        else {
            for (const ageGroup of platform.config.defaultAgeGroups) {
                categories.push(...ageGroup.recordsConfiguration.recordCategories);
            }
        }

        return categories.flatMap(c => c.getAllRecords())
            .filter(r => !r.sensitive && MAILCHIMP_RECORD_TYPES.includes(r.type));
    }

    /**
     * Only validates records that changed: records that were removed later must not block saving other settings
     */
    private static async validateRecords(organization: Organization | null, settings: MailchimpSettings, previous: MailchimpSettings) {
        const records = await this.getSelectableRecords(organization);
        const invalidRecord = (field: string) => new SimpleError({
            code: 'invalid_field',
            message: 'This record cannot be used for Mailchimp',
            human: $t('%ZwK'),
            field,
        });

        const newsletterChanged = settings.newsletterRecordId !== previous.newsletterRecordId
            || settings.newsletterChoiceIds.join(',') !== previous.newsletterChoiceIds.join(',');

        if (settings.newsletterRecordId !== null && newsletterChanged) {
            const record = records.find(r => r.id === settings.newsletterRecordId);
            if (!record) {
                throw invalidRecord('newsletterRecordId');
            }
            if (record.type === RecordType.Checkbox) {
                settings.newsletterChoiceIds = [];
            }
            else if (settings.newsletterChoiceIds.length === 0 || settings.newsletterChoiceIds.some(id => !record.choices.find(c => c.id === id))) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Invalid newsletter choices',
                    human: $t("%Zvj"),
                    field: 'newsletterChoiceIds',
                });
            }
        }

        for (const id of settings.tagRecordIds) {
            if (!previous.tagRecordIds.includes(id) && !records.find(r => r.id === id)) {
                throw invalidRecord('tagRecordIds');
            }
        }
    }

    static async getEmailStatus(emails: string[], organizationId: string | null) {
        const result = new Map<string, MailchimpEmailStatus>();
        for (let i = 0; i < emails.length; i += EMAIL_STATUS_BATCH_SIZE) {
            const rows = await EmailAddress.getByEmails(emails.slice(i, i + EMAIL_STATUS_BATCH_SIZE), organizationId);
            for (const row of rows) {
                const email = row.email.toLowerCase();
                const status = result.get(email) ?? { unsubscribed: false, hardBounce: false, markedAsSpam: false };

                // Rows of other organizations are only returned for bounces and spam reports
                const inScope = row.organizationId === null || row.organizationId === organizationId;
                status.unsubscribed ||= inScope && (row.unsubscribedMarketing || row.unsubscribedAll);
                status.hardBounce ||= row.hardBounce;
                status.markedAsSpam ||= row.markedAsSpam;
                result.set(email, status);
            }
        }
        return result;
    }

    static validateRequest(organization: Organization | null, request: MailchimpSyncRequest, settings: MailchimpSettings | null): MailchimpSettings {
        if (!settings?.audienceId) {
            throw new SimpleError({
                code: 'mailchimp_not_connected',
                message: 'Mailchimp is not connected',
                human: $t('%ZwA'),
                statusCode: 400,
            });
        }

        if (request.type === MailchimpSyncType.Members) {
            if (organization && !organization.meta.packages.useMembers) {
                throw new SimpleError({
                    code: 'not_available',
                    message: 'Members package not active',
                    human: $t('%ZuA'),
                    statusCode: 400,
                });
            }
        }
        else {
            if (!organization) {
                throw new SimpleError({
                    code: 'not_available',
                    message: 'Orders can only be synced for an organization',
                    human: $t('%Zvn'),
                    statusCode: 400,
                });
            }
            if (request.full) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Full synchronisation is only possible for members',
                    field: 'full',
                });
            }
        }

        if (!request.full && request.archiveRemoved) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Archiving is only possible in a full synchronisation',
                field: 'archiveRemoved',
            });
        }

        return settings;
    }

    /**
     * Without this check, a removed newsletter record would count as 'no consent' for everyone and a full sync would unsubscribe the whole audience
     */
    static async validateNewsletterRecord(organization: Organization | null, request: MailchimpSyncRequest, settings: MailchimpSettings) {
        if (request.type !== MailchimpSyncType.Members || !settings.newsletterRecordId) {
            return;
        }
        const records = await this.getSelectableRecords(organization);
        if (!records.find(r => r.id === settings.newsletterRecordId)) {
            throw new SimpleError({
                code: 'newsletter_record_missing',
                message: 'The newsletter record no longer exists',
                human: $t('%Zwo'),
                statusCode: 400,
            });
        }
    }

    static requiresConsentConfirmation(request: MailchimpSyncRequest, settings: MailchimpSettings) {
        return request.type === MailchimpSyncType.Orders || !settings.newsletterRecordId;
    }

    static async buildContacts(organization: Organization | null, request: MailchimpSyncRequest, settings: MailchimpSettings, tags: MailchimpTags, signal?: MailchimpAbortSignal) {
        // Answers carry a snapshot of the record, so a record that was made sensitive or removed after it was chosen is checked against the current configuration
        const selectable = new Set((await this.getSelectableRecords(organization)).map(r => r.id));
        const current = settings.clone();
        current.tagRecordIds = settings.tagRecordIds.filter(id => selectable.has(id));

        const sources = await loadMailchimpSources(organization, request, current, tags, signal);
        return buildContacts(sources);
    }

    static async preview(organization: Organization | null, request: MailchimpSyncRequest): Promise<MailchimpSyncPreview> {
        const settings = this.validateRequest(organization, request, await this.loadSettings(organization));
        await this.validateNewsletterRecord(organization, request, settings);
        const tags = await MailchimpTags.forScope(organization);
        const contacts = await this.buildContacts(organization, request, settings, tags);
        const status = await this.getEmailStatus(contacts.map(c => c.email), organization?.id ?? null);

        // Without Mailchimp data every contact counts as new
        const plan = planSync(contacts, new Map(), status, {
            kind: request.type === MailchimpSyncType.Orders ? 'orders' : 'members',
            full: request.full,
            doubleOptIn: request.doubleOptIn,
            archiveRemoved: false,
            mergeFields: { firstName: null, lastName: null, members: null, groups: null, organizations: null },
            tags,
        });

        const count = (reasons: MailchimpSyncIssueReason[]) => plan.skips.filter(s => reasons.includes(s.reason)).length;
        return MailchimpSyncPreview.create({
            contacts: plan.upserts.length,
            withoutConsent: count([MailchimpSyncIssueReason.NoConsent]),
            unsubscribed: count([MailchimpSyncIssueReason.Unsubscribed]),
            blocked: count([MailchimpSyncIssueReason.InvalidEmail, MailchimpSyncIssueReason.HardBounce, MailchimpSyncIssueReason.MarkedAsSpam]),
            usesNewsletterRecord: request.type === MailchimpSyncType.Members && !!settings.newsletterRecordId,
        });
    }

    static async start(organization: Organization | null, user: User, request: MailchimpSyncRequest): Promise<MailchimpSync> {
        const settings = this.validateRequest(organization, request, await this.loadSettings(organization));
        await this.validateNewsletterRecord(organization, request, settings);

        if (this.requiresConsentConfirmation(request, settings) && !request.confirmedConsent) {
            throw new SimpleError({
                code: 'consent_required',
                message: 'Confirm that you have permission to email these contacts',
                human: $t('%Zur'),
                field: 'confirmedConsent',
            });
        }

        const queue = this.getQueueName(organization);
        if (QueueHandler.isRunning(queue)) {
            throw new SimpleError({
                code: 'sync_running',
                message: 'A synchronisation is already running',
                human: $t('%Ztz'),
                statusCode: 400,
            });
        }

        const sync = new MailchimpSync();
        sync.id = uuidv4();
        sync.organizationId = organization?.id ?? null;
        sync.userId = user.id;
        sync.request = request;
        const saved = sync.save();

        this.runningSyncIds.add(sync.id);
        QueueHandler.schedule(queue, async ({ abort }) => {
            await saved;
            await this.run(sync, organization, settings, abort);
        }).catch(console.error).finally(() => {
            this.runningSyncIds.delete(sync.id);
        });

        await saved;
        return sync;
    }

    /**
     * A sync that is still marked as running but has no job (e.g. after a restart) was interrupted
     */
    static getStructure(sync: MailchimpSync) {
        const struct = sync.getStructure();
        if (struct.isRunning && !this.runningSyncIds.has(sync.id)) {
            struct.status = MailchimpSyncStatus.Failed;
            struct.errorMessage = $t('%ZuS');
        }
        return struct;
    }

    static async ensureMergeFields(client: MailchimpClient, listId: string, organization: Organization | null, kind: 'members' | 'orders', i18n: MailchimpTags['i18n']): Promise<MailchimpMergeFieldTags> {
        const existing = await client.getMergeFields(listId);
        const byTag = new Map(existing.map(f => [f.tag, f]));
        const platformName = (await Platform.getShared()).config.name;

        const ensure = async (field: MailchimpMergeField) => {
            const current = byTag.get(field.tag);
            if (current) {
                if (current.type !== field.type) {
                    throw new SimpleError({
                        code: 'merge_field_conflict',
                        message: `Merge field ${field.tag} already exists with type ${current.type}`,
                        human: $t('%Zwa', { tag: field.tag }),
                    });
                }
                return field.tag;
            }
            try {
                await client.createMergeField(listId, field);
            }
            catch (e) {
                // A retried create after a 5xx can hit a field that was created after all
                if (!(e instanceof MailchimpApiError && e.status === 400 && /already exists/i.test(e.detail))) {
                    throw e;
                }
            }
            return field.tag;
        };

        const tags: MailchimpMergeFieldTags = {
            firstName: byTag.has('FNAME') ? 'FNAME' : null,
            lastName: byTag.has('LNAME') ? 'LNAME' : null,
            members: null,
            groups: null,
            organizations: null,
        };

        if (kind === 'members') {
            tags.members = await ensure({ tag: MAILCHIMP_MERGE_FIELDS.members, name: platformName + ' - ' + i18n.$t('%1EH'), type: 'text' });
            tags.groups = await ensure({ tag: MAILCHIMP_MERGE_FIELDS.groups, name: platformName + ' - ' + i18n.$t('%wP'), type: 'text' });
            if (!organization) {
                tags.organizations = await ensure({ tag: MAILCHIMP_MERGE_FIELDS.organizations, name: platformName + ' - ' + i18n.$t('%1HI'), type: 'text' });
            }
        }
        return tags;
    }

    static async run(sync: MailchimpSync, organization: Organization | null, settings: MailchimpSettings, signal: MailchimpAbortSignal) {
        const request = sync.request;
        const listId = settings.audienceId!;
        const result = MailchimpSyncResult.create({});
        const kind = request.type === MailchimpSyncType.Orders ? 'orders' : 'members';

        const addIssue = (email: string, reason: MailchimpSyncIssueReason, detail: string | null = null) => {
            if (result.issues.length < MAX_ISSUES) {
                result.issues.push(MailchimpSyncIssue.create({ email, reason, detail }));
            }
        };

        let lastSave = 0;
        const saveProgress = async (force = false) => {
            if (!force && Date.now() - lastSave < 1000) {
                return;
            }
            lastSave = Date.now();
            sync.result = result.clone();
            await sync.save();
        };

        try {
            sync.status = MailchimpSyncStatus.Running;
            await sync.save();

            const client = await this.getClient(organization);
            const tags = await MailchimpTags.forScope(organization);
            const contacts: MailchimpContact[] = await this.buildContacts(organization, request, settings, tags, signal);
            const emailStatus = await this.getEmailStatus(contacts.map(c => c.email), organization?.id ?? null);

            let mergeFields: MailchimpMergeFieldTags;
            let existing: Awaited<ReturnType<MailchimpClient['getMembers']>>;
            try {
                mergeFields = await this.ensureMergeFields(client, listId, organization, kind, tags.i18n);
                existing = await client.getMembers(listId, signal);
            }
            catch (e) {
                throw this.toSimpleError(e);
            }

            const plan = planSync(contacts, existing, emailStatus, {
                kind,
                full: request.full,
                doubleOptIn: request.doubleOptIn,
                archiveRemoved: request.archiveRemoved,
                mergeFields,
                tags,
            });

            result.total = plan.upserts.length + plan.removals.length + plan.skips.length;
            for (const skip of plan.skips) {
                result.skipped++;
                result.processed++;
                addIssue(skip.email, skip.reason);
            }
            await saveProgress(true);

            const handleError = (email: string, e: unknown) => {
                if (e instanceof MailchimpApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 403) {
                    result.failed++;
                    addIssue(email, MailchimpSyncIssueReason.Rejected, e.detail || e.title);
                    return;
                }
                throw this.toSimpleError(e);
            };

            await MailchimpClient.runConcurrently(plan.upserts, async (upsert) => {
                try {
                    await client.upsertMember(listId, {
                        email: upsert.email,
                        statusIfNew: upsert.statusIfNew,
                        status: upsert.unsubscribe ? 'unsubscribed' : undefined,
                        mergeFields: upsert.mergeFields,
                    });
                    await client.updateTags(listId, upsert.email, upsert.tags);
                    if (upsert.isNew) {
                        result.added++;
                    }
                    else {
                        result.updated++;
                    }
                }
                catch (e) {
                    handleError(upsert.email, e);
                }
                result.processed++;
                await saveProgress();
            }, signal);

            await MailchimpClient.runConcurrently(plan.removals, async (removal) => {
                try {
                    await client.updateTags(listId, removal.email, removal.tags);
                    if (removal.archive) {
                        await client.archiveMember(listId, removal.email);
                        result.archived++;
                    }
                    if (removal.markAsRemoved) {
                        result.removed++;
                    }
                }
                catch (e) {
                    handleError(removal.email, e);
                }
                result.processed++;
                await saveProgress();
            }, signal);

            sync.status = MailchimpSyncStatus.Done;
        }
        catch (e) {
            console.error('[Mailchimp] Sync failed', sync.id, e);
            sync.status = MailchimpSyncStatus.Failed;
            sync.errorMessage = isSimpleError(e) || isSimpleErrors(e) ? e.getHuman() : $t('%ZuZ');
        }

        sync.finishedAt = new Date();
        sync.result = result.clone();
        await sync.save();
    }
}
