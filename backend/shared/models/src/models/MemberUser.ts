import { column } from '@stamhoofd/node-database';
import { QueryableModel } from '@stamhoofd/node-sql';

export class MemberUser extends QueryableModel {
    static table = '_members_users';

    // Columns
    @column({
        primary: true,
        type: 'integer',
    })
    id!: number;

    @column({ type: 'string' })
    membersId: string;

    @column({ type: 'string' })
    usersId: string;
}
