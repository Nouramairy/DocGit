import { CYAN, GREEN, RED, DIM, RESET } from "../colors.js";
import { assertEqual, assertHasProperty, group, setup, skip, test } from "../framework.js";
import * as HTTP from "../http.js";
import { isAdvanced, isAdvanced as isGroup } from "../inputHandler.js";
import { randomString } from "../random.js";
import * as SignalR from "../signalr.js";


const timeout = 100;

export function registerSignalR() {
    let couldCreate = false;
    let fileName = "";

    group("SignalR", () => {
        test("kan koppla upp mot " + CYAN + SignalR.endpoint + RESET, async () => {
            if (!await SignalR.start(isAdvanced()))
                throw `Det gick inte att ansluta`;
        });

        group("får event när en fil", () => {
            test("skapas", async () => {
                couldCreate = false;
                if (!SignalR.isConnected()) return skip();

                fileName = generateFileName();

                await HTTP.POST.void("/api/files/" + fileName, "filens innehåll");
                couldCreate = true;

                await delay(timeout);
                assertOneEventFor(0, fileName, "fil skapad");
            });

            test("uppdateras", async () => {
                if (!couldCreate) return skip();

                await HTTP.PUT.void("/api/files/" + fileName, "nytt innehåll");
                await delay(timeout);
                assertOneEventFor(1, fileName, "fil uppdaterad");
            });

            test("tas bort", async () => {
                if (!couldCreate) return skip();

                await HTTP.DELETE.void("/api/files/" + fileName);
                await delay(timeout);
                assertOneEventFor(2, fileName, "fil borttagen");
            });

            test("tas bort flera gånger", async () => {
                if (!couldCreate) return skip();

                await HTTP.DELETE.void("/api/files/" + fileName);
                await HTTP.DELETE.void("/api/files/" + fileName);
                await HTTP.DELETE.void("/api/files/" + fileName);
                await HTTP.DELETE.void("/api/files/" + fileName);
                await delay(timeout);
                assertOneEventFor(2, fileName, "fil borttagen");
            });

            test("skapas med PUT", async () => {
                if (!couldCreate) return skip();
                fileName = generateFileName();

                await HTTP.PUT.void("/api/files/" + fileName, "den nya filens innehåll");
                try {
                    await HTTP.DELETE.void("/api/files/" + fileName);
                } catch { }
                couldCreate = true;

                await delay(timeout);
                assertOneEventFor(0, fileName, "fil skapad");
            });
        });

        if (isAdvanced()) {
            group("får event när en mapp", () => {
                test("skapas", async () => {
                    couldCreate = false;
                    if (!SignalR.isConnected()) return skip();

                    fileName = generateDirectoryName();

                    await HTTP.POST.void("/api/files/" + fileName);
                    couldCreate = true;

                    await delay(timeout);
                    assertOneEventFor(5, fileName, "mapp skapad");
                });

                test("tas bort", async () => {
                    if (!couldCreate) return skip();

                    await HTTP.DELETE.void("/api/files/" + fileName);
                    await delay(timeout);
                    assertOneEventFor(7, fileName, "mapp borttagen");
                });

                test("tas bort flera gånger", async () => {
                    if (!couldCreate) return skip();

                    await HTTP.DELETE.void("/api/files/" + fileName);
                    await HTTP.DELETE.void("/api/files/" + fileName);
                    await HTTP.DELETE.void("/api/files/" + fileName);
                    await HTTP.DELETE.void("/api/files/" + fileName);
                    await delay(timeout);
                    assertOneEventFor(7, fileName, "mapp borttagen");
                });

                test("skapas med PUT", async () => {
                    if (!couldCreate) return skip();
                    fileName = generateDirectoryName();

                    await HTTP.PUT.void("/api/files/" + fileName);
                    try {
                        await HTTP.DELETE.void("/api/files/" + fileName);
                    } catch { }
                    couldCreate = true;

                    await delay(timeout);
                    assertOneEventFor(5, fileName, "mapp skapad");
                });
            });

            test("måste använda JWT", async () => {
                await SignalR.stop();
                if (await SignalR.start(false)) throw `Det borde inte ha gått att ansluta utan JWT`;
            });
        }


        setup(async () => {
            await SignalR.stop();
        });
    });
}


function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function assertOneEventFor(type, fileName, typeDesc) {
    const events = SignalR.getEventsFor(fileName, type);
    if (events.length != 1) throw `Fick ${events.length == 0 ? "inget event" : `${events.length} events`} event med typ ${GREEN}${type}${RESET} ${DIM}(${typeDesc})${RESET} och fil ${GREEN}${fileName}${RESET} (borde ha fått 1 event)`;
}

function generateFileName() {
    return `signalr-test-${randomString(16)}.txt`;
}

function generateDirectoryName() {
    return `signalr-test-directory-${randomString(16)}`;
}