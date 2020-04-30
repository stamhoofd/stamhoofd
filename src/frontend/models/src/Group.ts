import { Data } from '@stamhoofd-common/encoding';

import { Member } from "./Member";

export class Group {
    id = 0;
    name = "";
    members: Member[] | null = null;

    static decode(_data: Data): Group {
        throw new Error("Not yet implemented")
    }
}
