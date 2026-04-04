import { CYAN, GREEN, RED, RESET } from "../colors.js";
import { group, test, testGet } from "../framework.js";
import { GET, getDomain } from "../http.js";

export function registerIndexHtmlTests() {
    group(`index.html`, () => {
        testGet(`kan hämtas via ${CYAN}${getDomain()}/${RESET}`, "/");
        testGet(`kan hämtas via ${CYAN}${getDomain()}/index.html${RESET}`, "/index.html");
        test("ser likadan ut i båda versionerna", async () => {
            const short = await GET.text("/");
            const long = await GET.text("/index.html");
            return short == long;
        });
        test("har rätt Content-Type", async () => {
            const response = await GET.everything("/");
            const contentType = response.headers.get("content-type");
            if (!contentType)
                throw "Ingen Content-Type satt";
            if (contentType != "text/html" && !contentType.startsWith("text/html"))
                throw `Fick ${RED}${contentType}${RESET}, men ${GREEN}text/html${RESET} förväntades`;
        });
    });
}