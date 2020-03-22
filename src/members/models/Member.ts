import { Gender } from './Gender';
import { Address } from './Address';
import { Model } from '../../database/classes/Model';
import { column } from '../../database/decorators/Column';
import { manyToOne } from '../../database/decorators/manyToOne';

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
    birthDay: Date | null = null;

    @column()
    addressId: number | null = null; // null = no address

    /// Relations
    @manyToOne("addressId")
    address: Address | null; // undefined = relation not loaded

    /*parents: Parent[] = [];
    emergencyContacts: EmergencyContact[] = [];
    records: Record[] = [];
    doctor: EmergencyContact | null = null;

    group: Group | null = null;*/


    @column()
    createdOn: Date = new Date();
}
