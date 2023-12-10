import { Worker } from 'node:worker_threads';

import { column, Database, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { EmailInterfaceRecipient } from "@stamhoofd/email";
import { QueueHandler } from "@stamhoofd/queues";
import { ApiUser,KeyConstants, LoginProviderType, NewUser, Organization as OrganizationStruct, Permissions, User as UserStruct, UserMeta, Version } from "@stamhoofd/structures";
import argon2 from "argon2";
import path from "path";
import { v4 as uuidv4 } from "uuid";

import { Organization, Token } from "./";

export type UserWithOrganization = User & { organization: Organization };
export type UserForAuthentication = User & { publicAuthSignKey: string; authSignKeyConstants: KeyConstants; authEncryptionKeyConstants: KeyConstants };
export type UserFull = User & { publicKey: string; publicAuthSignKey: string; authEncryptionKeyConstants: KeyConstants; authSignKeyConstants: KeyConstants; encryptedPrivateKey: string };

export class User extends Model {
    static table = "users";

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ foreignKey: User.organization, type: "string" })
    organizationId: string;

    @column({ type: "string", nullable: true })
    firstName: string | null = null;

    @column({ type: "string", nullable: true })
    lastName: string | null = null;

    @column({ type: "string" })
    email: string;

    @column({ type: "string", nullable: true })
    password: string | null = null;

    @column({ type: "boolean" })
    verified = false

    /**
     * Public key used for encryption
     */
    @column({ type: "json", decoder: Permissions, nullable: true })
    permissions: Permissions | null = null

    /**
     * Public key used for encryption
     */
    @column({ type: "json", decoder: UserMeta, nullable: true })
    meta: UserMeta | null = null

    /**
     * @deprecated
     * Public key used for encryption
     */
    @column({ type: "string", nullable: true })
    publicKey: string | null = null;

    /**
     * @deprecated
     * public key that is used to verify during login (using a challenge) and for getting a token
     * SHOULD NEVER BE PUBLIC!
     */
    @column({ type: "string", nullable: true })
    protected publicAuthSignKey?: string | null = null // if not selected will be undefined

    /**
     * @deprecated
     * Encrypted private key, used for authenticated encrytion and decryption
     */
    @column({ type: "string", nullable: true })
    protected encryptedPrivateKey: string | null = null // if not selected will be undefined

    /**
     * @deprecated
     * Constants that are used to get the authSignKeyPair from the user password. Using
     */
    @column({ type: "json", decoder: KeyConstants, nullable: true })
    protected authSignKeyConstants?: KeyConstants | null = null // if not selected will be undefined

    /**
     * @deprecated
     * Constants that are used to get the authEncryptionKey from the user password. Only accessible for the user using his token (= after login)
     */
    @column({ type: "json", decoder: KeyConstants, nullable: true })
    protected authEncryptionKeyConstants: KeyConstants | null = null // if not selected will be undefined

    @column({
        type: "datetime", beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date()
            date.setMilliseconds(0)
            return date
        }
    })
    createdAt: Date

    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        },
        skipUpdate: true
    })
    updatedAt: Date

    static organization = new ManyToOneRelation(Organization, "organization");

    get name() {
        if (this.firstName && this.lastName) {
            return this.firstName + " " + this.lastName;
        }

        if (this.firstName) {
            return this.firstName;
        }

        if (this.lastName) {
            return this.lastName;
        }

        return null;
    }

    async merge(other: User) {
        if (other.hasAccount()) {
            // We are going to merge accounts!
            if (this.permissions && other.permissions) {
                this.permissions.add(other.permissions);
            } else {
                if (!this.permissions && other.permissions) {
                    this.permissions = other.permissions;
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

        const Member = (await import("./Member")).Member

        // Delete placeholder account, but migrate members first
        const members = await Member.getMembersWithRegistrationForUser(other)

        if (members.length > 0) {
            console.log("Moving members from user "+other.id+" to "+this.id)
            await Member.users.reverse("members").link(this, members)
        }

        // Update balance items
        const query = "UPDATE balance_items SET userId = ? WHERE userId = ?"
        await Database.update(query, [this.id, other.id])

        // Update payments
        const query2 = "UPDATE payments SET userId = ? WHERE userId = ?"
        await Database.update(query2, [this.id, other.id])

        // Update orders
        const query3 = "UPDATE webshop_orders SET userId = ? WHERE userId = ?"
        await Database.update(query3, [this.id, other.id])

        await other.delete()
    }

    hasReadAccess(this: UserWithOrganization): this is { permissions: Permissions } {
        return this.permissions?.hasReadAccess(this.organization.privateMeta.roles) ?? false
    }

    hasWriteAccess(this: UserWithOrganization): this is { permissions: Permissions } {
        return this.permissions?.hasWriteAccess(this.organization.privateMeta.roles) ?? false
    }

    hasFullAccess(this: UserWithOrganization): this is { permissions: Permissions } {
        return this.permissions?.hasFullAccess(this.organization.privateMeta.roles) ?? false
    }

    static async checkOldPassword(email: string, password: string, keyConstants: KeyConstants, publicAuthSignKey: string): Promise<boolean> {
        return await QueueHandler.schedule('check-old-password', async () => {
            return new Promise((resolve) => {
                console.log('[WORKER] Logging in via the old E2E way...', email)

                let resolved = false;
                const worker = new Worker(path.join(__dirname, '../helpers/checkPasswordWorker.js'), { workerData: {email, password, publicAuthSignKey, keyConstants: keyConstants.encode({version: Version})} });
                const timer = setTimeout(() => {
                    console.log('[WORKER] Worker timed out after 20s for email', email)

                    if (resolved) {
                        return;
                    }
                    resolve(false);
                    resolved = true;
                    
                    worker.terminate().catch(console.error);
                }, 20 * 1000);
                
                worker.on('message', (m) => {
                    if (resolved) {
                        return;
                    }
                    clearTimeout(timer);
                    resolve(!!m);
                    resolved = true;
                });
                worker.on('error', (e) => {
                    console.error('[WORKER] Catched worker error', e)

                    if (resolved) {
                        return;
                    }
                    clearTimeout(timer);
                    resolve(false);
                    resolved = true;
                });
                worker.on('exit', (code) => {
                    if (code !== 0) {
                        console.error('[WORKER] Worker stopped with exit code', code);
                    }
                    if (resolved) {
                        return;
                    }
                    clearTimeout(timer);
                    resolve(false);
                    resolved = true;
                });
            })
        }, 3);
    }

    static async login(organizationId: string, email: string, password: string): Promise<UserForAuthentication | undefined> {
        const user = await User.getForAuthentication(organizationId, email)
        if (!user || !user.hasKeys() || user.isApiUser) {
            return undefined
        }

        if (STAMHOOFD.environment === 'development') {
            if (password === 'stamhoofd') {
                return user
            }
        }

        if (!user.password) {
            if (!user.authSignKeyConstants) {
                console.error('Tried to login to a user with no password or authSignKeyConstants');
                return undefined;
            }
            if (!user.publicAuthSignKey) {
                console.error('Tried to login to a user with no password or publicAuthSignKey');
                return undefined;
            }

            console.log('Preparing to log in via the old E2E way...', email)

            // Old e2e login system: we need to generate the keys locally to check if they match
            try {
                if (await this.checkOldPassword(email, password, user.authSignKeyConstants, user.publicAuthSignKey)) {
                    console.log('Login succeeded for', email, '. Updating password...')

                    await user.changePassword(password)
                    await user.save();
                    console.log('Successfully stored hashed password for', email)

                    return user
                }
                
                console.log('Login failed for', email)

            } catch (e) {
                console.error(e)
            }
            return
        }

        try {
            if (await argon2.verify(user.password, password)) {
                return user
            }
        } catch (e) {
            // internal failure
            console.error(e)
        }
    }

    /// Delete users when we delete a member
    static async deleteForDeletedMember(memberId: string) {
        const [rows] = await Database.delete(`DELETE ${this.table} FROM ${this.table} JOIN _members_users a ON a.usersId = ${this.table}.id LEFT JOIN _members_users b ON b.usersId = ${this.table}.id AND b.membersId != a.membersId WHERE a.membersId = ? and b.membersId is null and users.permissions is null`, [memberId]);
        return rows
    }

    /**
     * @param namespace
     * @override
     */
    static getDefaultSelect(namespace?: string): string {
        return this.selectColumnsWithout(namespace, "encryptedPrivateKey", "publicAuthSignKey", "authSignKeyConstants", "authEncryptionKeyConstants");
    }

    static async getFull(id: string): Promise<UserFull | undefined> {
        const [rows] = await Database.select(`SELECT * FROM ${this.table} WHERE \`id\` = ? LIMIT 1`, [id]);

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        const user = this.fromRow(rows[0][this.table]) 

        if (!user) {
            return undefined
        }
        
        return user as UserFull;
    }

    hasPasswordBasedAccount() {
        if (this.password) {
            return true;
        }
        
        if (this.publicKey === null) {
            // This is a placeholder user
            return false
        }
        return true
    }

    get isApiUser() {
        return !this.email.includes('@') && this.email.endsWith('.api') && this.verified
    }

    async toApiUserStruct() {
        const [lastToken] = await Token.where({
            userId: this.id
        }, {limit: 1})

        return ApiUser.create({
            id: this.id,
            name: this.name,
            permissions: this.permissions,
            expiresAt: lastToken?.accessTokenValidUntil ?? null,
            createdAt: this.createdAt,
        })
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
        return false
    }

    protected hasKeys() {
        if (this.password) {
            // Users with a password are 'real' users. Always.
            return true;
        }

        if (this.publicKey === null) {
            // This is a placeholder user

            return false
        }

        if (this.authSignKeyConstants === null) {
            console.error(this.id+": authSignKeyConstants is null")
            // This is a placeholder user
            return false
        }
        
        if (this.publicAuthSignKey === null) {
            console.error(this.id+": publicAuthSignKey is null")
            // This is a placeholder user
            return false
        }

        if (this.authEncryptionKeyConstants === null) {
            console.error(this.id+": authEncryptionKeyConstants is null")
            // This is a placeholder user
            return false
        }

        if (this.encryptedPrivateKey === null) {
            console.error(this.id+": encryptedPrivateKey is null")
            // This is a placeholder user
            return false
        }
        return true
    }

    static async getForRegister(organization: Organization, email: string): Promise<UserWithOrganization | undefined> {
        const user = await this.getForRegisterWithoutOrg(organization.id, email)

        if (!user) {
            return undefined
        }

        // Read member + address from first row
        return user.setRelation(User.organization, organization);
    }

    static async getForRegisterWithoutOrg(organizationId: string, email: string): Promise<User | undefined> {
        const [rows] = await Database.select(`SELECT * FROM ${this.table} WHERE \`email\` = ? AND organizationId = ? LIMIT 1`, [email, organizationId]);

        if (rows.length == 0) {
            return undefined;
        }
        const user = this.fromRow(rows[0][this.table])

        if (!user) {
            return undefined
        }

        return user;
    }

    static async getForAuthentication(organizationId: string, email: string): Promise<UserForAuthentication | undefined> {
        const [rows] = await Database.select(`SELECT * FROM ${this.table} WHERE \`email\` = ? AND organizationId = ? LIMIT 1`, [email, organizationId]);

        if (rows.length == 0) {
            return undefined;
        }
        const user = this.fromRow(rows[0][this.table])

        if (!user || !user.hasKeys()) {
            return undefined
        }

        // Read member + address from first row
        return user as UserForAuthentication;
    }

    static async hash(password: string) {
        const hash = await argon2.hash(password, { type: argon2.argon2id })
        return hash
    }

    static async register(
        organization: Organization,
        data: NewUser
    ): Promise<UserWithOrganization | undefined> {
        const {
            email,
            password,
            id,
            firstName,
            lastName
        } = data;

        if (!password) {
            throw new Error("A password is required for new users")
        }

        const user = new User().setRelation(User.organization, organization);
        user.id = id ?? uuidv4()
        user.email = email;
        user.password = await this.hash(password)
        user.verified = false;
        user.firstName = firstName
        user.lastName = lastName

        try {
            await user.save();
        } catch (e) {
            // Duplicate key probably
            if (e.code && e.code == "ER_DUP_ENTRY") {
                return;
            }
            throw e;
        }

        //user.eraseProperty('password');
        return user;
    }

    linkLoginProvider(type: LoginProviderType, sub: string) {
        if (!this.meta) {
            this.meta = UserMeta.create({})
        }
        this.meta.loginProviderIds.set(type, sub)
    }

    static async registerSSO(
        organization: Organization,
        data: {email, id, firstName, lastName, type: LoginProviderType, sub: string}
    ): Promise<UserWithOrganization | undefined> {
        const {
            email,
            id,
            firstName,
            lastName
        } = data;

        const user = new User().setRelation(User.organization, organization);
        user.id = id ?? uuidv4()
        user.email = email;
        user.verified = false;
        user.firstName = firstName
        user.lastName = lastName
        user.linkLoginProvider(data.type, data.sub)

        try {
            await user.save();
        } catch (e) {
            // Duplicate key probably
            if (e.code && e.code == "ER_DUP_ENTRY") {
                return;
            }
            throw e;
        }

        return user;
    }

    async changePassword(password: string) {
        this.password = await User.hash(password)

        // Clear old fields
        this.publicKey = null;
        this.publicAuthSignKey = null;
        this.encryptedPrivateKey = null;
        this.authSignKeyConstants = null;
        this.authEncryptionKeyConstants = null;
    }

    async getOrganizationStructure(this: UserWithOrganization): Promise<OrganizationStruct> {
        const organization = this.organization
        if (organization.id != this.organizationId) {
            throw new Error("Unexpected permission failure")
        }
        return this.permissions ? await organization.getPrivateStructure(this) : await organization.getStructure()
    }

    getStructure() {
        return UserStruct.create({
            firstName: this.firstName,
            lastName: this.lastName,
            id: this.id,
            email: this.email,
            verified: this.verified,
            permissions: this.permissions,
            hasAccount: this.hasAccount()
        });
    }

    getEmailTo(): EmailInterfaceRecipient[] {
        return [
           {
                email: this.email,
                name: this.name
            }
        ]
    }

}
