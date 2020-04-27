import { Server } from '@stamhoofd-frontend/networking';

import { Group } from "./Group";
export class Organization {
    id = 0;
    name = "";
    uri = "";
    groups: Group[] | null = null;

    getServer(): Server {
        return new Server("http://api."+this.uri+".stamhoofd.local:9090")
    }
}
