import { Group } from "./Group";
export class Organization {
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
}
