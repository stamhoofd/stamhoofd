import { Group } from "../Group";
import { Organization } from "../Organization";
import { Factory } from "./Factory";
import { MemberFactory } from "./MemberFactory";

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
        const organization = new Organization();
        organization.id = Math.floor(Math.random() * 99999999999);

        let groupNames: any = [];
        switch (this.options.type) {
            case "scouts":
                groupNames = [
                    {
                        name: "Kapoenen",
                        options: { maxMembers: 50, minMembers: 30 },
                        members: { minAge: 6, maxAge: 8 },
                    },
                    { name: "Wouters", options: { maxMembers: 50, minMembers: 30 }, members: { minAge: 6, maxAge: 8 } },
                    { name: "Welpen", options: { maxMembers: 50, minMembers: 30 }, members: { minAge: 6, maxAge: 8 } },
                    {
                        name: "Jonggidsen",
                        options: { maxMembers: 50, minMembers: 30 },
                        members: { minAge: 6, maxAge: 8 },
                    },
                    { name: "Gidsen", options: { maxMembers: 50, minMembers: 30 }, members: { minAge: 6, maxAge: 8 } },
                    {
                        name: "Verkenners",
                        options: { maxMembers: 50, minMembers: 30 },
                        members: { minAge: 6, maxAge: 8 },
                    },
                    { name: "Jin", options: { maxMembers: 50, minMembers: 30 }, members: { minAge: 6, maxAge: 8 } },
                    { name: "Akabe", options: { maxMembers: 50, minMembers: 30 }, members: { minAge: 6, maxAge: 8 } },
                ];
                break;
            case "chiro":
                groupNames = [
                    { name: "Ribbels", options: { maxMembers: 50, minMembers: 30 }, members: { minAge: 6, maxAge: 8 } },
                    {
                        name: "Speelclub",
                        options: { maxMembers: 50, minMembers: 30 },
                        members: { minAge: 8, maxAge: 10 },
                    },
                    {
                        name: "Rakwi's",
                        options: { maxMembers: 40, minMembers: 20 },
                        members: { minAge: 10, maxAge: 12 },
                    },
                    {
                        name: "Tito's",
                        options: { maxMembers: 30, minMembers: 15 },
                        members: { minAge: 12, maxAge: 14 },
                    },
                    {
                        name: "Keti's",
                        options: { maxMembers: 30, minMembers: 10 },
                        members: { minAge: 14, maxAge: 16 },
                    },
                    {
                        name: "Aspi's",
                        options: { maxMembers: 30, minMembers: 10 },
                        members: { minAge: 16, maxAge: 18 },
                    },
                ];
                break;
            default:
                throw new Error("Type not supported: " + this.options.type);
        }

        organization.groups = [];
        groupNames.forEach(details => {
            const group = new Group();
            group.name = details.name;
            group.id = Math.floor(Math.random() * 99999999999);
            const factory = new MemberFactory(details.members);
            group.members = factory.createMultiple(
                Math.floor(
                    1 +
                        details.options.minMembers +
                        Math.random() * (details.options.maxMembers - details.options.minMembers)
                )
            );
            group.members.forEach(member => {
                member.group = group;
            });
            organization.groups?.push(group);
        });

        return organization;
    }
}
