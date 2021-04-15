import { ObjectData } from "@simonbackx/simple-encoding";

import { GroupGenderType } from "./GroupGenderType";
import { GroupSettings, WaitingListType } from "./GroupSettings";


describe("GroupSettings v73 → v75 upgrade", () => {


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
            waitingListType: WaitingListType.None,
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
