import { readFileSync, existsSync } from 'fs';
import initSqlJs from 'sql.js';

const SALES_DASHBOARD_DB_PATH = '/home/hamidreza/App/sales-mission-manager/backend/data/shared.db';

let sqlModulePromise = null;

async function getSqlModule() {
  if (!sqlModulePromise) {
    sqlModulePromise = initSqlJs();
  }
  return sqlModulePromise;
}

export async function getCenterStatusHistory(centerId, limit = 10) {
  if (!centerId) {
    return [];
  }

  try {
    if (!existsSync(SALES_DASHBOARD_DB_PATH)) {
      return [];
    }

    const SQL = await getSqlModule();
    const fileBuffer = readFileSync(SALES_DASHBOARD_DB_PATH);
    const db = new SQL.Database(fileBuffer);

    const stmt = db.prepare(`
      SELECT previous_status AS previousStatus,
             new_status AS newStatus,
             changed_at AS changedAt
        FROM center_status_history
       WHERE center_id = ?
       ORDER BY datetime(changed_at) ASC
    `);

    stmt.bind([centerId]);
    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        previousStatus: row.previousStatus,
        newStatus: row.newStatus,
        changedAt: row.changedAt
      });
    }

    stmt.free();
    db.close();

    if (limit && results.length > limit) {
      return results.slice(-limit);
    }
    return results;
  } catch (error) {
    console.error('[StatusHistoryService] Failed to load status history:', error);
    return [];
  }
}
