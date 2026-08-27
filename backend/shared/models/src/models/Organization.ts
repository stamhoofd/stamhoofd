import { column, Database } from '@simonbackx/simple-database';
import { SimpleError } from '@simonbackx/simple-errors';
import { I18n } from '@stamhoofd/backend-i18n/I18n';
import type { EmailInterfaceRecipient } from '@stamhoofd/email';
import { QueueHandler } from '@stamhoofd/queues';
import { QueryableModel, SQL, SQLWhereExists } from '@stamhoofd/sql';
import type { OrganizationEmail, PrivatePaymentConfiguration } from '@stamhoofd/structures';
import { AccessRight, Address, Company, getAppHost, GroupType, OrganizationMetaData, OrganizationPrivateMetaData, Organization as OrganizationStruct, PaymentMethod, PaymentProvider, Recipient, TransferSettings } from '@stamhoofd/structures';
import type { PaymentMandate } from '@stamhoofd/structures/PaymentMandate.js';
import { Language } from '@stamhoofd/types/Language';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { OrganizationServerMetaData } from '../structures/OrganizationServerMetaData.js';
import { Event } from './Event.js';
import { Group } from './Group.js';
import { OrganizationRegistrationPeriod } from './OrganizationRegistrationPeriod.js';
import { Platform } from './Platform.js';
import { Registration } from './Registration.js';
import { StripeAccount } from './StripeAccount.js';
import { Token } from './Token.js';
import type { User } from './User.js';

export class Organization extends QueryableModel {
    static table = 'organizations';
    // static cache = new ModelCache<Organization>();

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    /**
     * The tenant this row belongs to. Nullable until every row is backfilled.
     */
    @column({ type: 'string', nullable: true })
    tenantId: string | null = null;

    @column({ type: 'string' })
    name: string;

    /// URL to a website page or a Facebook page (including http)
    @column({ type: 'string', nullable: true })
    website: string | null = null;

    /** Null falls back to the language of the platform. */
    @column({ type: 'string', nullable: true })
    language: Language | null = null;

    /// A custom domain name that is used to host the register application (should be unique)
    // E.g. inschrijven.scoutswetteren.be
    @column({ type: 'string', nullable: true })
    registerDomain: string | null = null;

    // Unique representation of this organization from a string, that is used to provide the default domains
    // in uri.stamhoofd.be
    @column({ type: 'string' })
    uri: string;

    @column({ type: 'string' })
    periodId: string;

    @column({ type: 'boolean' })
    hasFutureEvents: boolean = true;

    /**
     * Public meta data
     */
    @column({ type: 'json', decoder: OrganizationMetaData })
    meta: OrganizationMetaData = OrganizationMetaData.create({});

    /**
     * Data only accessible by the owners / users with special permissions
     */
    @column({ type: 'json', decoder: OrganizationPrivateMetaData })
    privateMeta: OrganizationPrivateMetaData = OrganizationPrivateMetaData.create({});

    /**
     * Data only accessible by the server
     */
    @column({ type: 'json', decoder: OrganizationServerMetaData })
    serverMeta: OrganizationServerMetaData = OrganizationServerMetaData.create({});

    @column({ type: 'json', decoder: Address })
    address: Address;

    @column({
        type: 'string', beforeSave: function (this: Organization) {
            return this.name + '\n' + this.address.toString();
        },
    })
    searchIndex: string;

