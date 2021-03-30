import { ObjectData } from "@simonbackx/simple-encoding";
import { GroupGenderType } from "./GroupGenderType";
import { GroupSettings, OldWaitingListType, WaitingListType } from "./GroupSettings";


describe("GroupSettings v73 → v75 upgrade", () => {

    it("should keep pre registration date", () => {
        const pre = new Date()
        const data = {
            name: "",
            description: "",
            startDate: new Date().getTime(),
            endDate: new Date().getTime(),
            registrationStartDate: new Date().getTime(),
            registrationEndDate: new Date().getTime(),
            prices: [],
            genderType: GroupGenderType.Mixed,
            minAge: null,
            maxAge: null,
            waitingListType: OldWaitingListType.PreRegistrations,
            preRegistrationsDate: pre.getTime(),
            maxMembers: 20,
            priorityForFamily: true,
            images: [],
            coverPhoto: null,
            squarePhoto: null,
        };

        const objectData = new ObjectData(data, { version: 73 })
        expect(objectData.decode(GroupSettings)).toMatchObject({
            preRegistrationsDate: pre,
            waitingListType: WaitingListType.Limit
        })
    });

    it("should remove unused pre registration date", () => {
        const pre = new Date()
        const data = {
            name: "",
            description: "",
            startDate: new Date().getTime(),
            endDate: new Date().getTime(),
            registrationStartDate: new Date().getTime(),
            registrationEndDate: new Date().getTime(),
            prices: [],
            genderType: GroupGenderType.Mixed,
            minAge: null,
            maxAge: null,
            waitingListType: OldWaitingListType.ExistingMembersFirst,
            preRegistrationsDate: pre.getTime(),
            maxMembers: 20,
            priorityForFamily: true,
            images: [],
            coverPhoto: null,
            squarePhoto: null,
        };

        const objectData = new ObjectData(data, { version: 73 })
        expect(objectData.decode(GroupSettings)).toMatchObject({
            preRegistrationsDate: null,
            waitingListType: WaitingListType.ExistingMembersFirst
        })
    });

    it("should remove max members if not used", () => {
        const pre = new Date()
        const data = {
            name: "",
            description: "",
            startDate: new Date().getTime(),
            endDate: new Date().getTime(),
            registrationStartDate: new Date().getTime(),
            registrationEndDate: new Date().getTime(),
            prices: [],
            genderType: GroupGenderType.Mixed,
            minAge: null,
            maxAge: null,
            waitingListType: OldWaitingListType.None,
            preRegistrationsDate: null,
            maxMembers: 20,
            priorityForFamily: true,
            images: [],
            coverPhoto: null,
            squarePhoto: null,
        };

        const objectData = new ObjectData(data, { version: 73 })
        expect(objectData.decode(GroupSettings)).toMatchObject({
            preRegistrationsDate: null,
            maxMembers: null,
            waitingListType: WaitingListType.None
        })
    });

    
});
