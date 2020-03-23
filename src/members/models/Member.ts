import { Gender } from './Gender';
import { Address } from './Address';
import { Model } from '../../database/classes/Model';
import { column } from '../../database/decorators/Column';
import { RelationLoaded } from '../../database/classes/Relation';
import { ManyToOneRelation } from '../../database/classes/ManyToOneRelation';
import { Parent } from './Parent';
import { ManyToManyRelation } from '../../database/classes/ManyToManyRelation';
import { RowInitiable } from '../../database/classes/Query';

const a = Address as RowInitiable<Address> & typeof Model

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

    /// Relations
    /*@manyToOne({ key: "addressId", model: Address })
    address: Address | null; // undefined = relation not loaded*/

    static address = new ManyToOneRelation(new Member(), new Address(), "address").optional()
    //static parents = new ManyToManyRelation(Parent, "parents", "member_parents")

    /*parents: Parent[] = [];
    emergencyContacts: EmergencyContact[] = [];
    records: Record[] = [];
    doctor: EmergencyContact | null = null;

    group: Group | null = null;*/


    @column()
    createdOn: Date = new Date();


    logCountry(this: Member & RelationLoaded<typeof Member.address>) {
        console.log(this.address?.country)
    }
}
