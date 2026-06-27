import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const configPath = path.join(root, 'schoolsoft.config.json');
const examplePath = path.join(root, 'schoolsoft.config.example.json');

export function projectRoot() {
  return root;
}

export function loadConfig() {
  const raw = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, 'utf8')
    : fs.readFileSync(examplePath, 'utf8');
  const cfg = JSON.parse(raw);
  return normalizeConfig(cfg);
}

export function readRawConfig() {
  const raw = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, 'utf8')
    : fs.readFileSync(examplePath, 'utf8');
  return JSON.parse(raw);
}

export function saveConfigPatch(patch) {
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

export function ensureDirs() {
  for (const dir of ['data', 'snapshots', '.playwright-user-data']) {
    fs.mkdirSync(resolveProjectPath(dir), { recursive: true });
  }
}
