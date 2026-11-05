// PM2 process file. Env comes from .env (loaded by Next.js).
module.exports = {
  apps: [{
    name: "ballot",
    script: "node_modules/next/dist/bin/next",
    args: "start -p 3000 -H 127.0.0.1",
    cwd: __dirname,
    env: { NODE_ENV: "production" },
    max_memory_restart: "600M",
  }],
};
