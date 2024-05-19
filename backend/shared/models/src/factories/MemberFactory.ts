import { Factory } from "@simonbackx/simple-database";
import { Gender, MemberDetails, ParentType } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";

import { Member, MemberWithRegistrations } from "../models/Member";
import { Organization } from "../models/Organization";
import { User } from "../models/User";
import { EmergencyContactFactory } from './EmergencyContactFactory';
import { OrganizationFactory } from './OrganizationFactory';
import { ParentFactory } from './ParentFactory';

class Options {
    organization?: Organization;
    user?: User;

    /// In order to add something to the keychain, we need the private key of the user (since everything needs to be signed)
    userPrivateKey?: string;

    minAge?: number
    maxAge?: number
}

export class MemberFactory extends Factory<Options, MemberWithRegistrations> {
    async create(): Promise<MemberWithRegistrations> {
        const organization = this.options.organization
            ?? await new OrganizationFactory({}).create()

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
        }

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

        if (memberDetails.age! >= 16) {
            memberDetails.email = Formatter.slugEmail(memberDetails.firstName + "-" + memberDetails.lastName) + "@geen-email.com";
        }

        const emergencyContactFactory = new EmergencyContactFactory({});
        memberDetails.emergencyContacts.push(await emergencyContactFactory.create());
        if (Math.random() >= 0.9) {
            memberDetails.emergencyContacts.push(await emergencyContactFactory.create());
        }

        const member = new Member()
            .setManyRelation(Member.registrations, [])
            .setManyRelation(Member.users, this.options.user ? [this.options.user] : [])

        member.organizationId = organization.id
        member.details = memberDetails
        await member.save()

        // Give user access to the encrypted data
        if (this.options.user) {
            await Member.users.link(member, [this.options.user])
        }
        
        return member as any;
    }
}
