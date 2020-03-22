import { Gender } from './Gender';
import { Address } from './Address';
import { Model } from '../classes/Model';
import { column } from '../decorators/Column';
import { manyToOne } from '../decorators/manyToOne';

export class Member extends Model {
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
    birthDay: Date = new Date("1970-01-01");

    @column()
    address_id: number | null = null; // null = no address

    /// Relations
    @manyToOne("address_id")
    address: Address | null; // undefined = relation not loaded

    /*parents: Parent[] = [];
    emergencyContacts: EmergencyContact[] = [];
    records: Record[] = [];
    doctor: EmergencyContact | null = null;

    group: Group | null = null;*/

    @column()
    paid = false;

    @column()
    createdOn: Date = new Date("1970-01-01");
}
