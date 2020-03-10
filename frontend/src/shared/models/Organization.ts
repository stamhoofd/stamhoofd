import { Group } from "./Group";
export class Organization {
    id: number = 0;
    name: string = "";
    groups: Group[] | null = null;
}
