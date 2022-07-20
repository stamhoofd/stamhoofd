import { Database, Migration } from '@simonbackx/simple-database';
import { Decoder, ObjectData, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { Sodium } from '@stamhoofd/crypto';
import { EncryptedMemberDetails, MemberDetails, Version } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { Invite } from '../models/Invite';
import { Member } from '../models/Member';
import { Organization } from '../models/Organization';
import { User } from '../models/User';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    const invites = await Invite.where({
        permissions: {sign: '!=', value: null},
        receiverId: null
    })

    for (const invite of invites) {
        if (!invite.userDetails?.email) {
            console.log('SKIPPED', invite.id)
            continue;
        }
        const existing = await User.getForRegisterWithoutOrg(invite.organizationId, invite.userDetails.email)

        const admin = existing ?? new User();
        admin.organizationId = invite.organizationId;
        if (invite.userDetails.firstName && !admin.firstName) {
            admin.firstName = invite.userDetails.firstName;
        }
        if (invite.userDetails.lastName && !admin.lastName) {
            admin.lastName = invite.userDetails.lastName;
        }
        
        admin.email = invite.userDetails.email;

        // Merge permissions
        if (!invite.permissions) {
            continue;
        }

        if (existing && existing.permissions) {
            existing.permissions.add(invite.permissions);
        } else {
            admin.permissions = invite.permissions;
        }

        await admin.save();
        console.log('CREATED', admin.id)
    }

    throw new Error('WIP');
});


