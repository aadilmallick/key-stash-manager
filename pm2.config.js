module.exports = {
  apps: [
    {
      name: "key-stash-manager",
      script: "server.js",
      interpreter: "/bin/bash",
      interpreter_args: "-c",
      env: {
        VITE_USING_SERVER: "true",
      },
      watch: false,
      instances: 1,
      exec_mode: "fork",
    },
  ],
};
