const NETLIFY_URL = "https://varstash.netlify.app";
const PROD_URL = "https://varstash.com";
const VIDEO_URL = "#how-it-works";

export const constants = {
    appName: "VarStash",
    getUrl: () => {
        return PROD_URL;
    },
    getVideoUrl: () => {
        return VIDEO_URL;
    },
    getGithubUrl: () => {
        return "https://github.com/aadilmallick/key-stash-manager";
    },
};
