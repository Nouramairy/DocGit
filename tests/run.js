import { group, runTests, setup } from "./framework.js";
import { isAdvanced, isAdvanced as isGroup, printExampleCommands, startProgram } from "./inputHandler.js";
import { registerApiFilesPost } from "./tests/v1-api-files-post.js";
import { registerApiLogin } from "./tests/v1-api-login.js";
import { registerIndexHtmlTests } from "./tests/v1-index-html.js";
import { registerSignalR } from "./tests/v2-signalr.js";
import FS from "fs";
import Path from "path";
import { registerClient } from "./tests/v3-client.js";
import { CYAN, GREEN, RED, RESET } from "./colors.js";

await startProgram(printHelp);
const path = getPathToClient();

group("Vecka 1", () => {
    registerIndexHtmlTests();
    registerApiFilesPost();

    if (isGroup()) {
        registerApiLogin();
    }
});

group("Vecka 2", () => {
    registerSignalR();
});

group("Vecka 3", () => {
    setup(() => {
        if (!path) throw "Ange en klientsökväg eller skapa en ett projekt som heter Client.csproj";
    })

    if (path) registerClient(path);
});


const result = await runTests();
process.exit(result ? 0 : 1);



function printHelp() {
    console.log("Testerna används för att säkerställa att programmet fungerar som tänkt. För att")
    console.log("bli godkänd måste alla tester vara gröna, men kom ihåg att det tillkommer tester")
    console.log("för de som jobbar som grupp. Se nedan.")
    console.log()
    printExampleCommands("npm test");
}

function getPathToClient() {
    const index = isAdvanced() ? 2 : 1;
    let path = process.argv[2 + index];
    if (path) {
        let fullPath = Path.resolve(path);
        if (!FS.existsSync(fullPath)) {
            let projectName = path;
            if (!projectName.endsWith(".csproj")) projectName += ".csproj";
            fullPath = findClientCsprojDir(process.cwd(), 0, projectName);
            if(fullPath) return fullPath;

            reportClientError();
            console.log(`Ogiltig sökväg eller projektnamn: ${CYAN}${path}${RESET}`);
            console.log("Ta bort detta argument eller ange en giltig sökväg eller projektnamn till");
            console.log("klient-projektets");
            console.log();
            return undefined;
        }
        return Path.dirname(fullPath);
    }

    path = findClientCsprojDir(process.cwd(), 0, "Client.csproj");
    if (!path) {
        reportClientError();
        console.log(`Lägg till ett argument med sökvägen till klientprojektets ${CYAN}.csproj${RESET}, eller säkerställ`);
        console.log(`att klientens projektfil heter ${GREEN}Client.csproj${RESET} så hittas den automatiskt`);
        console.log();
    }
    return path;
}

function findClientCsprojDir(currentDir, depth, nameToFind) {
    if (depth > 10) return undefined;

    const files = FS.readdirSync(currentDir);
    if (files.some(file => file === nameToFind))
        return currentDir;

    for (const file of files) {
        if (file == ".git") continue;

        const fullPath = Path.join(currentDir, file);
        if (!FS.statSync(fullPath).isDirectory()) continue;

        const path = findClientCsprojDir(fullPath, depth + 1, nameToFind);
        if (path) return path;
    }
    return undefined;
}

function reportClientError() {
    console.log(RED + "Kunde inte hitta ett klientprojekt" + RESET);
}