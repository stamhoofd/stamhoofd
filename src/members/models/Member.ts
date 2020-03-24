import { Gender } from './Gender';
import { Address } from './Address';
import { Model } from '../../database/classes/Model';
import { column } from '../../database/decorators/Column';
import { Database } from '../../database/classes/Database';
import { ManyToOneRelation } from '../../database/classes/ManyToOneRelation';
import { ManyToManyRelation } from '../../database/classes/ManyToManyRelation';
import { Parent } from './Parent';

/// Loaded types
export type FullyLoadedMember = Member & { address: Address | null; parents: Parent[] }

export class Member extends Model {
    static table = "members"

    // Columns
    @column({ primary: true })
    id: number | null = null;

    @column()
    firstName: string;

    @column()
    lastName = "";

    @column()
    gender: Gender = Gender.Other;

    @column()
    phone: string | null = null;

    @column()
    mail: string | null = null;

    @column()
    birthDay: Date | null = null;

    @column({ foreignKey: Member.address })
    addressId: number | null = null; // null = no address

    // Relations
    static address = new ManyToOneRelation(Address, "address")
    static parents = new ManyToManyRelation(Member, Parent, "parents")

    // Methods
    static async getByID(id: number): Promise<FullyLoadedMember | undefined> {
        const [rows] = await Database.select(`
            SELECT * 
            FROM ${this.table} 
            ${Member.address.joinQuery("members", "addresses")}
            ${Member.parents.joinQuery("members", "parents")}
            WHERE members.${this.primaryKey} = ?
            LIMIT 1
        `, [id])

        if (rows.length == 0) {
            return undefined
        }

        // Read member + address from first row
        const member = this.fromRow(rows[0]['members'])

        if (!member) {
            return undefined
        }
        const address = Address.fromRow(rows[0]['addresses']) || null

        // Get parents from other rows
        const parents = rows.flatMap(row => {
            const parent = Parent.fromRow(row['parents'])
            if (parent) {
                return [parent]
            }
            return []
        })

        return member
            .setRelation(Member.address, address)
            .setManyRelation(Member.parents, parents)
    }


    /*parents: Parent[] = [];
    emergencyContacts: EmergencyContact[] = [];
    records: Record[] = [];
    doctor: EmergencyContact | null = null;

    group: Group | null = null;*/

    @column()
    createdOn: Date = new Date();


    logCountry(this: FullyLoadedMember) {
        console.log(this.address?.country ?? "unknown")
    }
}
