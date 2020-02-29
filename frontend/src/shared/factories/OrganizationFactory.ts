import { Organization } from "../models/Organization";
import { MemberFactory } from "./MemberFactory";
import { AddressFactory } from "./AddressFactory";
import { Gender } from "../models/Gender";
import { Factory } from "./Factory";
import { ParentType } from "../models/ParentType";
import { EmergencyContactFactory } from "./EmergencyContactFactory";
import { Group } from "../models/Group";

export interface OrganizationFactoryOptions {
    type: string | null;
}

export class OrganizationFactory extends Factory<Organization> {
    options: OrganizationFactoryOptions;

    constructor(options: OrganizationFactoryOptions) {
        super(options);
        this.options = options;
    }

    create(): Organization {
        var organization = new Organization();
        organization.id = Math.floor(Math.random() * 99999999999);

        var groupNames = [];
        switch (this.options.type) {
            case "scouts":
                groupNames = [
                    { name: "Kapoenen", options: { minAge: 6, maxAge: 8 } },
                    { name: "Wouters", options: { minAge: 6, maxAge: 8 } },
                    { name: "Welpen", options: { minAge: 6, maxAge: 8 } },
                    { name: "Jonggidsen", options: { minAge: 6, maxAge: 8 } },
                    { name: "Gidsen", options: { minAge: 6, maxAge: 8 } },
                    { name: "Verkenners", options: { minAge: 6, maxAge: 8 } },
                    { name: "Jin", options: { minAge: 6, maxAge: 8 } },
                    { name: "Akabe", options: { minAge: 6, maxAge: 8 } }
                ];
                break;
            case "chiro":
                groupNames = [
                    { name: "Kapoenen", options: { minAge: 6, maxAge: 8 } },
                    { name: "Wouters", options: { minAge: 6, maxAge: 8 } },
                    { name: "Welpen", options: { minAge: 6, maxAge: 8 } },
                    { name: "Jonggidsen", options: { minAge: 6, maxAge: 8 } },
                    { name: "Gidsen", options: { minAge: 6, maxAge: 8 } },
                    { name: "Verkenners", options: { minAge: 6, maxAge: 8 } },
                    { name: "Jin", options: { minAge: 6, maxAge: 8 } },
                    { name: "Akabe", options: { minAge: 6, maxAge: 8 } }
                ];
                break;
            default:
                throw new Error("Type not supported: " + this.options.type);
        }

        organization.groups = [];
        groupNames.forEach(details => {
            var group = new Group();
            group.name = details.name;
            group.id = Math.floor(Math.random() * 99999999999);
            var factory = new MemberFactory(details.options);
            group.members = factory.createMultiple(50);
            organization.groups.push(group);
        });

        return organization;
    }
}
