import { Factory } from "@simonbackx/simple-database";
import { VersionBox } from '@simonbackx/simple-encoding';
import { Sodium } from '@stamhoofd/crypto';
import { EncryptedMemberDetails, Gender, MemberDetails, MemberDetailsMeta, ParentType, Record, RecordType, RecordTypeHelper, RecordTypePriority, Version } from '@stamhoofd/structures';

import { KeychainItem } from '../models/KeychainItem';
import { Member } from "../models/Member";
import { Organization } from "../models/Organization";
import { UserWithOrganization } from "../models/User";
import { EmergencyContactFactory } from './EmergencyContactFactory';
import { OrganizationFactory } from './OrganizationFactory';
import { ParentFactory } from './ParentFactory';
import { RecordFactory } from './RecordFactory';

class Options {
    organization?: Organization;
    user?: UserWithOrganization;

    /// In order to add something to the keychain, we need the private key of the user (since everything needs to be signed)
    userPrivateKey?: string;

    minAge?: number
    maxAge?: number
}

export class MemberFactory extends Factory<Options, Member> {
    async create(): Promise<Member> {
        const organization = this.options.organization
            ?? this.options.user?.organization
            ?? await new OrganizationFactory({}).create()

        const memberKeyPair = await Sodium.generateEncryptionKeyPair();

        const memberDetails = new MemberDetails()
        const minAge = (this.options.minAge ?? 6)
        const maxAge = this.options.maxAge ?? 18

        memberDetails.gender = Math.random() >= 0.05 ? (Math.random() >= 0.5 ? Gender.Male : Gender.Female) : Gender.Other;
        memberDetails.firstName = this.randomFirstName(memberDetails.gender);
        memberDetails.birthDay = new Date(
            new Date().getFullYear() -
            (minAge + Math.floor(Math.random() * (maxAge - minAge + 1))),
            Math.floor(Math.random() * 12), // 11 = 12
            Math.floor(Math.random() * 31)
        );

        // For now only generate -18
        memberDetails.address = null;

        if (memberDetails.age! >= 14) {
            memberDetails.phone =
                "+32 47" +
                Math.floor(Math.random() * 10) +
                " " +
                Math.floor(Math.random() * 10) +
                Math.floor(Math.random() * 10) +
                " " +
                Math.floor(Math.random() * 10) +
                Math.floor(Math.random() * 10) +
                " " +
                Math.floor(Math.random() * 10) +
                Math.floor(Math.random() * 10);
        }

        let parentFactory = new ParentFactory({});

        memberDetails.parents.push(await parentFactory.create());

        // 80% chance to have 2 parents if not guardian
        if (Math.random() >= 0.2 && memberDetails.parents[0].type != ParentType.Other) {
            // 90% chance to have parents of different gender
            parentFactory = new ParentFactory({
                type:
                    Math.random() >= 0.2
                        ? memberDetails.parents[0].type == ParentType.Mother
                            ? ParentType.Father
                            : ParentType.Mother
                        : undefined,
            });

            memberDetails.parents.push(await parentFactory.create());

            if (Math.random() >= 0.1) {
                // 10% chance to have divorced parents
                memberDetails.parents[1].address = memberDetails.parents[0].address;
            }

            if (Math.random() >= 0.5) {
                // 50% chance no e-mail
                memberDetails.parents[1].email = null;
            }
        }
        const recordFactory = new RecordFactory({});
        memberDetails.records = await recordFactory.createMultiple(Math.floor(Math.random() * 15 + 1));
        memberDetails.records.push(Record.create({ type: RecordType.DataPermissions }))
        // Remove duplicates    
        const unique = {};
        memberDetails.records.forEach(function (i) {
            if (!unique[i.type]) {
                unique[i.type] = i;
            }
        });
        memberDetails.records = Object.values(unique);
        
        memberDetails.records.sort((a, b) => {
            const pA = RecordTypeHelper.getPriority(a.type);
            const pB = RecordTypeHelper.getPriority(b.type);
            if (pA == pB) {
                if (a.getText() < b.getText()) {
                    return -1;
                }
                if (a.getText() > b.getText()) {
                    return 1;
                }
                return 0;
            }
            if (pA == RecordTypePriority.High && pB != RecordTypePriority.High) {
                return -1;
            }
            if (pB == RecordTypePriority.High && pA != RecordTypePriority.High) {
                return 1;
            }
            if (pA == RecordTypePriority.Medium && pB != RecordTypePriority.Medium) {
                return -1;
            }
            if (pB == RecordTypePriority.Medium && pA != RecordTypePriority.Medium) {
                return 1;
            }

            // Not possible
            throw new Error("Method records sorting failure")
        });

        // Sort

        if (memberDetails.parents.length == 2 && Math.random() >= 0.9) {
            memberDetails.lastName = memberDetails.parents[0].lastName + "-" + memberDetails.parents[1].lastName;
        } else {
            if (memberDetails.parents[0].type == ParentType.Father) {
                memberDetails.lastName = memberDetails.parents[0].lastName;
            } else if (memberDetails.parents[1] && memberDetails.parents[1].type == ParentType.Father) {
                memberDetails.lastName = memberDetails.parents[1].lastName;
            } else {
                memberDetails.lastName = memberDetails.parents[0].lastName;
            }
        }

        const emergencyContactFactory = new EmergencyContactFactory({});
        memberDetails.emergencyContacts.push(await emergencyContactFactory.create());
        if (Math.random() >= 0.9) {
            memberDetails.emergencyContacts.push(await emergencyContactFactory.create());
        }

        memberDetails.doctor = await emergencyContactFactory.create();
        memberDetails.doctor.name = "Dr. " + memberDetails.doctor.name;

        const member = new Member()
        member.firstName = memberDetails.firstName
        member.organizationId = organization.id

        // Encrypt the details
        const data = JSON.stringify(new VersionBox(memberDetails).encode({ version: Version }))
        member.encryptedDetails.push(EncryptedMemberDetails.create({
            publicKey: memberKeyPair.publicKey,
            ciphertext: await Sodium.sealMessage(data, memberKeyPair.publicKey),
            forOrganization: false,
            authorId: "factory",
            meta: MemberDetailsMeta.createFor(memberDetails)
        }))

        member.encryptedDetails.push(EncryptedMemberDetails.create({
            publicKey: organization.publicKey,
            ciphertext: await Sodium.sealMessage(data, organization.publicKey),
            forOrganization: true,
            authorId: "factory",
            meta: MemberDetailsMeta.createFor(memberDetails)
        }))

        await member.save()

        // Give user access to the encrypted data
        if (this.options.user) {
            await Member.users.link(member, [this.options.user])
        }

        if (this.options.user && this.options.userPrivateKey && this.options.user.publicKey) {
            // Add the private key to the keychain for this user (if possible)
            const keychainItem = new KeychainItem()
            keychainItem.userId = this.options.user.id
            keychainItem.publicKey = memberKeyPair.publicKey
            keychainItem.encryptedPrivateKey = await Sodium.sealMessageAuthenticated(
                memberKeyPair.privateKey,
                this.options.user.publicKey,
                this.options.userPrivateKey
            )
            await keychainItem.save()
        }

        return member;
    }
}
