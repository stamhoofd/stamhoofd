import { column, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { WebshopMetaData, WebshopPrivateMetaData, WebshopServerMetaData } from '@stamhoofd/structures';
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
    // E.g. inschrijven.scoutswetteren.be
    @column({ type: "string", nullable: true })
    domain: string | null = null;

    // Unique representation of this organization from a string, that is used to provide the default domains
    // in uri.stamhoofd.be
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

 
}
