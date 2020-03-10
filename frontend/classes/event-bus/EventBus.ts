import { EventBusMessage } from "./EventBusMessage";
import { EventBusListener } from "./EventBusListener";

class EventBus {
    private listeners: EventBusListener[] = [];
    send(type: string, data: any): void {
        console.log("Send message: "+type);
        this.listeners.forEach(listener => {
            if (listener.shouldReceive(type)) {
                console.log("Received message");
                listener.receive(data);
            }
        });
    }

    /// Convenience method
    listen(type: string, callback: (data: any) => void): EventBusListener {
        console.log("Listening for "+type);
        const listener = new EventBusListener(type, callback);
        this.addListener(listener);
        return listener;
    }

    addListener(listener: EventBusListener) {
        this.listeners.push(listener);
    }

    removeListener(listener: EventBusListener) {
        for (let index = 0; index < this.listeners.length; index++) {
            if (this.listeners[index] === listener) {
                this.listeners.splice(index, 1);
                return;
            }
        }
        throw new Error("Listener was not registered but was removed.");
    }
}

export let eventBus = new EventBus();