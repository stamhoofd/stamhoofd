import { Member } from "./Member";

export class Group {
    id: number = 0;
    name: string = "";
    members: Member[] | null = null;
}
