import { CYAN, RED, RESET } from "./colors.js";
import { apiLoginExists, getUserInfo } from "./testUser.js";

let domain = "";

export function setDomain(input) {
    domain = input.trim();
    if (domain.endsWith("/")) domain = domain.substring(0, domain.length - 1).trim();
    if (!domain.startsWith("http")) domain = `http://${domain}`;

    const portIndex = domain.lastIndexOf(":");
    if (domain[portIndex + 1] == "/") domain += ":80";
}

export function getDomain() {
    return domain;
}


function getUrl(endpoint) {
    if (!endpoint.startsWith("/")) endpoint = "/" + endpoint;
    return domain + endpoint;
}

export const GET = {
    async everything(endpoint) {
        return await customFullFetch(endpoint, "GET", undefined, false);
    },
    async void(endpoint) {
        await customFetch(endpoint, "GET");
    },
    async text(endpoint) {
        const result = await customFetch(endpoint, "GET");
        const text = await result.text();
        return text;
    },
    async json(endpoint) {
        const result = await customFetch(endpoint, "GET");
        const json = await result.json();
        return json;
    },
};

export const POST = {
    async everything(endpoint, body, contentType) {
        return await customFullFetch(endpoint, "POST", body, false, contentType);
    },
    async void(endpoint, body) {
        const result = await customFetch(endpoint, "POST", { body });
        assertOk(result);
    },
    async json(endpoint, body) {
        const result = await customFetch(endpoint, "POST", { body });
        const json = await result.json();
        return json;
    },
};

export const PUT = {
    async everything(endpoint, body) {
        return await customFullFetch(endpoint, "PUT", body, false);
    },
    async void(endpoint, body) {
        const result = await customFetch(endpoint, "PUT", { body });
        assertOk(result);
    },
    async json(endpoint, body) {
        const result = await customFetch(endpoint, "PUT", { body });
        const json = await result.json();
        return json;
    },
};

export const DELETE = {
    async void(endpoint, body) {
        const result = await customFetch(endpoint, "DELETE", { body });
        assertOk(result);
    },
};

export const HEAD = {
    async everything(endpoint) {
        return await customFullFetch(endpoint, "HEAD", undefined, false);
    },
};

async function customFullFetch(endpoint, method, body, assert, contentType) {
    const args = { body };
    if (contentType) {
        if (contentType.base64) {
            args.headers = {
                "Content-Transfer-Encoding": "base64",
                "Content-Type": contentType.value,
            };
        }
        else {
            args.headers = { "Content-Type": contentType };
        }
    }


    const result = await customFetch(endpoint, method, args, assert);
    let resultBody;

    if (result.body != undefined) {
        if (result.headers.get("content-type")?.startsWith("application/json")) {
            resultBody = await result.json();
        }
        else {
            resultBody = await result.text();
        }
    }

    return {
        ok: result.ok,
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
        body: resultBody,
    };
}

export function assertOk(result) {
    if (!result.ok) throw `${RED}${result.status} ${result.statusText}${RESET}`;
}

export async function customFetch(endpoint, method, args, assert) {
    const url = getUrl(endpoint);
    let result;
    try {
        // Method
        if (method && method != "GET") {
            if (!args) args = {};
            args.method = method;
        }

        // Auto headers and body handling
        if (args?.body) {
            if (!args.headers) args.headers = {};
            if (!("Content-Type" in args.headers)) args.headers["Content-Type"] = "text/plain; charset=UTF-8";
            if (typeof args.body === "object") {
                args.headers["Content-Type"] = "application/json; charset=UTF-8";
                args.body = JSON.stringify(args.body);
            }
        }

        // Auth
        if (apiLoginExists()) {
            const user = getUserInfo();
            if (!args) args = {};
            if (!args.headers) args.headers = {};
            args.headers.Authorization = `bearer ${user.jwt}`;
        }

        result = await fetch(url, args);
    }
    catch {
        throw `Det gick inte att nå ${CYAN}${url}${RESET} med en GET request`;
    }

    if (assert !== false) assertOk(result);

    return result;
}