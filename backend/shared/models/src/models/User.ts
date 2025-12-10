import { column, Database, ManyToOneRelation } from '@simonbackx/simple-database';
import { EmailInterfaceRecipient } from '@stamhoofd/email';
import { QueryableModel, SQL, SQLJSONNull } from '@stamhoofd/sql';
import { LoginProviderType, NewUser, Permissions, Recipient, Replacement, UserMeta, UserPermissions, User as UserStruct } from '@stamhoofd/structures';
import argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';

import { SimpleError } from '@simonbackx/simple-errors';
import { QueueHandler } from '@stamhoofd/queues';
import { Organization } from './index.js';

export class User extends QueryableModel {
    static table = 'users';

    // Columns
    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ foreignKey: User.organization, type: 'string', nullable: true })
    organizationId: string | null;

    @column({ type: 'string', nullable: true })
    memberId: string | null = null;

    @column({ type: 'string', nullable: true })
    firstName: string | null = null;

    @column({ type: 'string', nullable: true })
    lastName: string | null = null;

    @column({ type: 'string' })
    email: string;

    @column({ type: 'string', nullable: true })
    password: string | null = null;

    @column({ type: 'boolean' })
    verified = false;

    @column({ type: 'json', decoder: UserPermissions, nullable: true })
    permissions: UserPermissions | null = null;

    /**
     * @deprecated
     * use permissions
     */
    @column({ type: 'json', decoder: Permissions, nullable: true })
    organizationPermissions: Permissions | null = null;

    @column({ type: 'json', decoder: UserMeta, nullable: true })
    meta: UserMeta | null = null;

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

    static organization = new ManyToOneRelation(Organization, 'organization');

    get name() {
        if (this.firstName && this.lastName) {
            return this.firstName + ' ' + this.lastName;
        }

        if (this.firstName) {
            return this.firstName;
        }

        if (this.lastName) {
            return this.lastName;
        }

        return null;
    }

    createRecipient(...replacements: Replacement[]) {
        return Recipient.create({
            firstName: this.firstName,
            lastName: this.lastName,
            email: this.email,
            replacements: [
                ...replacements,
                Replacement.create({
                    token: 'firstName',
                    value: this.firstName ?? '',
                }),
                Replacement.create({
                    token: 'lastName',
                    value: this.lastName ?? '',
                }),
                Replacement.create({
                    token: 'email',
                    value: this.email,
                }),
            ],
        });
    }

    static async getPlatformAdmins(options?: { verified?: boolean }) {
        // Custom implementation
        const q = User.select()
            .where('organizationId', null)
            .where('permissions', '!=', null)
            .where(
                SQL.jsonExtract(SQL.column('permissions'), '$.value.globalPermissions'),
                '!=',
                SQLJSONNull,
            )
            .where('id', '!=', '1');

        if (options?.verified !== undefined) {
            q.where('verified', options.verified);
        }

        let global = await q.fetch();

        // Hide api accounts
        global = global.filter(a => !a.isApiUser);

        return global;
    }

    static async getAdmins(organizationId: string, options?: { verified?: boolean }) {
        if (STAMHOOFD.userMode === 'platform') {
            // Custom implementation
            const q = User.select()
                .where('organizationId', null)
                .where('permissions', '!=', null)
                .where(
                    SQL.jsonExtract(
                        SQL.jsonExtract(SQL.column('permissions'), '$.value.organizationPermissions'),
                        '$."' + organizationId + '"',
                        true,
                    ),
                    '!=',
                    null,
                )
            ;

            if (options?.verified !== undefined) {
                q.where('verified', options.verified);
            }

            let global = await q.fetch();

            // Hide api accounts
            global = global.filter(a => !a.isApiUser);

            return global;
        }

        const q = User.select()
            .where('organizationId', organizationId)
            .where('permissions', '!=', null)
        ;

        if (options?.verified !== undefined) {
            q.where('verified', options.verified);
        }

        let global = await q.fetch();

        // Hide api accounts
        global = global.filter(a => !a.isApiUser);

        return global;
    }

    static async getApiUsers(organizationIds: string[]) {
        return organizationIds.length > 0 ? (await User.where({ permissions: { sign: '!=', value: null }, organizationId: { sign: 'IN', value: organizationIds } })).filter(a => a.isApiUser) : [];
    }

    async merge(other: User) {
        if (other.hasAccount()) {
            // We are going to merge accounts!
            if (this.organizationPermissions && other.organizationPermissions) {
                this.organizationPermissions.add(other.organizationPermissions);
            }
            else {
                if (!this.organizationPermissions && other.organizationPermissions) {
                    this.organizationPermissions = other.organizationPermissions;
                }
            }
            await this.save();

            if (other.firstName && !this.firstName) {
                this.firstName = other.firstName;
            }

            if (other.lastName && !this.lastName) {
                this.lastName = other.lastName;
            }
        }

        const Member = (await import('./Member.js')).Member;

        // Delete placeholder account, but migrate members first
        const members = await Member.getMembersWithRegistrationForUser(other);

        if (members.length > 0) {
            console.log('Moving members from user ' + other.id + ' to ' + this.id);
            await Member.users.reverse('members').link(this, members);
        }

        // Update balance items
        const query = 'UPDATE balance_items SET userId = ? WHERE userId = ?';
        await Database.update(query, [this.id, other.id]);

        // Update payments
        const query2 = 'UPDATE payments SET payingUserId = ? WHERE payingUserId = ?';
        await Database.update(query2, [this.id, other.id]);

        // Update orders
        const query3 = 'UPDATE webshop_orders SET userId = ? WHERE userId = ?';
        await Database.update(query3, [this.id, other.id]);

        // Update emails
        await Database.update('UPDATE emails SET userId = ? WHERE userId = ?', [this.id, other.id]);

        // Update email recipients
        await Database.update('UPDATE email_recipients SET userId = ? WHERE userId = ?', [this.id, other.id]);

        await other.delete();
    }

    static async login(organizationId: string | null, email: string, password: string): Promise<User | undefined> {
        const user = await User.getForAuthentication(organizationId, email);
        if (!user || !user.hasKeys() || user.isApiUser) {
            return undefined;
        }

        if (STAMHOOFD.environment === 'development') {
            if (password === 'stamhoofd') {
                return user;
            }
        }

        if (!user.password) {
            console.log('Tried to login to a user without password', email);
            return;
        }

        try {
            if (await argon2.verify(user.password, password)) {
                return user;
            }
        }
        catch (e) {
            // internal failure
            console.error(e);
        }
    }

    /// Delete users when we delete a member
    static async deleteForDeletedMember(memberId: string) {
        const [rows] = await Database.delete(`DELETE ${this.table} FROM ${this.table} JOIN _members_users a ON a.usersId = ${this.table}.id LEFT JOIN _members_users b ON b.usersId = ${this.table}.id AND b.membersId != a.membersId WHERE a.membersId = ? and b.membersId is null and users.permissions is null`, [memberId]);
        return rows;
    }

    hasPasswordBasedAccount() {
        if (this.password) {
            return true;
        }

        return false;
    }

    get isApiUser() {
        return !this.email.includes('@') && this.email.endsWith('.api') && this.verified;
    }

    get isSystemUser() {
        return this.id === '1';
    }

    hasAccount() {
        if (this.hasPasswordBasedAccount()) {
            return true;
        }
        if ((this.meta?.loginProviderIds?.size ?? 0) > 0) {
            return true;
        }
        if (this.isApiUser) {
            return true;
        }
        return false;
    }

    protected hasKeys() {
        if (this.password) {
            // Users with a password are 'real' users. Always.
            return true;
        }

        return false;
    }

    static async getForRegister(organizationId: string | null, email: string): Promise<User | undefined> {
        return await this.getForAuthentication(organizationId, email, { allowWithoutAccount: true });
    }

    static async getOrganizationLevelUser(organizationId: string, email: string): Promise<User | undefined> {
        const users = await User.where({
            email,
            organizationId: organizationId,
        }, {
            limit: 1,
        });

        if (users.length == 0) {
            return undefined;
        }
        const user = users[0];

        if (!user) {
            return undefined;
        }

        return user;
    }

    static async getForAuthentication(organizationId: string | null, email: string, { allowWithoutAccount = false }: { allowWithoutAccount?: boolean } = {}): Promise<User | undefined> {
        const users = await User.where({
            email,
            organizationId: STAMHOOFD.userMode === 'platform' ? null : organizationId,
        }, {
            limit: 1,
        });

        if (users.length == 0) {
            if (organizationId && STAMHOOFD.userMode === 'organization') {
                return this.getForAuthentication(null, email, { allowWithoutAccount });
            }
            return undefined;
        }
        const user = users[0];

        if (!user || (!user.hasKeys() && !allowWithoutAccount)) {
            if (organizationId && STAMHOOFD.userMode === 'organization') {
                return this.getForAuthentication(null, email, { allowWithoutAccount });
            }
            return undefined;
        }

        // Read member + address from first row
        return user;
    }

    static async hash(password: string) {
        const hash = await argon2.hash(password, { type: argon2.argon2id });
        return hash;
    }

    static async createInvited(
        organization: Organization | null,
        data: { firstName: string | null; lastName: string | null; email: string; allowPlatform?: boolean },
    ): Promise<User | undefined> {
        const {
            email,
            firstName,
            lastName,
        } = data;

        if (!organization && STAMHOOFD.userMode !== 'platform' && !data.allowPlatform) {
            throw new Error('Missing organization');
        }

        const user = new User();
        user.organizationId = STAMHOOFD.userMode === 'platform' ? null : (organization?.id ?? null);
        user.id = uuidv4();
        user.email = email;
        user.verified = false;
        user.firstName = firstName;
        user.lastName = lastName;

        try {
            await user.save();
        }
        catch (e) {
            // Duplicate key probably
            if (e.code && e.code == 'ER_DUP_ENTRY') {
                return;
            }
            throw e;
        }

        return user;
    }

    static async register(
        organization: Organization | null,
        data: NewUser,
        options?: { allowPlatform?: boolean },
    ): Promise<User | undefined> {
        const {
            email,
            password,
            id,
            firstName,
            lastName,
        } = data;

        if (!password) {
            throw new Error('A password is required for new users');
        }

        if (!organization && STAMHOOFD.userMode !== 'platform' && !options?.allowPlatform) {
            throw new Error('Missing organization');
        }

        if (await User.getForAuthentication(organization?.id ?? null, email, { allowWithoutAccount: true })) {
            // Already exists
            return;
        }

        const user = new User();
        user.organizationId = STAMHOOFD.userMode === 'platform' ? null : (organization?.id ?? null);
        user.id = id ?? uuidv4();
        user.email = email;
        user.password = await this.hash(password);
        user.verified = false;
        user.firstName = firstName;
        user.lastName = lastName;

        try {
            await user.save();
        }
        catch (e) {
            // Duplicate key probably
            if (e.code && e.code == 'ER_DUP_ENTRY') {
                return;
            }
            throw e;
        }

        return user;
    }

    linkLoginProvider(type: LoginProviderType, sub: string, allowAdditional = false) {
        if (!this.meta) {
            this.meta = UserMeta.create({});
        }
        const existingSub = this.meta.loginProviderIds.get(type);
        if (existingSub) {
            if (existingSub !== sub) {
                throw new SimpleError({
                    code: 'duplicate_login_provider',
                    message: 'This account is already linked to another account',
                    human: $t(`d4f1cb82-1e15-421a-8218-37cd3066436c`),
                    statusCode: 400,
                });
            }
        }
        else {
            if (this.hasAccount() && !allowAdditional) {
                // Do not allow this (security reasons - might need to work out a secure flow for this edge case)
                throw new SimpleError({
                    code: 'password_based_account',
                    message: 'This user uses a password to login. Log in with the password and link the external account through the settings.',
                    human: $t(`0154f68a-7458-4b87-91f2-5d04be0737fd`),
                    statusCode: 400,
                });
            }
        }

        this.meta.loginProviderIds.set(type, sub);
    }

    static async registerSSO(
        organization: Organization | null,
        data: { email; id; firstName; lastName; type: LoginProviderType; sub: string },
    ): Promise<User | undefined> {
        const {
            email,
            id,
            firstName,
            lastName,
        } = data;

        if (STAMHOOFD.userMode === 'platform') {
            if (organization) {
                throw new Error('Unexpected organization');
            }
        }
        else {
            if (!organization) {
                throw new Error('Missing organization');
            }
        }

        const user = new User();
        user.organizationId = organization?.id ?? null;
        user.id = id ?? uuidv4();
        user.email = email;
        user.verified = true;
        user.firstName = firstName;
        user.lastName = lastName;
        user.linkLoginProvider(data.type, data.sub);

        try {
            await user.save();
        }
        catch (e) {
            // Duplicate key probably
            if (e.code && e.code === 'ER_DUP_ENTRY') {
                return;
            }
            throw e;
        }

        return user;
    }

    async changePassword(password: string) {
        if (this.isSystemUser) {
            // Can't set password
            this.password = null;
            return;
        }
        this.password = await User.hash(password);
    }

    getStructure() {
        return UserStruct.create({
            firstName: this.firstName,
            lastName: this.lastName,
            id: this.id,
            email: this.email,
            verified: this.verified,
            permissions: this.permissions,
            hasAccount: this.hasAccount(),
            hasPassword: this.hasPasswordBasedAccount(),
            memberId: this.memberId,
            organizationId: this.organizationId,
        });
    }

    getEmailTo(): EmailInterfaceRecipient[] {
        return [
            {
                email: this.email,
                name: this.name,
            },
        ];
    }

    /**
     * Get internal system user that can be used on places that require a user object but the system is the actor
     */
    static async getSystem(): Promise<User> {
        return QueueHandler.schedule('User.getSystem', async () => {
            // Build a new one
            let model = await this.getByID('1');
            if (!model) {
                // Create a new platform
                model = new User();
                model.id = '1';
                model.firstName = 'System';
                model.email = 'webmaster@stamhoofd.be';
                model.verified = true;
                model.permissions = UserPermissions.create({
                    globalPermissions: Permissions.full,
                });
                model.organizationId = null;

                await model.save();
            }

            return model;
        });
    }
}
