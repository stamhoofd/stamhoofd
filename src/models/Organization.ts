import { column, Database,Model } from "@simonbackx/simple-database";
import { SimpleError } from '@simonbackx/simple-errors';
import { Address, Group as GroupStruct, Organization as OrganizationStruct, OrganizationMetaData, OrganizationPrivateMetaData } from "@stamhoofd/structures";
import { v4 as uuidv4 } from "uuid";

import { OrganizationServerMetaData } from '../structures/OrganizationServerMetaData';
import { Group } from './Group';

export class Organization extends Model {
    static table = "organizations";

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    name: string;

    /// URL to a website page or a Facebook page (including http)
    @column({ type: "string", nullable: true })
    website: string | null = null;

    /// A custom domain name that is used to host the register application (should be unique)
    // E.g. inschrijven.scoutswetteren.be
    @column({ type: "string", nullable: true })
    registerDomain: string | null = null;

    // Unique representation of this organization from a string, that is used to provide the default domains
    // in uri.stamhoofd.be
    @column({ type: "string" })
    uri: string;

    /**
     * Public meta data
     */
    @column({ type: "json", decoder: OrganizationMetaData })
    meta: OrganizationMetaData;

    /**
     * Data only accessible by the owners / users with special permissions
     */
    @column({ type: "json", decoder: OrganizationPrivateMetaData })
    privateMeta: OrganizationPrivateMetaData = OrganizationPrivateMetaData.create({})

    /**
     * Data only accessible by the server
     */
    @column({ type: "json", decoder: OrganizationServerMetaData })
    serverMeta: OrganizationServerMetaData = OrganizationServerMetaData.create({})

    @column({ type: "json", decoder: Address })
    address: Address;

    @column({ type: "string" })
    publicKey: string;

    @column({
        type: "string", beforeSave: function (this: Organization) {
            return this.name+"\n"+this.address.toString()
        }
    })
    searchIndex: string

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
        }
    })
    updatedAt: Date

    // Methods
    static async getByURI(uri: string): Promise<Organization | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()} FROM ${this.table} WHERE \`uri\` = ? LIMIT 1`,
            [uri]
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
            [host]
        );

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        return this.fromRow(rows[0][this.table]);
    }

    /**
     * Get an Organization by looking at the host of a request
     * Format is 2331c59a-0cbe-4279-871c-ea9d0474cd54.api.stamhoofd.be
     */
    static async fromApiHost(host: string): Promise<Organization> {
        const splitted = host.split('.')
        if (splitted.length < 2) {
            throw new SimpleError({
                code: "invalid_host",
                message: "Please specify the organization in the hostname",
            });
        }
        const id = splitted[0]
        const organization = await this.getByID(id);
        if (!organization) {
            throw new SimpleError({
                code: "invalid_organization",
                message: "No organization known for host " + host,
            });
        }
        return organization;
    }

    getHost(): string {
        if (this.registerDomain) {
            return this.registerDomain;
        }
        return this.getDefaultHost()
    }

    getDefaultHost(): string {
        const defaultDomain = process.env.HOSTNAME;
        if (!defaultDomain) {
            throw new Error("Missing hostname in environment")
        }
        return this.uri + "." + defaultDomain;
    }

    getApiHost(): string {
        const defaultDomain = process.env.HOSTNAME;
        if (!defaultDomain) {
            throw new Error("Missing hostname in environment")
        }
        return this.id+".api." + defaultDomain;
    }

    async getStructure(): Promise<OrganizationStruct> {
        const groups = await Group.where({organizationId: this.id})
        return OrganizationStruct.create({
            id: this.id,
            name: this.name,
            meta: this.meta,
            address: this.address,
            publicKey: this.publicKey,
            registerDomain: this.registerDomain,
            uri: this.uri,
            website: this.website,
            groups: groups.map(g => GroupStruct.create(g)).sort(GroupStruct.defaultSort)
        })
    }

    async getPrivateStructure(): Promise<OrganizationStruct> {
        const groups = await Group.where({ organizationId: this.id })
        return OrganizationStruct.create({
            id: this.id,
            name: this.name,
            meta: this.meta,
            address: this.address,
            publicKey: this.publicKey,
            registerDomain: this.registerDomain,
            uri: this.uri,
            website: this.website,
            groups: groups.map(g => GroupStruct.create(g)).sort(GroupStruct.defaultSort),
            privateMeta: this.privateMeta
        })
    }
}
