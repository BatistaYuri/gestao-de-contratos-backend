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

if (!/^[1-9]\d*[smhdwy]$/.test(jwtExpiresIn)) {
  throw new Error(
    'Invalid JWT_EXPIRES_IN: expected a positive duration such as 8h',
  );
}

const adminUsername = process.env.ADMIN_USERNAME;

if (!adminUsername) {
  throw new Error('Missing ADMIN_USERNAME environment variable');
}

const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminPassword) {
  throw new Error('Missing ADMIN_PASSWORD environment variable');
}

export const env = {
  adminUsername,
  adminPassword,
  databaseUrl,
  jwtExpiresIn,
  jwtSecret,
  port,
};
