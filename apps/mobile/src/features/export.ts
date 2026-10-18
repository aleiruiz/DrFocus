import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { buildPilotExport } from '@drfocus/domain';
import { db, schema as s } from '@/db/client';
import * as repo from '@/db/repo';
import { clearToken } from './agent';
import { toExportActivity, toExportEvent, toExportObjective } from './export-rows';
import { rescheduleReminders } from './reminders';

/** Genera los archivos JSON y CSV del piloto (TECH_SPEC §5) y devuelve sus rutas. */
export function writePilotExport(includeText: boolean): { json: File; csv: File } {
  const prefs = repo.getPrefs();
  const stamp = new Date().toISOString();
  const { json, csv } = buildPilotExport({
    participantAlias: prefs?.participantAlias ?? 'sin-alias',
    exportedAt: stamp,
    appVersion: Constants.expoConfig?.version ?? '0.0.0',
    includeText,
    activities: db.select().from(s.activities).all().map(toExportActivity),
    objectives: db.select().from(s.objectives).all().map(toExportObjective),
    events: db.select().from(s.localEvents).all().map(toExportEvent),
  });
  const base = `doctor-focus-${prefs?.participantAlias ?? 'datos'}-${stamp.slice(0, 10)}`;
  const jsonFile = new File(Paths.cache, `${base}.json`);
  const csvFile = new File(Paths.cache, `${base}.csv`);
  for (const f of [jsonFile, csvFile]) if (f.exists) f.delete();
  jsonFile.create();
  jsonFile.write(json);
  csvFile.create();
  csvFile.write(csv);
  return { json: jsonFile, csv: csvFile };
}

export async function shareFile(file: File, mimeType: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este teléfono no permite compartir archivos.');
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: 'Compartir datos del piloto' });
}

/** Borrado total (TECH_SPEC §9): borra tablas locales, token y exportaciones; cancela los avisos programados. */
export async function wipeEverything() {
  repo.wipeAll();
  await clearToken();
  // Sin preferencias, la reprogramación serializada solo cancela todo.
  await rescheduleReminders();
  for (const item of Paths.cache.list()) if (item instanceof File && /^doctor-focus-.*\.(json|csv)$/.test(item.name)) item.delete();
}
