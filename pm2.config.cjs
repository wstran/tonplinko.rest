const create = (port) => ({
  name: 'rest',
  script: './src/index.ts',
  interpreter: 'bun',
  env: { PORT: port, NODE_ENV: "production" },
});

module.exports = {
  apps: [create(8001), create(8002), create(8003), create(8004)]
};