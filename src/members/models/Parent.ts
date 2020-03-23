import { Model } from '../../database/classes/Model';
import { column } from '../../database/decorators/Column';
import { Address } from './Address';
import { ManyToOneRelation } from '../../database/classes/ManyToOneRelation';

export class Parent extends Model {
    static table = "parents"

    @column({ primary: true })
    id: number | null = null;

    @column()
    firstName: string;

    @column()
    lastName = "";

    @column()
    phone: string | null = null;

    @column()
    mail: string | null = null;

    @column({ foreignKey: Parent.address })
    addressId: number | null = null; // null = no address

    static address = new ManyToOneRelation(Address, "address").optional()
}
