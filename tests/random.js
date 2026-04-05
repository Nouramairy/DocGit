import { isAdvanced } from "./inputHandler.js";
import Path from "path";
import FS from "fs";

const string = "1234567890QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm";

export function randomString(length) {
    const output = Array(length);
    for (let i = 0; i < length; i++) output[i] = string[Math.floor(Math.random() * string.length)];
    return output.join("");
}

export function randomFileName() {
    const extensions = [
        ".txt",
        ".json",
        ".md",
        ".md",
        ".cs",
        ".h",
        ".r",
        ".test",
        ".exempel",
    ];

    const ext = extensions[Math.floor(Math.random() * extensions.length)];
    return randomString(16) + ext;
}

export function fillDirectoryWithRandomContent(dir, numberOfEntities) {
    if (numberOfEntities <= 0) return;

    const m = Math.min(numberOfEntities, 1 + Math.floor(Math.random() * 10));
    for (let i = 0; i < m; i++) {
        numberOfEntities--;
        generateRandomFile(dir);
    }

    if (numberOfEntities > 0 && isAdvanced()) {
        const numberOfDirs = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < numberOfDirs && numberOfEntities > 0; i++) {
            const childDirName = randomString(16);
            const childPath = Path.join(dir, childDirName);
            FS.mkdirSync(childPath);
            numberOfEntities = fillDirectoryWithRandomContent(childPath, numberOfEntities);
        }
    }

    return numberOfEntities;
}

export function generateRandomFile(dir, minFileLength = 20, maxFileLength = 500) {
    const path = Path.join(dir, randomFileName());
    const content = randomString(minFileLength + Math.floor(Math.random() * (maxFileLength - minFileLength)));
    FS.writeFileSync(path, content, "utf8");
}