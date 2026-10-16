import { Database } from '@simonbackx/simple-database';
import { UserPermissions } from '@stamhoofd/structures';
import { Member } from '../models/Member.js';
import type { User } from '../models/User.js';

export class UserService {
    static async merge(user: User, other: User) {
        if (other.hasAccount()) {
            if (user.permissions && other.permissions) {
                user.permissions = UserPermissions.add(user.permissions, other.permissions);
            } else {
                if (!user.permissions && other.permissions) {
                    user.permissions = other.permissions;
                }
            }
            await user.save();

            if (other.firstName && !user.firstName) {
                user.firstName = other.firstName;
            }

            if (other.lastName && !user.lastName) {
                user.lastName = other.lastName;
            }
        }

        // Migrate members before deleting the placeholder account.
        const members = await Member.getMembersWithRegistrationForUser(other);

        if (members.length > 0) {
            const existingMembers = await Member.getMembersWithRegistrationForUser(user);
            const addMembers = members.filter(m => !existingMembers.find(ee => ee.id === m.id));

            if (addMembers.length) {
                console.log('Moving members from user ' + other.id + ' to ' + user.id);
                await Member.users.reverse('members').link(user, addMembers);
            }
        }

        const query = 'UPDATE balance_items SET userId = ? WHERE userId = ?';
        await Database.update(query, [user.id, other.id]);

        const query2 = 'UPDATE payments SET payingUserId = ? WHERE payingUserId = ?';
        await Database.update(query2, [user.id, other.id]);

        const query3 = 'UPDATE webshop_orders SET userId = ? WHERE userId = ?';
        await Database.update(query3, [user.id, other.id]);

        await Database.update('UPDATE emails SET userId = ? WHERE userId = ?', [user.id, other.id]);

        await Database.update('UPDATE email_recipients SET userId = ? WHERE userId = ?', [user.id, other.id]);

        const queries = [
            'UPDATE event_notifications SET createdBy = ? WHERE createdBy = ?',
            'UPDATE event_notifications SET submittedBy = ? WHERE submittedBy = ?',
            'UPDATE audit_logs SET userId = ? WHERE userId = ?',

        ];
        for (const q of queries) {
            await Database.update(q, [user.id, other.id]);
        }

        await other.delete();
    }
}
