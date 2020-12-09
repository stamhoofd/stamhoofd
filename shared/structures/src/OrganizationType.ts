export enum OrganizationType {
    Youth = "Youth",
    Football = "Football",
    Tennis = "Tennis",
    Golf = "Golf",
    Athletics = "Athletics",
    Badminton = "Badminton",
    Hockey = "Hockey",
    Cycling = "Cycling",
    Swimming = "Swimming",
    Dance = "Dance",
    Volleyball = "Volleyball",
    Basketball = "Basketball",
    Judo = "Judo",
    Sport = "Sport",
    Student = "Student",
    HorseRiding = "HorseRiding",
    Neighborhood = "Neighborhood",
    Nature = "Nature",
    Music = "Music",
    Professional = "Professional",
    Art = "Art",
    Other = "Other",
}

export class OrganizationTypeHelper {
    static getList() {
        return [
            {
                value: OrganizationType.Youth,
                name: "Jeugdbeweging",
            },
            {
                value: OrganizationType.Football,
                name: "Voetbal",
            },
            {
                value: OrganizationType.Tennis,
                name: "Tennis",
            },
            {
                value: OrganizationType.Golf,
                name: "Golf",
            },
            {
                value: OrganizationType.Athletics,
                name: "Atletiek",
            },
            {
                value: OrganizationType.Badminton,
                name: "Badminton",
            },
            {
                value: OrganizationType.Hockey,
                name: "Hockey",
            },
            {
                value: OrganizationType.Cycling,
                name: "Wielrennen",
            },
            {
                value: OrganizationType.Swimming,
                name: "Zwemmen",
            },
            {
                value: OrganizationType.Dance,
                name: "Dans",
            },
            {
                value: OrganizationType.Volleyball,
                name: "Volleybal",
            },
            {
                value: OrganizationType.Basketball,
                name: "Basketbal",
            },
            {
                value: OrganizationType.Judo,
                name: "Judo",
            },
            {
                value: OrganizationType.Sport,
                name: "Andere sport",
            },
            {
                value: OrganizationType.Student,
                name: "Studentenvereniging",
            },
            {
                value: OrganizationType.HorseRiding,
                name: "Paardensport",
            },
            {
                value: OrganizationType.Neighborhood,
                name: "Buurtvereniging",
            },
            {
                value: OrganizationType.Nature,
                name: "Natuurvereniging",
            },
            {
                value: OrganizationType.Music,
                name: "Muziekvereniging",
            },
            {
                value: OrganizationType.Professional,
                name: "Beroepsvereniging",
            },
            {
                value: OrganizationType.Art,
                name: "Kunstvereniging",
            },
            {
                value: OrganizationType.Other,
                name: "Andere",
            },
        ]
    }
}