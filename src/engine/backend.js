/**
 * Storage Backends for State Machine & Audit Records
 * Supports in-memory (zero-dependency) and local filesystem persistence.
 */

import fs from 'node:fs';
import path from 'node:path';
import { AuditLogger } from '../audit.js';

export class MemoryBackend {
  constructor() {
    this.tasks = new Map();
    this.reviews = new Map();
    this.reports = new Map();
    this.events = [];
  }

  async createTask(task) {
    if (!task.task_id) {
      task.task_id = `TASK_${Date.now()}`;
    }
    if (!task.status) {
      task.status = 'ACTIVE';
    }
    task.created_at = new Date().toISOString();
    task.updated_at = task.created_at;
    this.tasks.set(task.task_id, { ...task });
    return { ...task };
  }

  async getTask(taskId) {
    const t = this.tasks.get(taskId);
    return t ? { ...t } : null;
  }

  async updateTask(taskId, updates) {
    const t = this.tasks.get(taskId);
    if (!t) {
      throw new Error(`Task ${taskId} not found.`);
    }
    const updated = { ...t, ...updates, updated_at: new Date().toISOString() };
    this.tasks.set(taskId, updated);
    return { ...updated };
  }

  async listTasks(filter = {}) {
    let list = Array.from(this.tasks.values());
    if (filter.status) {
      list = list.filter(t => t.status === filter.status);
    }
    if (filter.role) {
      list = list.filter(t => t.role === filter.role);
    }
    return list.map(t => ({ ...t }));
  }

  async addReview(taskId, review) {
    if (!this.reviews.has(taskId)) {
      this.reviews.set(taskId, []);
    }
    const rev = {
      ...review,
      id: `REV_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      taskId,
      created_at: new Date().toISOString()
    };
    this.reviews.get(taskId).push(rev);
    return rev;
  }

  async getReviews(taskId) {
    return (this.reviews.get(taskId) || []).map(r => ({ ...r }));
  }

  async addReport(taskId, report) {
    if (!this.reports.has(taskId)) {
      this.reports.set(taskId, []);
    }
    const rep = {
      ...report,
      id: `REP_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      taskId,
      created_at: new Date().toISOString()
    };
    this.reports.get(taskId).push(rep);
    return rep;
  }

  async getReports(taskId) {
    return (this.reports.get(taskId) || []).map(r => ({ ...r }));
  }

  async recordEvent(event) {
    const entry = {
      id: `EVT_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...event
    };
    this.events.push(entry);
    return entry;
  }

  async getEvents(taskId = null) {
    if (taskId) {
      return this.events.filter(e => e.taskId === taskId);
    }
    return [...this.events];
  }
}

export class FileBackend extends MemoryBackend {
  constructor(storageDir = path.join(process.cwd(), '.ai-governor')) {
    super();
    this.storageDir = storageDir;
    this.dataFile = path.join(this.storageDir, 'state.json');
    this.auditLogger = new AuditLogger({ storageDir: this.storageDir });
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, 'utf-8');
        const data = JSON.parse(raw);
        if (data.tasks) {
          this.tasks = new Map(Object.entries(data.tasks));
        }
        if (data.reviews) {
          this.reviews = new Map(Object.entries(data.reviews));
        }
        if (data.reports) {
          this.reports = new Map(Object.entries(data.reports));
        }
        if (Array.isArray(data.events)) {
          this.events = data.events;
        }
      }
    } catch {
      // Fallback to empty in-memory state on parse error
    }
  }

  save() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
      const data = {
        tasks: Object.fromEntries(this.tasks),
        reviews: Object.fromEntries(this.reviews),
        reports: Object.fromEntries(this.reports),
        events: this.events
      };
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Ignore write errors in restricted environments
    }
  }

  async createTask(task) {
    const res = await super.createTask(task);
    this.save();
    return res;
  }

  async updateTask(taskId, updates) {
    const res = await super.updateTask(taskId, updates);
    this.save();
    return res;
  }

  async addReview(taskId, review) {
    const res = await super.addReview(taskId, review);
    this.save();
    return res;
  }

  async addReport(taskId, report) {
    const res = await super.addReport(taskId, report);
    this.save();
    return res;
  }

  async recordEvent(event) {
    const res = await super.recordEvent(event);
    this.save();
    this.auditLogger.log(event);
    return res;
  }
}

