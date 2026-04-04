import { RED, GREEN, RESET, DIM } from "./colors.js";
import { GET, getDomain } from "./http.js";

let allTests = [];
let testBuilder = undefined;
let hasErrors = false;
let previousLogWasEmpty = false;

async function runTest(test, indent) {
    // Is a group
    if (test.tests) {
        indent += "  ";
        let isOk = true;
        let reason = undefined;
        const results = [];
        for (const subTest of test.tests) {
            const r = await runTest(subTest, indent);
            if (r === undefined) continue; // Skip setup from printing
            if (r.ok === false) {
                isOk = false;

                if (r.hoist) {
                    reason = r.name;
                    continue;
                }
            }
            results.push(r);
        }
        return {
            ok: isOk,
            name: test.name,
            reason: reason,
            tests: results,
        };
    }
    // Individual tests (setup)
    else if (test.type == "setup") {
        const result = await makeAsync(test.run);
        if (result.result === false) return {
            ok: false,
            name: result.reason,
            hoist: true,
        };
    }
    // Individual tests (normal)
    else {
        const result = await makeAsync(test.test);
        return {
            ok: result?.result,
            name: test.name,
            reason: result?.reason,
        };
    }
}

function printTestResults(results, indent) {
    let text = results.name;
    if (results.reason) {
        const reason = String(results.reason);
        if (!reason.startsWith("\n")) {
            text += `${DIM} - ${RESET}`;
            // text += "\n" + indent + results.reason.replaceAll("\n", "\n  ") + "\n";
            // previousLogWasEmpty = true;
        }
        // else {
        //     previousLogWasEmpty = true;
        // }
        text += reason;

        // else {
        //     text += `${DIM} - ${RESET}${results.reason}`;
        // }
    }
    else {
        previousLogWasEmpty = false;
    }
    printTestResult(indent, results.ok, text);

    if (results.tests) {
        indent += "  ";
        for (const r of results.tests) {
            printTestResults(r, indent);
        }
    }
}

export async function runTests() {
    for (let i = 0; i < allTests.length; i++) {
        const result = await runTest(allTests[i]);
        printTestResults(result, "");
        if (!previousLogWasEmpty) console.log();
    }

    // Varför? Jo, Node utvecklarna verkar inte förstå hur man använder LIBUV
    // korrekt, så utan den här kan hela testet krascha pga en ASSERT i C-koden
    // som misslyckas då resurser används efter UV_HANDLE_CLOSING...
    await new Promise(resolve => setTimeout(resolve, 100));
    return !hasErrors;
}


export function group(name, delegate) {
    const previousTests = testBuilder;
    testBuilder = [];

    delegate();

    (previousTests ?? allTests).push({
        name: name,
        tests: [...testBuilder],
    });

    testBuilder = previousTests;
}

export function skip() {
    return "SKIP-TEST";
}

export function setup(delegate) {
    testBuilder.push({
        type: "setup",
        run: async () => {
            try {
                const result = await delegate();
                if (result == "SKIP-TEST") throw "Cant skip setup";

                return {
                    result: result === undefined ? true : result
                }
            }
            catch (e) {
                return {
                    result: false,
                    reason: e,
                };
            }
        },
    });
}

export function test(name, delegate) {
    testBuilder.push({
        name: name,
        test: async () => {
            try {
                const result = await makeAsync(delegate);
                if (result === "SKIP-TEST") return undefined;
                return {
                    result: result === undefined ? true : result
                }
            }
            catch (e) {
                return {
                    result: false,
                    reason: e,
                };
            }
        },
    });
}

export function printTestResult(indent, success, name) {
    name = String(name).replaceAll("\n", `\n${indent}`)
    if (success === undefined) {
        console.log(`${indent}${DIM}- ${name}${RESET}`);
    }
    else if (!success) {
        hasErrors = true;
        console.error(`${indent}${RED}⨉ ${RESET}${name}${RESET}`);
    }
    else {
        console.log(`${indent}${GREEN}✓ ${RESET}${name}`);
    }
}

export function testGet(name, endpoint) {
    test(name, async () => {
        const result = await GET.text(endpoint);
        return result !== false;
    });
}

async function makeAsync(fn, ...args) {
    return await Promise.resolve(fn(...args));
}


export function assertEqual(expected, actual) {
    if (expected == actual) return;

    expected = expected.replaceAll("\n", "\\n").replaceAll("\r", "\\r").replaceAll("\t", "\\t");
    actual = actual.replaceAll("\n", "\\n").replaceAll("\r", "\\r").replaceAll("\t", "\\t");
    if (expected.length > 25 || actual.length > 25)
        throw `korrekt:   ${GREEN}${makePreviewSize(expected)}${RESET}\nnuvarande: ${RED}${makePreviewSize(actual)}${RESET}`;

    throw `${GREEN}${expected}${RESET} förväntades, fick ${RED}${actual}${RESET}`;
}


export function assertHasProperty(obj, propertyName, expectedValue) {
    if (obj[propertyName] == undefined) {
        const allProperties = Object.keys(obj);
        const expectedAsLower = propertyName.toLowerCase();
        for (const existingProp of Object.keys(obj)) {
            const existingAsLower = existingProp.toLowerCase();
            if (existingAsLower == expectedAsLower)
                throw `Det fanns en ${RED}"${existingProp}"${RESET} property, men den borde ha hetat ${GREEN}"${propertyName}"${RESET}`;
        }
        throw `Fanns ingen ${RED}"${propertyName}"${RESET} property`;
    }

    if (expectedValue != undefined) {
        assertEqual(expectedValue, obj[propertyName]);
    }
}

function makePreviewSize(value) {
    if (value.length > 80) return value.substring(0, 77) + "...";
    return value;
}