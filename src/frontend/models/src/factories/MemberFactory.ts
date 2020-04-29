import { Gender } from "../Gender";
import { Member } from "../Member";
import { ParentType } from "../ParentType";
import { RecordTypeHelper,RecordTypePriority } from "../RecordType";
import { EmergencyContactFactory } from "./EmergencyContactFactory";
import { Factory } from "./Factory";
import { ParentFactory } from "./ParentFactory";
import { RecordFactory } from "./RecordFactory";

export class MemberFactoryOptions {
    minAge = 6;
    maxAge = 18;
}

export class MemberFactory extends Factory<Member> {
    options: MemberFactoryOptions;

    constructor(options: MemberFactoryOptions) {
        super(options);
        this.options = options;
    }

    create(): Member {
        const member = new Member();
        member.id = Math.floor(Math.random() * 99999999999);

        member.paid = Math.random() >= 0.1;
        member.gender = Math.random() >= 0.05 ? (Math.random() >= 0.5 ? Gender.Male : Gender.Female) : Gender.Other;
        member.firstName = this.randomFirstName(member.gender);

        member.createdOn = new Date(new Date().getTime() - Math.floor(Math.random() * 24 * 60 * 60 * 31 * 2 * 1000));
        member.birthDay = new Date(
            new Date().getFullYear() -
                (this.options.minAge + Math.floor(Math.random() * (this.options.maxAge - this.options.minAge + 1))),
            Math.floor(Math.random() * 12), // 11 = 12
            Math.floor(Math.random() * 31)
        );

        // For now only generate -18
        member.address = null;

        if (member.age >= 14) {
            member.phone =
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

        let parentFactory = new ParentFactory({
            type: null,
        });

        member.parents.push(parentFactory.create());

        // 80% chance to have 2 parents if not guardian
        if (Math.random() >= 0.2 && member.parents[0].type != ParentType.Other) {
            // 90% chance to have parents of different gender
            parentFactory = new ParentFactory({
                type:
                    Math.random() >= 0.2
                        ? member.parents[0].type == ParentType.Mother
                            ? ParentType.Father
                            : ParentType.Mother
                        : null,
            });

            member.parents.push(parentFactory.create());

            if (Math.random() >= 0.1) {
                // 10% chance to have divorced parents
                member.parents[1].address = member.parents[0].address;
            }

            if (Math.random() >= 0.5) {
                // 50% chance no e-mail
                member.parents[1].mail = null;
            }
        }
        const recordFactory = new RecordFactory({});
        member.records = recordFactory.createMultiple(Math.floor(Math.random() * 15 + 1));

        // Remove duplicates
        const unique = {};
        member.records.forEach(function (i) {
            if (!unique[i.type]) {
                unique[i.type] = i;
            }
        });
        member.records = Object.values(unique);

        member.records = member.records.filter((i) => {
            return i.type != "NoData";
        });

        member.records.sort((a, b) => {
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

        if (member.parents.length == 2 && Math.random() >= 0.9) {
            member.lastName = member.parents[0].lastName + "-" + member.parents[1].lastName;
        } else {
            if (member.parents[0].type == ParentType.Father) {
                member.lastName = member.parents[0].lastName;
            } else if (member.parents[1] && member.parents[1].type == ParentType.Father) {
                member.lastName = member.parents[1].lastName;
            } else {
                member.lastName = member.parents[0].lastName;
            }
        }

        const emergencyContactFactory = new EmergencyContactFactory({});
        member.emergencyContacts.push(emergencyContactFactory.create());
        if (Math.random() >= 0.9) {
            member.emergencyContacts.push(emergencyContactFactory.create());
        }

        member.doctor = emergencyContactFactory.create();
        member.doctor.name = "Dr. " + member.doctor.name;
        return member;
    }
}
