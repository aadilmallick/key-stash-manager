import initData from "./frontend/mockdata/initdata.json" with { type: "json" };
import fs from "node:fs";
import path from "node:path";

const mockDataPath = path.join(
    process.cwd(),
    "frontend",
    "mockdata",
    "initdata.json",
);

// 1. remove all tag keys
// 2. replace all secret values with "blblblbl"
function transformInitData(data: typeof initData) {
    const profiles = data.profiles.map((profile) => {
        const folders = profile.folders.map((folder) => {
            const secrets = folder.secrets.map((secret) => {
                return {
                    ...secret,
                    value: "0x0000000000000000000000000000000000000000",
                    tags: [],
                };
            });
            return {
                ...folder,
                secrets,
            };
        });
        return {
            ...profile,
            folders,
        };
    });
    return {
        ...data,
        profiles,
    };
}

const transformedData = transformInitData(initData);

fs.writeFileSync(mockDataPath, JSON.stringify(transformedData));
