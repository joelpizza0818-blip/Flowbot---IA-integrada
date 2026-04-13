/* global process */
import sql from 'mssql';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

function normalizeServer(value, fallback) {
  const raw = String(value || fallback || '').trim();
  if (!raw) return fallback;
  if (raw === '.' || raw.toLowerCase() === '(local)') return raw;
  return raw.split(/[\\/]/)[0] || fallback;
}

function parseInstanceSpec(value, fallbackHost, fallbackInstance = 'SQLEXPRESS') {
  const raw = String(value || '').trim();
  if (!raw) return { host: fallbackHost, instance: fallbackInstance };
  const parts = raw.split(/[\\/]/).filter(Boolean);
  if (!parts.length) return { host: fallbackHost, instance: fallbackInstance };
  if (parts.length === 1) return { host: fallbackHost, instance: parts[0] };
  return { host: parts[0], instance: parts[parts.length - 1] };
}

function parseOptionalPort(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalPorts(value) {
  return String(value || '')
    .split(',')
    .map((entry) => parseOptionalPort(entry.trim()))
    .filter((port) => Number.isFinite(port) && port > 0);
}

function detectSqlExpressPortWindows(instanceName) {
  if (os.platform() !== 'win32') return null;
  try {
    const command = "$instanceId=(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\Instance Names\\SQL')." + instanceName + "; if (-not $instanceId) { '' } else { $key = \"HKLM:\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\$instanceId\\MSSQLServer\\SuperSocketNetLib\\Tcp\\IPAll\"; $props = Get-ItemProperty $key -ErrorAction SilentlyContinue; if ($props.TcpPort) { $props.TcpPort } elseif ($props.TcpDynamicPorts) { $props.TcpDynamicPorts } else { '' } }";
    const raw = execFileSync('powershell', ['-NoProfile', '-Command', command], { encoding: 'utf8' }).trim();
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

const osHostName = normalizeServer(os.hostname(), 'localhost');
const configuredHostMachine = normalizeServer(process.env.SQLSERVER_HOST_MACHINE, osHostName);
const configuredHost = normalizeServer(process.env.SQLSERVER_HOST, 'localhost');
const parsedInstance = parseInstanceSpec(process.env.SQLSERVER_INSTANCE, configuredHostMachine, 'SQLEXPRESS');
const sqlServerInstance = parsedInstance.instance;
const instanceHost = normalizeServer(parsedInstance.host, configuredHostMachine);
const configuredPort = parseOptionalPort(process.env.SQLSERVER_PORT);
const configuredPorts = parseOptionalPorts(process.env.SQLSERVER_PORT_CANDIDATES);
const hostCandidates = [...new Set([
  configuredHostMachine,
  configuredHost,
  instanceHost,
  osHostName,
  'localhost',
  '127.0.0.1',
].filter(Boolean))];

const baseAuth = {
  user: process.env.SQLSERVER_USER || 'sa',
  password: process.env.SQLSERVER_PASSWORD || '123456',
  database: process.env.SQLSERVER_DATABASE || 'flowbot',
  connectionTimeout: Number(process.env.SQLSERVER_CONNECTION_TIMEOUT_MS || 10000),
  requestTimeout: Number(process.env.SQLSERVER_REQUEST_TIMEOUT_MS || 15000),
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 15000,
  },
  options: {
    encrypt: String(process.env.SQLSERVER_ENCRYPT || 'false').toLowerCase() === 'true',
    trustServerCertificate: String(process.env.SQLSERVER_TRUST_CERT || 'true').toLowerCase() === 'true',
  },
};

const detectedSqlExpressPort = detectSqlExpressPortWindows(sqlServerInstance);
const portCandidates = [...new Set([configuredPort, ...configuredPorts, detectedSqlExpressPort, 1433].filter((value) => Number.isFinite(value) && value > 0))];

const instanceCandidates = hostCandidates.map((server) => ({
  ...baseAuth,
  server,
  options: {
    ...baseAuth.options,
    instanceName: sqlServerInstance,
  },
}));

const hostPortCandidates = hostCandidates.flatMap((server) => (
  portCandidates.map((port) => ({
    ...baseAuth,
    server,
    port,
  }))
));

const connectionCandidates = [...instanceCandidates, ...hostPortCandidates];

let pool = null;
let selectedConfig = null;
let lastAttemptAt = 0;
let lastFailure = null;

async function ensureSchema(activePool) {
  await activePool.request().query(`
    IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Users (
        Id NVARCHAR(128) NOT NULL PRIMARY KEY,
        Name NVARCHAR(150) NOT NULL,
        Email NVARCHAR(200) NOT NULL UNIQUE,
        PasswordHash NVARCHAR(256) NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END;
  `);

  await activePool.request().query(`
    IF COL_LENGTH(N'dbo.Users', N'PasswordHash') IS NULL
    BEGIN
      ALTER TABLE dbo.Users ADD PasswordHash NVARCHAR(256) NULL;
    END;
  `);

  await activePool.request().query(`
    UPDATE dbo.Users SET PasswordHash = '' WHERE PasswordHash IS NULL;
  `);

  await activePool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Users_Email' AND object_id = OBJECT_ID(N'dbo.Users'))
    BEGIN
      BEGIN TRY
        CREATE UNIQUE INDEX UX_Users_Email ON dbo.Users(Email);
      END TRY
      BEGIN CATCH
      END CATCH
    END;
  `);

  await activePool.request().query(`
    IF OBJECT_ID(N'dbo.Chats', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Chats (
        Id NVARCHAR(128) NOT NULL PRIMARY KEY,
        UserId NVARCHAR(128) NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END;
  `);

  await activePool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Chats_UserId' AND object_id = OBJECT_ID(N'dbo.Chats'))
    BEGIN
      CREATE INDEX IX_Chats_UserId ON dbo.Chats(UserId);
    END;
  `);

  await activePool.request().query(`
    IF OBJECT_ID(N'dbo.FK_Chats_Users', N'F') IS NULL
    BEGIN
      BEGIN TRY
        ALTER TABLE dbo.Chats WITH NOCHECK
        ADD CONSTRAINT FK_Chats_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id);
      END TRY
      BEGIN CATCH
      END CATCH
    END;
  `);

  await activePool.request().query(`
    IF OBJECT_ID(N'dbo.Messages', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Messages (
        Id NVARCHAR(128) NOT NULL PRIMARY KEY,
        ChatId NVARCHAR(128) NOT NULL,
        Role NVARCHAR(20) NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        [Timestamp] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END;
  `);

  await activePool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Messages_ChatId_Timestamp' AND object_id = OBJECT_ID(N'dbo.Messages'))
    BEGIN
      CREATE INDEX IX_Messages_ChatId_Timestamp ON dbo.Messages(ChatId, [Timestamp]);
    END;
  `);

  await activePool.request().query(`
    IF OBJECT_ID(N'dbo.FK_Messages_Chats', N'F') IS NULL
    BEGIN
      BEGIN TRY
        ALTER TABLE dbo.Messages WITH NOCHECK
        ADD CONSTRAINT FK_Messages_Chats FOREIGN KEY (ChatId) REFERENCES dbo.Chats(Id);
      END TRY
      BEGIN CATCH
      END CATCH
    END;
  `);
}

export async function getDbPool() {
  if (pool) return pool;

  const now = Date.now();
  if (lastFailure && (now - lastAttemptAt) < 15000) return null;
  lastAttemptAt = now;

  for (const candidate of connectionCandidates) {
    try {
      const connected = await sql.connect(candidate);
      await ensureSchema(connected);
      pool = connected;
      selectedConfig = candidate;
      lastFailure = null;
      return pool;
    } catch (error) {
      lastFailure = error;
    }
  }

  return null;
}

export function getDbInfo() {
  if (!selectedConfig) {
    return {
      connected: false,
      server: null,
      database: baseAuth.database,
      instanceName: sqlServerInstance,
      port: null,
      detectedSqlExpressPort,
      configuredHosts: hostCandidates,
      configuredPorts: portCandidates,
      lastError: lastFailure?.message || null,
    };
  }

  return {
    connected: true,
    server: selectedConfig.server,
    database: selectedConfig.database,
    instanceName: selectedConfig.options?.instanceName || null,
    port: selectedConfig.port || null,
    detectedSqlExpressPort,
    configuredHosts: hostCandidates,
    configuredPorts: portCandidates,
  };
}

export { sql };
