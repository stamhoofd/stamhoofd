import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';

export class MemberUser extends QueryableModel {
    static table = '_members_users';

    // Columns
    @column({
        primary: true, type: 'integer',
    })
    id!: number;

    @column({ type: 'string' })
    membersId: string;

    @column({ type: 'string' })
    usersId: string;
}
