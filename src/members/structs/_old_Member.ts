import { Dictionary } from "../../classes/struct-builder/Dictionary";
import { String } from "../../classes/struct-builder/String";
import { Number } from "../../classes/struct-builder/Number";
import { Array } from "../../classes/struct-builder/Array";
import { VersionedDictionary } from '../../classes/struct-builder/VersionedDictionary';

export { String };
export const address = new Dictionary("Address", {
    name: new String(),
});

export const member = new Dictionary("Member", {
    id: new Number(),
    firstName: new String(),
    lastName: new String(),
    gender: new String(),
    phone: new String(),
    mail: new String(),
    birthDay: new String(),
    addressId: new Number(),
});

export const memberDetailed = member.add({
    address: address
});

/*
member.addVersion(
    member.last
        .remove(["name"])
        .add({
            firstName: new String(),
            lastName: new String(),
        })
);
*/
/*
export const MemberV2 = Dictionary("Member", {
    firstName: String,
    lastName: String,
    phone: Field
});

export const Member = Combined(MemberV1, MemberV2);*/