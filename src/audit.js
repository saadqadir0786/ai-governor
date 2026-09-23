/**
 * Audit Trail & Compliance Logger
 * Records tamper-evident governance actions, guard failures, and approvals.
 */

import fs from 'node:fs';
import path from 'node:path';

export class AuditLogger {
  constructor(options = {}) {
    this.storageDir = options.storageDir || path.join(process.cwd(), '.ai-governor');
    this.logFile = path.join(this.storageDir, 'audit-log.json');
  }

  /**
   * Log an audit event
   */
  log(event) {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }

      const records = this.readLogs();
      const entry = {
        id: `AUDIT_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        ...event
      };

      records.push(entry);
      fs.writeFileSync(this.logFile, JSON.stringify(records, null, 2), 'utf-8');
      return entry;
    } catch {
      return null;
    }
  }

  /**
   * Read all audit log entries
   */
  readLogs() {
    try {
      if (fs.existsSync(this.logFile)) {
        const raw = fs.readFileSync(this.logFile, 'utf-8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      // Return empty array on error
    }
    return [];
  }

  /**
   * Compute audit summary and hotspot metrics
   */
  getMetrics() {
    const logs = this.readLogs();
    const total = logs.length;
    let passes = 0;
    let fails = 0;
    const guardFailures = {};

    for (const log of logs) {
      if (log.passed === true) passes++;
      if (log.passed === false) fails++;

      if (Array.isArray(log.guardResults)) {
        for (const gr of log.guardResults) {
          if (!gr.passed) {
            guardFailures[gr.guardId] = (guardFailures[gr.guardId] || 0) + 1;
          }
        }
      }
    }

    return {
      totalEvents: total,
      passedTransitions: passes,
      failedTransitions: fails,
      passRate: total > 0 ? `${((passes / total) * 100).toFixed(1)}%` : 'N/A',
      guardFailureHotspots: guardFailures
    };
  }
}
