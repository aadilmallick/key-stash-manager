const NETLIFY_URL = "https://varstash.netlify.app";
const PROD_URL = "https://varstash.netlify.app";
const VIDEO_URL = "#how-it-works";

export const constants = {
    appName: "VarStash",
    getUrl: () => {
        const isNetlifyUrl = window.location.hostname.includes("netlify.app");
        return isNetlifyUrl ? NETLIFY_URL : PROD_URL;
    },
    getVideoUrl: () => {
        return VIDEO_URL;
    },
};
