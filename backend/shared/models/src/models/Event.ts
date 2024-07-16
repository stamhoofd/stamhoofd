
import { column, Model } from "@simonbackx/simple-database";
import { EventMeta, Event as EventStruct } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";
import { Group } from "./Group";

export class Event extends Model {
    static table = "events";

    @column({ primary: true, type: "string", beforeSave(value) {
        return value ?? uuidv4();
    } })
    id!: string;

    @column({ type: "string" })
    name: string

    @column({ type: "string" })
    organizationId: string

    @column({ type: "string", nullable: true })
    groupId: string|null = null

    @column({ type: "boolean" })
    isGlobal = false

    @column({ type: "datetime" })
    startDate: Date

    @column({ type: "datetime" })
    endDate: Date

    @column({ type: "json", decoder: EventMeta })
    meta = EventMeta.create({})

    @column({
        type: "datetime", beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date()
            date.setMilliseconds(0)
            return date
        }
    })
    createdAt: Date

    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        },
        skipUpdate: true
    })
    updatedAt: Date

    getStructure(group?: Group|null) {
        return EventStruct.create({
            ...this,
            group: group ? group.getStructure() : null
        })
    }

    getPrivateStructure(group?: Group|null) {
        return EventStruct.create({
            ...this,
            group: group ? group.getPrivateStructure() : null
        })
    }
}
