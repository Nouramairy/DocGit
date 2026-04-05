import { CYAN, GREEN, RED, RESET } from "./colors.js";
import { POST } from "./http.js";

export const name = "test-user";
export const password = "So Long, and Thanks for All the Fish";
let jwt;

let endpointExisted = false;

export function apiLoginExists() {
    return endpointExisted;
}

export function getJwt() {
    return jwt;
}

export function getUserInfo() {
    return {
        name: name,
        password: password,
        jwt: jwt,
    };
}

export async function tryLoginAsTestUser(isGroup, showGroupError) {
    let response;
    try {
        response = await POST.everything("/api/login", {
            user: name,
            password: password,
        });
        if (response.status == 404) throw undefined;
        endpointExisted = true;
    }
    catch (e) {
        const message = `Programmet körs ${isGroup ? RED : GREEN}utan användare${RESET} eftersom ${CYAN}/api/login${RESET} inte är registrerad`;
        if (isGroup) {
            console.error(message);
            if (showGroupError) console.error(RED + "Detta måste åtgärdas för att bli godkänt när uppgiften görs i grupp" + RESET);
        }
        else {
            console.log(message);
        }
        return;
    }

    console.log(`Programmet körs i användarläge eftersom ${CYAN}/api/login${RESET} endpointen finns`);

    if (response.status != 200) {
        logError(
            `fick status ${RED}${response.status} ${response.statusText}${RESET}\n` +
            `Testanvändaren loggar in med följande information, säkerställ att en sådan användare finns:\n` +
            ` - Användarnamn: ${name}\n` +
            ` - Lösenord:     ${password}`
        );
        return;
    }

    if (response.body.token == undefined) {
        logError("fanns ingen \"token\" property");
        return;
    }

    jwt = response.body.token;
}


export function logError(error) {
    console.error(`Det gick ${RED}inte${RESET} att logga in med testanvändaren, ${error}`);
}