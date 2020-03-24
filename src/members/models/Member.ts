import { Gender } from './Gender';
import { Address } from './Address';
import { Model } from '../../database/classes/Model';
import { column } from '../../database/decorators/Column';
import { Database } from '../../database/classes/Database';
import { ManyToOneRelation } from '../../database/classes/ManyToOneRelation';

/// Loaded types
export type FullyLoadedMember = Member & { address: Address }

export class Member extends Model {
    static table = "members"

    // All columns
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
    static address = new ManyToOneRelation(Address, "address")

    static async getByID(id: number): Promise<FullyLoadedMember | undefined> {
        const [[row]] = await Database.select(`
            SELECT * 
            FROM ${this.table} as m 
            LEFT JOIN ${Member.address.model.table} as a on a.${Member.address.model.primaryKey} = m.${Member.address.foreignKey}
            WHERE m.${this.primaryKey} = ?
            LIMIT 1
        `, [id])

        if (!row) {
            return undefined
        }

        console.log(row)
        const member = this.fromRow(row['m'])
        const address = Address.fromRow(row['a'])
        member["address"] = address

        // Set relation
        return member as any
    }


    /*parents: Parent[] = [];
    emergencyContacts: EmergencyContact[] = [];
    records: Record[] = [];
    doctor: EmergencyContact | null = null;

    group: Group | null = null;*/

    @column()
    createdOn: Date = new Date();


    logCountry(this: FullyLoadedMember) {
        console.log(this.address.country)
    }
}
