import { Dictionary } from "../classes/struct-builder/Dictionary";
import { String } from "../classes/struct-builder/String";
import { Array } from "../classes/struct-builder/Array";
import { VersionedDictionary } from '../classes/struct-builder/VersionedDictionary';

export { String };
export const record = new Dictionary("Record", {
    name: new String(),
});

export const member = new VersionedDictionary(new Dictionary("Member", {
    name: new String(),
    records: new Array(record)
}));

member.addVersion(
    member.last
        .remove(["name"])
        .add({
            firstName: new String(),
            lastName: new String(),
        })
);
/*
export const MemberV2 = Dictionary("Member", {
    firstName: String,
    lastName: String,
    phone: Field
});

export const Member = Combined(MemberV1, MemberV2);*/