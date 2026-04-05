import * as SignalR from "@microsoft/signalr";
import * as HTTP from "./http.js";
import { getUserInfo } from "./testUser.js";

export const endpoint = "/api/events/signalr";

let connection = undefined;
let connected, error, allErrors, events;

export function isConnected() {
    return connected;
}

export function getEventsFor(file, type) {
    return type != undefined
        ? events.filter(x => x.file == file && x.type == type)
        : events.filter(x => x.file == file);
}

export async function start(auth) {
    if (connection) {
        await stop();
    }

    connected = false;
    error = undefined;
    allErrors = [];
    events = [];

    connection = new SignalR.HubConnectionBuilder()
        .withUrl(HTTP.getDomain() + endpoint, auth && getUserInfo().jwt
            ? { accessTokenFactory: () => getUserInfo().jwt }
            : undefined
        )
        .configureLogging({
            log: (level, message) => {
                if (level >= 4) errors.push(message);
            }
        })
        .build();

    connection.onclose(() => connected = false);
    connection.on("Event", (type, file) => {
        events.push({
            type,
            file,
        });
    });

    try {
        await connection.start();
        connected = true;
        return true;
    }
    catch (e) {
        error = e;
        connected = false;
        return false;
    }
}

export async function stop() {
    if (!isConnected()) return true;

    try {
        await connection.stop();
        return true;
    }
    catch (e) {
        error = e;
        return false;
    }
}
