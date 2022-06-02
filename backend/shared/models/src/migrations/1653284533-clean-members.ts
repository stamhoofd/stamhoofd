import { Database, Migration } from '@simonbackx/simple-database';
import { Decoder, ObjectData, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { Sodium } from '@stamhoofd/crypto';
import { EncryptedMemberDetails, MemberDetails, Version } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { Member } from '../models/Member';
import { Organization } from '../models/Organization';
import { User } from '../models/User';

class Helper {
    static async getKeyPair(encrypted: EncryptedMemberDetails, organization: Organization) {
        if (encrypted.publicKey === organization.publicKey && organization.privateMeta.privateKey) {
            // We can use the stored key
            const keyPair = {
                publicKey: organization.publicKey,
                privateKey: organization.privateMeta.privateKey
            }
            return keyPair
        }
        throw new Error("Keychain item missing for this member")
    }

    static async decryptMemberDetails(encrypted: EncryptedMemberDetails, organization: Organization): Promise<MemberDetails> {
        const keyPair = await this.getKeyPair(encrypted, organization)
        const json = await Sodium.unsealMessage(encrypted.ciphertext, keyPair.publicKey, keyPair.privateKey)
        const data = new ObjectData(JSON.parse(json), { version: Version }); // version doesn't matter here
        const decoded = data.decode(new VersionBoxDecoder(MemberDetails as Decoder<MemberDetails>))
        const details = decoded.data
        const version = data.field("version").integer

        if (version < 128) {
            details.upgradeFromLegacy(organization.meta)
        }

        return details
    }

    static async decryptMember(member: Member, organization: Organization): Promise<MemberDetails> {
        // Get the newest complete blob where we have a key for
        const oldToNew = member.encryptedDetails.sort((a, b) => Sorter.byDateValue(b.meta.date, a.meta.date))

        let latest: MemberDetails | null = null
        let latestEncryptedDetails: EncryptedMemberDetails | null = null
        for (const encryptedDetails of oldToNew.slice().reverse()) {
            if (!encryptedDetails.meta.isRecovered) {
                // Do we have a key?
                if ((organization.privateMeta?.privateKey && encryptedDetails.publicKey === organization.publicKey) && encryptedDetails.ciphertext.length > 0) {
                    try {
                        latest = await this.decryptMemberDetails(encryptedDetails, organization)
                        latestEncryptedDetails = encryptedDetails
                        break
                    } catch (e) {
                        // Probably wrong key /reencrypted key in keychain: ignore it
                        console.error(e)
                    }
                }
            }
        }

        if (!latest) {
            // We don't have complete data.
            // Use the oldest available recovered blob and keep applying all the updates
            for (const encryptedDetails of oldToNew) {
                // Do we have a key?
                if ((organization.privateMeta?.privateKey && encryptedDetails.publicKey === organization.publicKey) && encryptedDetails.ciphertext.length > 0) {
                    try {
                        latest = await this.decryptMemberDetails(encryptedDetails, organization)
                        latestEncryptedDetails = encryptedDetails

                        // We need the oldest
                        break
                    } catch (e) {
                        // Probably wrong key /reencrypted key in keychain: ignore it
                        console.error(e)
                    }
                } else {
                    // Does it have public data?
                    if (encryptedDetails.publicData) {
                        latest = encryptedDetails.publicData
                        latestEncryptedDetails = encryptedDetails

                        if (!latest.firstName) {
                            // Autofill name
                            latest.firstName = member.firstName
                        }
                        break
                    }
                }
            }
        }

        if (!latest || !latestEncryptedDetails) {
            // todo: return placeholder
            const details = new MemberDetails()
            details.firstName = member.firstName

            // Mark as recovered details (prevents us from deleting the old encrypted blobs)
            details.isRecovered = true
            return details
        }

        const details = latest

        // Apply newer (incomplete blobs)
        // From old to new
        for (const encryptedDetails of oldToNew) {
            if (encryptedDetails.id !== latestEncryptedDetails.id && encryptedDetails.meta.isRecovered && latestEncryptedDetails.meta.date < encryptedDetails.meta.date) {
                if ((organization.privateMeta?.privateKey && encryptedDetails.publicKey === organization.publicKey) && encryptedDetails.ciphertext.length > 0) {
                    try {
                        const updates = await this.decryptMemberDetails(encryptedDetails, organization)
                        details.merge(updates)
                    } catch (e) {
                        // Probably wrong key /reencrypted key in keychain: ignore it
                        console.error(e)

                        if (encryptedDetails.publicData) {
                            // Merge the non-encrypted blob of data
                            details.merge(encryptedDetails.publicData)
                        }
                    }
                } else {
                    if (encryptedDetails.publicData) {
                        // Merge the non-encrypted blob of data
                        details.merge(encryptedDetails.publicData)
                    }
                }
            }
        }


        /*const mm = Member.create({ ...member, details })
        const meta = mm.getDetailsMeta()

        // Check if meta is wrong
        if (!meta || !meta.isAccurateFor(details)) {
            console.warn("Found inaccurate meta data!")
        }*/

        return details
    }

    static async getLastActiveDate(): Promise<Map<string, Date>> {
        // Count orders
        const query = "SELECT users.organizationId as organizationId, max(tokens.createdAt) as c from tokens join users on users.id = tokens.userId where users.permissions is not null group by users.organizationId"
        const [results] = await Database.select(query)
        const map = new Map<string, Date>()

        for (const result of results) {
            const date = result['']['c'];

            if (date instanceof Date) {
                map.set(result['users']['organizationId'], date)
            }
        }
        return map
    }
}


export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    const organizations = await Organization.all();

    // Delete members who didn't register and were updated at least one month ago
    const q = "DELETE FROM members WHERE updatedAt < ? AND members.id NOT IN (SELECT memberId FROM registrations)";
    const [result] = await Database.delete(q, [new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)]);
    console.log(`Deleted ${result.affectedRows} inactive members`);

    // Loop all organizations, and delete inactive ones
    const admins = await User.where({ permissions: { sign: "!=", value: null }})

    const start = new Date()
    start.setDate(start.getDate() - 60)

    const end = new Date()
    end.setDate(end.getDate() + 1)

    const dates = await Helper.getLastActiveDate()
    const deletedOrganizations = new Set<string>()

    for (const organization of organizations) {
        const lastActive = dates.get(organization.id) ?? null
        if (!lastActive || lastActive < new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 3)) {
            if (!organization.meta.packages.useActivities && !organization.meta.packages.useWebshops) {
                console.log(`Deleting organization ${organization.name} ${organization.id}, last active`, lastActive)
                //await organization.delete()
                deletedOrganizations.add(organization.id)
            }
            
        } else {
            console.log(`Keeping organization ${organization.name} ${organization.id}, last active`, lastActive)
        }
    }

    // Start to loop all members without public data
    let lastId = "";

    const stats = {
        ok: 0,
        fail: 0
    }
    const failedOrganizations: Map<string, Organization> = new Map()

    while(true) {
        const members = await Member.where({details: null, id: {sign: '>', value: lastId}}, {limit: 1000, sort: ["id"]});

        if (members.length == 0) {
            break;
        }


        for (const member of members) {
            if (deletedOrganizations.has(member.organizationId)) {
                continue
            }
            // try to decrypt
            const organization = organizations.find(o => o.id == member.organizationId)
            if (organization) {
                const details = await Helper.decryptMember(member, organization)
                if (details && !details.isRecovered) {
                    //console.log('OK  ', member.id, organization.id)
                    stats.ok++
                } else {
                    //console.log('FAIL', member.id)
                    stats.fail++
                    failedOrganizations.set(organization.id, organization)
                }
            }
        }
        lastId = members[members.length - 1].id
    }

    console.log(stats)

    // Log all failed organizations
    for (const [id, organization] of failedOrganizations) {
        console.log(`Failed to decrypt member data for ${organization.name} (${organization.id})`)
    }

    /*const organizations = await Organization.all();

    for (const organization of organizations) {
        const allGroups = await Group.getAll(organization.id)
        await organization.cleanCategories(allGroups)
        await Group.deleteUnreachable(organization.id, organization.meta, allGroups)
    }*/

    throw new Error("WIP");
});


