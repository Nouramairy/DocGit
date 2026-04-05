import { CYAN, GREEN, RED, RESET } from "../colors.js";
import { assertEqual, assertHasProperty, group, setup, skip, test } from "../framework.js";
import { assertOk, DELETE, GET, HEAD, POST, PUT } from "../http.js";
import { randomString } from "../random.js";
import * as TestUser from "../testUser.js";

export function registerApiLogin() {
    group("/api/login", () => {
        test("kan logga in som test-användaren", () => {
            if (!TestUser.getUserInfo().jwt) throw `Inloggning med "test-user" misslyckades`;
        });

        group("401 Unauthorized om användarnamnet", () => {
            test("är tomt", async () => await wrongName(""));
            test("börjar korrekt", async () => await wrongName("testn9sadas9dasnd9nas9asdna9sd"));
            test("slutar korrekt", async () => await wrongName("ns9adnasdasnads9nsd9an9asdnuser"));
            test("har fel liten / stor bokstav", async () => {
                await wrongName("TEST-user");
                await wrongName("test-USER");
                await wrongName("TEST-USER");
                await wrongName("TeSt-uSEr");
            });
            test("är helt fel", async () => await wrongName("asdasdn098nasndasoasdd93dasf9asd9nua9d"));
        });

        group("401 Unauthorized om lösenordet", () => {
            test("är tomt", async () => await wrongPass(""));
            test("är delvis rätt", async () => {
                await wrongPass(TestUser.password + "?");
                await wrongPass(TestUser.password.substring(0, TestUser.password.length / 2));
                await wrongPass(TestUser.password.substring(1));
                await wrongPass(TestUser.password.substring(TestUser.password.length / 2));
            });
            test("har fel liten / stor bokstav", async () => {
                await wrongPass("");
                await wrongPass(TestUser.password.toLowerCase());
                await wrongPass(TestUser.password.toUpperCase());
            });
            test("är helt fel", async () => {
                for (let i = 0; i < 10; i++) {
                    const password = randomString(1 + Math.floor(Math.random() * 20));
                    await wrongPass(password);
                }
            });
        });
    });
}

async function wrongName(name) {
    const r = await POST.everything("/api/login", {
        user: name,
        password: TestUser.password,
    });
    if (r.status == 401) return;

    throw "Inloggningen borde ha misslyckats";
}

async function wrongPass(password) {
    const r = await POST.everything("/api/login", {
        user: TestUser.name,
        password: password,
    });
    if (r.status == 401) return;

    throw "Inloggningen borde ha misslyckats";
}