import { column, Database, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { Category, Product, WebshopMetaData, WebshopPrivateMetaData, WebshopServerMetaData } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

import { Organization } from './Organization';


export class Webshop extends Model {
    static table = "webshops";

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ foreignKey: Webshop.organization, type: "string" })
    organizationId: string;
    
    // A custom domain name that is used to host the webshop application (should be unique)
    // E.g. webshop.scoutswetteren.be
    @column({ type: "string", nullable: true })
    domain: string | null = null;

    // If a domain is used, the optional suffix on that domain
    // E.g. webshop.scoutswetteren.be/wafelbak
    @column({ type: "string", nullable: true })
    domainUri: string | null = null;

    // Unique representation of this webshop from a string, that is used to provide the default domains
    // in org.stamhoofd.shop/name-of-webshop
    @column({ type: "string" })
    uri: string;

    /**
     * Public meta data
     */
    @column({ type: "json", decoder: WebshopMetaData })
    meta: WebshopMetaData = WebshopMetaData.create({})

    /**
     * Data only accessible by the owners / users with special permissions
     */
    @column({ type: "json", decoder: WebshopPrivateMetaData })
    privateMeta: WebshopPrivateMetaData = WebshopPrivateMetaData.create({})

    /**
     * Data only accessible by the server
     */
    @column({ type: "json", decoder: WebshopServerMetaData })
    serverMeta: WebshopServerMetaData = WebshopServerMetaData.create({})


    /**
     * Contains all the products
     */
    @column({ type: "json", decoder: new ArrayDecoder(Product) })
    products: Product[] = [];

    /**
     * Contains all the categories in the right order
     */
    @column({ type: "json", decoder: new ArrayDecoder(Category) })
    categories: Category[] = [];

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

    static organization = new ManyToOneRelation(Organization, "organization");

    // Methods
    static async getByURI(organizationId: string, uri: string): Promise<Webshop | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()} FROM ${this.table} WHERE \`organizationId\` = ? AND \`uri\` = ? LIMIT 1`,
            [organizationId, uri]
        );

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        return this.fromRow(rows[0][this.table]);
    }

    // Methods
    static async getByDomain(host: string, uri: string | null): Promise<Webshop | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()} FROM ${this.table} WHERE \`domain\` = ? AND \`uri\` = ? LIMIT 1`,
            [host, uri]
        );

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        return this.fromRow(rows[0][this.table]);
    }

    // Return the location of the webshop
    getHost(this: Webshop & { organization: Organization }) {
        if (this.domain) {
            if (this.domainUri) {
                return this.domain+"/"+this.domainUri
            }
            return this.domain
        }

        return this.organization.uri+"."+process.env.WEBSHOP_HOSTNAME+"/"+this.uri
    }

 
}
