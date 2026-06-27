import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const examplePath = path.join(root, 'schoolsoft.config.example.json');
const appSlug = 'schoolsoft-calendar-helper';

export function projectRoot() {
  return root;
}

export function isDesktopMode() {
  return /^(1|true|yes)$/i.test(String(process.env.SCHOOLSOFT_DESKTOP || process.env.SCHOOLSOFT_USE_APP_DATA || '')) || Boolean(process.env.SCHOOLSOFT_DATA_DIR);
}

export function appDataRoot() {
  if (process.env.SCHOOLSOFT_DATA_DIR) return path.resolve(process.env.SCHOOLSOFT_DATA_DIR);
  if (!isDesktopMode()) return root;
  const home = os.homedir();
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), appSlug);
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support', appSlug);
  return path.join(process.env.XDG_DATA_HOME || path.join(home, '.local', 'share'), appSlug);
}

export function loadConfig() {
  const configPath = resolveDataPath('schoolsoft.config.json');
  const raw = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, 'utf8')
    : fs.readFileSync(examplePath, 'utf8');
  const cfg = JSON.parse(raw);
  return normalizeConfig(cfg);
}

export function readRawConfig() {
  const configPath = resolveDataPath('schoolsoft.config.json');
  const raw = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, 'utf8')
    : fs.readFileSync(examplePath, 'utf8');
  return JSON.parse(raw);
}

export function saveConfigPatch(patch) {
  ensureDirs();
  const configPath = resolveDataPath('schoolsoft.config.json');
  const current = readRawConfig();
  const next = { ...current, ...patch };
  fs.writeFileSync(configPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return normalizeConfig(next);
}

function normalizeConfig(cfg) {
  return {
    baseUrl: cfg.baseUrl || 'https://sms.schoolsoft.se/engelska/',
    loginUrl: cfg.loginUrl || cfg.baseUrl || 'https://sms.schoolsoft.se/engelska/jsp/Login.jsp',
    timezone: cfg.timezone || 'Europe/Stockholm',
    lookAheadWeeks: Number(cfg.lookAheadWeeks ?? 20),
    lookBackWeeks: Number(cfg.lookBackWeeks ?? 26),
    lookAheadMonths: Number(cfg.lookAheadMonths ?? Math.ceil(Number(cfg.lookAheadWeeks ?? 20) / 4.35)),
    lookBackMonths: Number(cfg.lookBackMonths ?? 5),
    syncIntervalMinutes: Number(cfg.syncIntervalMinutes ?? 360),
    provschemaUrl: cfg.provschemaUrl || '',
    calendarUrl: cfg.calendarUrl || '',
    icalUrl: cfg.icalUrl || '',
    studentNames: Array.isArray(cfg.studentNames) ? cfg.studentNames : [],
    assessmentKeywords: Array.isArray(cfg.assessmentKeywords) ? cfg.assessmentKeywords : [],
    ignoreKeywords: Array.isArray(cfg.ignoreKeywords) ? cfg.ignoreKeywords : [],
    headless: Boolean(cfg.headless),
    slowMoMs: Number(cfg.slowMoMs ?? 80)
  };
}

export function resolveProjectPath(...parts) {
  return path.join(root, ...parts);
}

export function resolveDataPath(...parts) {
  return path.join(appDataRoot(), ...parts);
}

export function ensureDirs() {
  for (const dir of [resolveDataPath('data'), resolveDataPath('snapshots'), resolveDataPath('.playwright-user-data')]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
