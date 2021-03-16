import { column, Migration } from '@simonbackx/simple-database';
import { EncryptedMemberDetails, MemberDetailsMeta } from '@stamhoofd/structures';
import { Member } from '../models/Member';

// We use a simple representation to make it possible to acces the old fields in a typesafe way
export class OldMember extends Member {
    @column({ type: "string", nullable: true })
    encryptedForOrganization: string | null = null;

    @column({ type: "string", nullable: true })
    encryptedForMember: string | null = null;

    @column({ type: "string", nullable: true  })
    publicKey: string | null = null;

    @column({ type: "string", nullable: true  })
    organizationPublicKey: string | null = null;
}

export default new Migration(async () => {
    if (process.env.NODE_ENV == "test") {
        console.log("skipped in tests")
        return;
    }

    let counter = 0;
    let members: OldMember[] | null = null

    while(members === null || members.length > 0) {
        members = await OldMember.where({
            publicKey: {
                sign: "!=",
                value: null
            }
        }, {
            limit: 100
        })

        for (const member of members) {
            counter++;
            if (counter%100 == 0) {
                console.log(`Migrating member ${counter}...`)
            }

            if (member.encryptedDetails.length !== 0) {
                throw new Error("Unexpected details filled in already!")
            }

            if (!member.publicKey) {
                throw new Error("publicKey not present")
            }

            console.log("Patching "+member.id)

            if (member.encryptedForMember !== null) {
                member.encryptedDetails.push(EncryptedMemberDetails.create({
                    publicKey: member.publicKey,
                    ciphertext: member.encryptedForMember,
                    byOrganization: true,
                    forOrganization: false,
                    authorId: "migration",
                    meta: MemberDetailsMeta.create({
                        date: new Date(),

                        // Not known, but most of the existing records
                        // will contain everything
                        hasMemberGeneral: true,
                        hasParents: true,
                        hasEmergency: true,
                        hasRecords: true
                    })
                }))
            }

            if (member.encryptedForOrganization !== null && member.organizationPublicKey !== null) {
                member.encryptedDetails.push(EncryptedMemberDetails.create({
                    publicKey: member.organizationPublicKey,
                    ciphertext: member.encryptedForOrganization,
                    byOrganization: true,
                    forOrganization: true,
                    authorId: "migration",
                    meta: MemberDetailsMeta.create({
                        date: new Date(),

                        // Not known, but most of the existing records
                        // will contain everything
                        hasMemberGeneral: true,
                        hasParents: true,
                        hasEmergency: true,
                        hasRecords: true
                    })
                }))
            }

            // Delete to update results
            member.publicKey = null
            await member.save()
        }
    }
});


