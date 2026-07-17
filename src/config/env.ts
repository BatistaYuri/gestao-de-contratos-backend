const port = Number(process.env.PORT);

if (!port) {
  throw new Error('Missing PORT environment variable');
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL environment variable');
}

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('Missing JWT_SECRET environment variable');
}

const jwtExpiresIn = process.env.JWT_EXPIRES_IN;

if (!jwtExpiresIn) {
  throw new Error('Missing JWT_EXPIRES_IN environment variable');
}

const adminUsername = process.env.ADMIN_USERNAME;

if (!adminUsername) {
  throw new Error('Missing ADMIN_USERNAME environment variable');
}

const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminPassword) {
  throw new Error('Missing ADMIN_PASSWORD environment variable');
}

const redisHost = process.env.REDIS_HOST;

if (!redisHost) {
  throw new Error('Missing REDIS_HOST environment variable');
}

const redisPort = Number(process.env.REDIS_PORT);

if (!redisPort) {
  throw new Error('Missing REDIS_PORT environment variable');
}

const contractSummaryCacheTtlSeconds = Number(process.env.CONTRACT_SUMMARY_CACHE_TTL_SECONDS);

if (!contractSummaryCacheTtlSeconds) {
  throw new Error('Missing CONTRACT_SUMMARY_CACHE_TTL_SECONDS environment variable');
}

export const env = {
  adminUsername,
  adminPassword,
  databaseUrl,
  jwtExpiresIn,
  jwtSecret,
  port,
  redisHost,
  redisPort,
  contractSummaryCacheTtlSeconds,
};
