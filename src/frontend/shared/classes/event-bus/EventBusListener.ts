import { EventBusMessage } from "./EventBusMessage";

export class EventBusListener {
    public callback: (message: EventBusMessage) => void;
    public type: string;

    constructor(type: string, callback: (message: EventBusMessage) => void) {
        this.type = type;
        this.callback = callback;
    }

    shouldReceive(type: string): boolean {
        return type == this.type;
    }

    receive(message: EventBusMessage) {
        this.callback(message);
    }
}
