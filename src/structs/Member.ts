import { Dictionary } from "../classes/structs/Dictionary";
import { String } from "../classes/structs/String";
import { Array } from "../classes/structs/Array";
import { VersionedDictionary } from '../classes/structs/VersionedDictionary';

export { String };
export const field = new Dictionary("Field", {
    firstName: new String(),
    lastName: new String(),
    phone: new String(),
});

export const member = new VersionedDictionary(new Dictionary("MemberStruct", {
    name: new String(),
    records: new Array(field),
    names: new Array(new String())
}));

member.addVersion(
    member.last
        .remove(["name"])
        .add({
            firstName: new String(),
            lastName: new String(),
        })
);

member.addVersion(
    member.last
        .remove(["names"])
);

/*
export const MemberV2 = Dictionary("Member", {
    firstName: String,
    lastName: String,
    phone: Field
});

export const Member = Combined(MemberV1, MemberV2);*/