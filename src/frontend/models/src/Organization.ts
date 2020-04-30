import { Data,Encodeable } from '@stamhoofd-common/encoding';
import { Server } from '@stamhoofd-frontend/networking';

import { Group } from "./Group";
export class Organization implements Encodeable {
    id = 0;
    name = "";
    uri = "";
    groups?: Group[];

    constructor(data: {
        id: number; name: string; uri: string; groups?: Group[];
    }) {
        this.id = data.id
        this.name = data.name
        this.uri = data.uri
        this.groups = data.groups
    }

    getServer(): Server {
        return new Server("http://api."+this.uri+".stamhoofd.local:9090")
    }

    static decode(data: Data): Organization {
        return new Organization({
            id: data.field("id").number,
            name: data.field("name").string,
            uri: data.field("uri").string,
            groups: data.optionalField("groups")?.array(Group)
        })
    }

    encode() {
        return {
            id: this.id,
            name: this.name,
            uri: this.uri,
            groups: this.groups
        }
    }
}