    @column({
        type: 'datetime', beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    @column({ type: 'boolean' })
    active = true;

    /**
     * Return default locale configuration
     */
    get i18n() {
        return new I18n(Language.Dutch, this.address.country);
    }

    /**
     * Makes sure empty name is replaced with organization name
     */
    get mappedTransferSettings(): TransferSettings {
        return this.meta.transferSettings.fillMissing(TransferSettings.create({ creditor: this.name }));
    }

    static getFutureEventsCutoffDate(): Date {
        return new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 2);
    }

    async updateFutureEvents() {
        const firstEvent = await Event.select('id')
            .where(
                STAMHOOFD.userMode === 'platform'
                    ? SQL.where('organizationId', this.id).or('organizationId', null)
                    : SQL.where('organizationId', this.id),

            )
            .where('endDate', '>', Organization.getFutureEventsCutoffDate())
            .first(false);
        if (firstEvent) {
            this.hasFutureEvents = true;
        } else {
            this.hasFutureEvents = false;
        }
    }

    /**
     * Update the hasFutureEvents column for multiple organizations (or all organizations) in a single query,
     * instead of fetching and saving every organization individually.
     */
    static async updateFutureEventsForOrganizations(organizationIds: string[] | 'all') {
        if (organizationIds !== 'all' && organizationIds.length === 0) {
            return;
        }

        const query = Organization.update()
            .set(
                'hasFutureEvents',
                new SQLWhereExists(
                    SQL.select(SQL.scalar(1))
                        .from(Event.table)
                        .where(
                            STAMHOOFD.userMode === 'platform'
                                ? SQL.where('organizationId', SQL.column(Organization.table, 'id')).or('organizationId', null)
                                : SQL.where('organizationId', SQL.column(Organization.table, 'id')),
                        )
                        .where('endDate', '>', Organization.getFutureEventsCutoffDate()),
                ),
            );

        if (organizationIds !== 'all') {
            query.where('id', organizationIds);
        }

        await query.update();
    }

    // Methods
    static async getByURI(uri: string): Promise<Organization | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()} FROM ${this.table} WHERE \`uri\` = ? LIMIT 1`,
            [uri],
        );

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        return this.fromRow(rows[0][this.table]);
    }

    // Methods
    static async getByEmail(email: string): Promise<Organization | undefined> {
        if (email.startsWith('noreply-')) {
            // Trim
            email = email.substring('noreply-'.length);
        }

        for (const domain of [
            ...Object.values(STAMHOOFD.domains.defaultBroadcastEmail ?? {}),
            ...Object.values(STAMHOOFD.domains.defaultTransactionalEmail ?? {}),
        ]) {
            if (email.endsWith('@' + domain)) {
                const uri = email.substring(0, email.length - ('@' + domain).length);
                return await Organization.getByURI(uri);
            }
        }

        const at = email.indexOf('@');
        const domain = email.substring(at + 1);

        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()} FROM ${this.table} WHERE privateMeta->"$.value.mailDomain" = ? LIMIT 1`,
            [domain],
        );

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        return this.fromRow(rows[0][this.table]);
    }

    // Methods
    static async getByRegisterDomain(host: string): Promise<Organization | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()} FROM ${this.table} WHERE \`registerDomain\` = ? LIMIT 1`,
            [host],
        );

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        return this.fromRow(rows[0][this.table]);
    }

    /**
     * Get an Organization by looking at the host of a request
     * Format is 2331c59a-0cbe-4279-871c-ea9d0474cd54.api.stamhoofd.app
     */
    static async fromApiHost(host: string, options?: { allowInactive?: boolean }): Promise<Organization> {
        if (!host.endsWith('.' + STAMHOOFD.domains.api)) {
            throw new SimpleError({
                code: 'invalid_host',
                message: 'Please specify the organization in the hostname',
            });
        }
        const id = host.substring(0, host.length - STAMHOOFD.domains.api.length - 1);
        const organization = await this.getByID(id);
        if (!organization) {
            throw new SimpleError({
                code: 'invalid_organization',
                message: 'No organization known for host ' + host,
            });
        }

        if (!organization.active && !options?.allowInactive) {
            throw new SimpleError({
                code: 'archived',
                message: 'This organization is archived',
                human: $t(`%x4`),
            });
        }
        return organization;
    }

    getDashboardHost(i18n?: { language: Language; locale: string }): string {
        return getAppHost('dashboard', this, true, i18n);
    }

    get registerUrl(): string {
        return 'https://' + getAppHost('registration', this, false);
    }

    get marketingDomain(): string {
        return STAMHOOFD.domains.marketing[this.address.country] ?? STAMHOOFD.domains.marketing[''];
    }

    getApiHost(): string {
        const defaultDomain = STAMHOOFD.domains.api;
        if (!defaultDomain) {
            throw new Error('Missing hostname in environment');
        }
        return this.id + '.' + defaultDomain;
    }

    private _cachedPeriod?: OrganizationRegistrationPeriod;

    async getPeriod() {
        if (this._cachedPeriod) {
            return this._cachedPeriod;
        }

        const oPeriods = await OrganizationRegistrationPeriod.where({ periodId: this.periodId, organizationId: this.id }, { limit: 1 });

        let oPeriod: OrganizationRegistrationPeriod;
        if (oPeriods.length == 0) {
            // Automatically create a period
            oPeriod = await QueueHandler.schedule('create-missing-organization-period', async () => {
                // Race condition check
                const updatedPeriods = await OrganizationRegistrationPeriod.where({ periodId: this.periodId, organizationId: this.id }, { limit: 1 });

                if (updatedPeriods.length) {
                    return updatedPeriods[0];
                }

                console.log('Automatically creating new organization registration period for organization ' + this.id + ' and period ' + this.periodId + ' - organization period is missing');
                const created = new OrganizationRegistrationPeriod();
                created.organizationId = this.id;
                created.periodId = this.periodId;
                await created.save();
                return created;
            });
        } else {
            oPeriod = oPeriods[0];
        }

        this._cachedPeriod = oPeriod;
        return oPeriod;
    }

    getBaseStructure(): OrganizationStruct {
        return OrganizationStruct.create({
            id: this.id,
            active: this.active,
            name: this.name,
            meta: this.meta,
            address: this.address,
            registerDomain: this.registerDomain,
            uri: this.uri,
            website: this.website,
            language: this.language,
            createdAt: this.createdAt,
            hasFutureEvents: this.hasFutureEvents,
        });
    }

    getBaseStructureWithPrivateMeta(): OrganizationStruct {
        return OrganizationStruct.create({
            id: this.id,
            active: this.active,
            name: this.name,
            meta: this.meta,
            privateMeta: this.privateMeta,
            address: this.address,
            registerDomain: this.registerDomain,
            uri: this.uri,
            website: this.website,
            language: this.language,
            createdAt: this.createdAt,
            hasFutureEvents: this.hasFutureEvents,
        });
    }

    /**
     * Return default e-mail address if no email addresses are set.
     */
    getDefaultFrom(i18n: I18n, type: 'transactional' | 'broadcast' = 'broadcast'): EmailInterfaceRecipient {
        const domain = type === 'transactional' ? i18n.localizedDomains.defaultTransactionalEmail() : i18n.localizedDomains.defaultBroadcastEmail();

        return {
            name: this.name,
            email: ('noreply-' + this.uri + '@' + domain),
        };
    }

    async getPaymentProviderFor(method: PaymentMethod, mandate: PaymentMandate | null, config: PrivatePaymentConfiguration): Promise<{
        provider: PaymentProvider | null;
        stripeAccount: StripeAccount | null;
    }> {
        if (mandate) {
            return {
                provider: mandate.provider,
                stripeAccount: null,
            };
        }

        let stripeAccount = (config.stripeAccountId ? (await StripeAccount.getByID(config.stripeAccountId)) : null) ?? null;
        if (stripeAccount && stripeAccount.organizationId !== this.id) {
            console.warn('Stripe account ' + stripeAccount.id + ' is not linked to organization ' + this.id);
            stripeAccount = null;
        }
        const provider = this.privateMeta.getPaymentProviderFor(method, stripeAccount?.meta);
        if (provider === null && ![PaymentMethod.Unknown, PaymentMethod.Transfer, PaymentMethod.PointOfSale].includes(method)) {
            if (!stripeAccount && config.stripeAccountId) {
                console.warn('Missing stripe account id ' + config.stripeAccountId);
            }
            throw new SimpleError({
                code: 'payment_provider_not_configured',
                message: 'Payment provider not configured for ' + method,
                human: $t(`%x5`),
            });
        }

        if (provider !== PaymentProvider.Stripe && stripeAccount) {
            stripeAccount = null;
        }
        return {
            provider,
            stripeAccount,
        };
    }

    async getConnectedPaymentProviders(): Promise<PaymentProvider[]> {
        const allPaymentMethods = Object.values(PaymentMethod);
        const providers: PaymentProvider[] = [];

        let stripeAccounts: (StripeAccount | null)[] = await StripeAccount.where({ organizationId: this.id, status: 'active' });

        if (stripeAccounts.length === 0) {
            stripeAccounts = [null];
        }

        for (const account of stripeAccounts) {
            for (const method of allPaymentMethods) {
                const provider = this.privateMeta.getPaymentProviderFor(method, account?.meta);
                if (provider && !providers.includes(provider)) {
                    providers.push(provider);
                }
            }
        }

        return providers;
    }

    override async delete(): Promise<void> {
        // Clear periodID first to remove circular dependency
        if (this.periodId) {
            await Organization.update().where('id', this.id).set('periodId', null).update();
        }

        return await super.delete();
    }

    /**
     * Get the number of active members that are currently registered
     * This is used for billing
     */
    static async getActiveMembers(organizationId: string): Promise<number> {
        const organization = await Organization.getByID(organizationId);
        if (!organization) {
            return 0;
        }

        return await Registration.select()
            .join(
                SQL.join(Group.table)
                    .where(SQL.column('id'), SQL.parentColumn('groupId')),
            )
            .where('periodId', organization.periodId)
            .where('deactivatedAt', null)
            .where('registeredAt', '!=', null)
            .where(SQL.column(Group.table, 'deletedAt'), null)
            .where(SQL.column(Group.table, 'type'), '!=', GroupType.WaitingList)
            .count(
                SQL.distinct(SQL.column('memberId')),
            );
    }

    /**
     * Assures at least one company at all times
     */
    get defaultCompanies() {
        const b = this.meta.companies.length
            ? this.meta.companies
            : [
                    Company.create({
                        name: this.name,
                        address: this.address,
                    }),
                ];

        // Missing address -> use organization address
        if (!b[0].address) {
            b[0].address = this.address;
        }

        return b;
    }
}
