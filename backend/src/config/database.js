import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;

export const connectDB = async () => {
  try {
    // تعیین مسیر فایل دیتابیس مشترک
    const dbDir = process.env.DB_PATH || join(__dirname, '../../data');
    const dbPath = join(dbDir, 'shared.db');

    // ایجاد پوشه data در صورت عدم وجود
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
      console.log(`📁 پوشه دیتابیس ایجاد شد: ${dbDir}`);
    }

    // باز کردن دیتابیس مشترک با sqlite3
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // فعال کردن Foreign Keys
    await db.exec('PRAGMA foreign_keys = ON');
    
    // فعال کردن WAL mode برای بهبود concurrency
    await db.exec('PRAGMA journal_mode = WAL');
    
    // تنظیم synchronous mode
    await db.exec('PRAGMA synchronous = NORMAL');
    
    // تنظیم cache size
    await db.exec('PRAGMA cache_size = 10000');

    console.log('✅ SQLite database connected successfully');
    console.log(`📊 دیتابیس مشترک: ${dbPath}`);
    
    // بررسی و migration در صورت نیاز
    await checkAndMigrate();
    
    return db;
  } catch (error) {
    console.error('❌ SQLite connection error:', error);
    process.exit(1);
  }
};

export const getDB = () => {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB() first.');
  }
  return db;
};

const checkAndMigrate = async () => {
  try {
    // بررسی وجود جداول mission_* در دیتابیس مشترک
    const tables = await db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name LIKE 'mission_%'
    `);
    
    if (tables.length === 0) {
      console.log('⚠️  جداول mission_* پیدا نشدند. لطفاً migration را اجرا کنید.');
      return;
    }

    // بررسی و اضافه کردن فیلدهای جدید به mission_assignments
    const tableInfo = await db.all('PRAGMA table_info(mission_assignments)');
    const columns = tableInfo.map(col => col.name);
    
    // اضافه کردن centerNotes
    if (!columns.includes('centerNotes')) {
      console.log('➕ اضافه کردن فیلد centerNotes به mission_assignments...');
      await db.exec('ALTER TABLE mission_assignments ADD COLUMN centerNotes TEXT');
    }
    
    // اضافه کردن managerComment
    if (!columns.includes('managerComment')) {
      console.log('➕ اضافه کردن فیلد managerComment به mission_assignments...');
      await db.exec('ALTER TABLE mission_assignments ADD COLUMN managerComment TEXT');
    }
    
    // اضافه کردن discountCodeId
    if (!columns.includes('discountCodeId')) {
      console.log('➕ اضافه کردن فیلد discountCodeId به mission_assignments...');
      await db.exec('ALTER TABLE mission_assignments ADD COLUMN discountCodeId INTEGER');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_mission_assignments_discount_code ON mission_assignments(discountCodeId)');
    }
    
    // بررسی و اضافه کردن فیلد tags به centers
    const centersTableInfo = await db.all('PRAGMA table_info(centers)');
    const centersColumns = centersTableInfo.map(col => col.name);
    
    if (!centersColumns.includes('tags')) {
      console.log('➕ اضافه کردن فیلد tags به centers...');
      await db.exec('ALTER TABLE centers ADD COLUMN tags TEXT');
    }
    
    // بررسی و اضافه کردن فیلد province به centers
    if (!centersColumns.includes('province')) {
      console.log('➕ اضافه کردن فیلد province به centers...');
      await db.exec('ALTER TABLE centers ADD COLUMN province TEXT');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_centers_province ON centers(province)');
    }
    
    // بررسی و اضافه کردن فیلد email به personnel
    const personnelTableInfo = await db.all('PRAGMA table_info(personnel)');
    const personnelColumns = personnelTableInfo.map(col => col.name);
    
    if (!personnelColumns.includes('email')) {
      console.log('➕ اضافه کردن فیلد email به personnel...');
      await db.exec('ALTER TABLE personnel ADD COLUMN email TEXT');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_personnel_email ON personnel(email)');
    }

    // بررسی و به‌روزرسانی CHECK constraint برای role (اضافه کردن super_admin)
    // SQLite نمی‌تواند CHECK constraint را مستقیماً تغییر دهد، پس باید جدول را بازسازی کنیم
    // اما برای جلوگیری از از دست رفتن داده‌ها، فقط اگر super_admin در constraint نیست، آن را اضافه می‌کنیم
    // در SQLite، بهتر است constraint را نادیده بگیریم و در application level بررسی کنیم
    // یا می‌توانیم یک migration script بنویسیم که جدول را بازسازی کند
    // برای حالا، constraint را در application level بررسی می‌کنیم
    
    // بررسی وجود جدول mission_contacts
    const contactsCheck = await db.get(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='mission_contacts'
    `);
    
    if (!contactsCheck) {
      console.log('➕ ایجاد جدول mission_contacts...');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS mission_contacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          personnelId INTEGER NOT NULL,
          centerId INTEGER NOT NULL,
          contactType TEXT NOT NULL DEFAULT 'province' CHECK(contactType IN ('province', 'tehran')),
          notes TEXT,
          tags TEXT,
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (personnelId) REFERENCES personnel(id),
          FOREIGN KEY (centerId) REFERENCES centers(id)
        )
      `);
    }
    
    // بررسی و ایجاد indexes برای بهبود عملکرد
    await ensureIndexes();
    await ensureWorkflowTables();
    await ensurePermissionTables();
    
    console.log('✅ Migration checks completed');
  } catch (error) {
    console.error('❌ Migration error:', error);
  }
};

// تابع برای اطمینان از وجود indexes
const ensureIndexes = async () => {
  try {
    console.log('🔍 بررسی و ایجاد indexes...');
    
    // Indexes برای mission_assignments
    await db.exec('CREATE INDEX IF NOT EXISTS idx_mission_assignments_personnel ON mission_assignments(personnelId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_mission_assignments_center ON mission_assignments(centerId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_mission_assignments_status ON mission_assignments(status)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_mission_assignments_created_at ON mission_assignments(createdAt)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_mission_assignments_manager ON mission_assignments(managerId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_mission_assignments_discount_code ON mission_assignments(discountCodeId)');
    
    // Indexes برای centers
    await db.exec('CREATE INDEX IF NOT EXISTS idx_centers_responsible ON centers(responsiblePersonnelId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_centers_city ON centers(city)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_centers_type ON centers(type)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_centers_isActive ON centers(isActive)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_centers_name ON centers(name)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_centers_province ON centers(province)');
    
    // Indexes برای personnel
    await db.exec('CREATE INDEX IF NOT EXISTS idx_personnel_phone ON personnel(phone)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_personnel_telegramId ON personnel(telegramId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_personnel_role ON personnel(role)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_personnel_isActive ON personnel(isActive)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_personnel_email ON personnel(email)');
    
    // Indexes برای mission_discount_codes
    await db.exec('CREATE INDEX IF NOT EXISTS idx_mission_discount_codes_code ON mission_discount_codes(code)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_mission_discount_codes_active ON mission_discount_codes(isActive)');
    
    // Indexes برای mission_audit_logs
    await db.exec('CREATE INDEX IF NOT EXISTS idx_mission_audit_logs_user ON mission_audit_logs(userId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_mission_audit_logs_created ON mission_audit_logs(createdAt)');
    
    // Indexes برای mission_contacts
    await db.exec('CREATE INDEX IF NOT EXISTS idx_mission_contacts_personnel ON mission_contacts(personnelId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_mission_contacts_center ON mission_contacts(centerId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_mission_contacts_type ON mission_contacts(contactType)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_mission_contacts_created_at ON mission_contacts(createdAt)');
    
    console.log('✅ Indexes بررسی و ایجاد شدند');
  } catch (error) {
    console.error('❌ Error ensuring indexes:', error);
  }
};

const ensureWorkflowTables = async () => {
  try {
    console.log('🧩 بررسی و ایجاد جداول workflow...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_boards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        scope TEXT NOT NULL DEFAULT 'global',
        centerFilter TEXT,
        typeFilter TEXT,
        isActive INTEGER NOT NULL DEFAULT 1,
        meta TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        boardId INTEGER NOT NULL,
        key TEXT NOT NULL,
        title TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        statusCategory TEXT NOT NULL DEFAULT 'backlog',
        isDefault INTEGER NOT NULL DEFAULT 0,
        meta TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (boardId) REFERENCES workflow_boards(id) ON DELETE CASCADE
      )
    `);
    await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_lists_board_key ON workflow_lists(boardId, key)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workflow_lists_board_position ON workflow_lists(boardId, position)');

    await db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        boardId INTEGER NOT NULL,
        listId INTEGER NOT NULL,
        entityType TEXT,
        entityId INTEGER,
        centerId INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT NOT NULL DEFAULT 'normal',
        assigneeId INTEGER,
        dueDate TEXT,
        reminderAt TEXT,
        tags TEXT,
        meta TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (boardId) REFERENCES workflow_boards(id) ON DELETE CASCADE,
        FOREIGN KEY (listId) REFERENCES workflow_lists(id) ON DELETE CASCADE,
        FOREIGN KEY (centerId) REFERENCES centers(id),
        FOREIGN KEY (assigneeId) REFERENCES personnel(id)
      )
    `);
    
    // Migration: Add notes and reminderAt columns if they don't exist
    let tableInfo = await db.all(`PRAGMA table_info(workflow_cards)`);
    const hasNotes = tableInfo.some((col) => col.name === 'notes');
    const hasReminderAt = tableInfo.some((col) => col.name === 'reminderAt');
    
    if (!hasNotes) {
      await db.exec(`ALTER TABLE workflow_cards ADD COLUMN notes TEXT`);
    }
    if (!hasReminderAt) {
      await db.exec(`ALTER TABLE workflow_cards ADD COLUMN reminderAt TEXT`);
    }
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workflow_cards_board ON workflow_cards(boardId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workflow_cards_list ON workflow_cards(listId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workflow_cards_entity ON workflow_cards(entityType, entityId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workflow_cards_center ON workflow_cards(centerId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workflow_cards_reminder ON workflow_cards(reminderAt)');

    // User Workspaces - هر کارمند می‌تواند چند workspace/board داشته باشد
    await db.exec(`
      CREATE TABLE IF NOT EXISTS user_workspaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        personnelId INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#3B82F6',
        icon TEXT DEFAULT '📋',
        isDefault INTEGER NOT NULL DEFAULT 0,
        isActive INTEGER NOT NULL DEFAULT 1,
        settings TEXT,
        filters TEXT,
        viewSettings TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (personnelId) REFERENCES personnel(id) ON DELETE CASCADE
      )
    `);
    await db.exec('CREATE INDEX IF NOT EXISTS idx_user_workspaces_personnel ON user_workspaces(personnelId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_user_workspaces_personnel_default ON user_workspaces(personnelId, isDefault)');
    
    // Migration: Add filters and viewSettings columns if they don't exist
    let workspaceTableInfo = await db.all(`PRAGMA table_info(user_workspaces)`);
    const hasFilters = workspaceTableInfo.some((col) => col.name === 'filters');
    const hasViewSettings = workspaceTableInfo.some((col) => col.name === 'viewSettings');
    
    if (!hasFilters) {
      await db.exec(`ALTER TABLE user_workspaces ADD COLUMN filters TEXT`);
    }
    if (!hasViewSettings) {
      await db.exec(`ALTER TABLE user_workspaces ADD COLUMN viewSettings TEXT`);
    }

    // Workspace Tags - برچسب‌های سفارشی برای workspace
    await db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspaceId INTEGER NOT NULL,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#3B82F6',
        category TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (workspaceId) REFERENCES user_workspaces(id) ON DELETE CASCADE
      )
    `);
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workspace_tags_workspace ON workspace_tags(workspaceId)');
    await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_tags_unique ON workspace_tags(workspaceId, name)');

    // Workspace Notes - یادداشت‌های workspace
    await db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspaceId INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        tags TEXT,
        isPinned INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (workspaceId) REFERENCES user_workspaces(id) ON DELETE CASCADE
      )
    `);
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workspace_notes_workspace ON workspace_notes(workspaceId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workspace_notes_pinned ON workspace_notes(workspaceId, isPinned)');

    // Notifications System - سیستم نوتیفیکیشن
    await db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        personnelId INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error', 'mission', 'contact', 'approval', 'reminder')),
        entityType TEXT,
        entityId INTEGER,
        isRead INTEGER NOT NULL DEFAULT 0,
        actionUrl TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        readAt TEXT,
        FOREIGN KEY (personnelId) REFERENCES personnel(id) ON DELETE CASCADE
      )
    `);
    await db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_personnel ON notifications(personnelId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(isRead)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(createdAt DESC)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entityType, entityId)');

    // Reminders System - سیستم یادآوری
    await db.exec(`
      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        personnelId INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        entityType TEXT,
        entityId INTEGER,
        reminderAt TEXT NOT NULL,
        isCompleted INTEGER NOT NULL DEFAULT 0,
        completedAt TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (personnelId) REFERENCES personnel(id) ON DELETE CASCADE
      )
    `);
    await db.exec('CREATE INDEX IF NOT EXISTS idx_reminders_personnel ON reminders(personnelId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_reminders_completed ON reminders(isCompleted)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_reminders_reminder_at ON reminders(reminderAt)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_reminders_entity ON reminders(entityType, entityId)');

    // Workspace Goals - اهداف و KPI برای workspace
    await db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspaceId INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        targetValue REAL,
        currentValue REAL DEFAULT 0,
        unit TEXT DEFAULT 'عدد',
        deadline TEXT,
        isCompleted INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (workspaceId) REFERENCES user_workspaces(id) ON DELETE CASCADE
      )
    `);
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workspace_goals_workspace ON workspace_goals(workspaceId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workspace_goals_deadline ON workspace_goals(deadline)');

    // Workspace Shares - اشتراک‌گذاری workspace با دیگران
    await db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspaceId INTEGER NOT NULL,
        sharedWithPersonnelId INTEGER NOT NULL,
        permission TEXT NOT NULL DEFAULT 'read',
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (workspaceId) REFERENCES user_workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (sharedWithPersonnelId) REFERENCES personnel(id) ON DELETE CASCADE
      )
    `);
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workspace_shares_workspace ON workspace_shares(workspaceId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workspace_shares_personnel ON workspace_shares(sharedWithPersonnelId)');
    await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_shares_unique ON workspace_shares(workspaceId, sharedWithPersonnelId)');

    // Workspace Assignment Tags - ارتباط برچسب‌ها با ماموریت‌ها
    await db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_assignment_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspaceId INTEGER NOT NULL,
        assignmentId INTEGER NOT NULL,
        tagId INTEGER NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (workspaceId) REFERENCES user_workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (assignmentId) REFERENCES mission_assignments(id) ON DELETE CASCADE,
        FOREIGN KEY (tagId) REFERENCES workspace_tags(id) ON DELETE CASCADE
      )
    `);
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workspace_assignment_tags_workspace ON workspace_assignment_tags(workspaceId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workspace_assignment_tags_assignment ON workspace_assignment_tags(assignmentId)');
    await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_assignment_tags_unique ON workspace_assignment_tags(workspaceId, assignmentId, tagId)');

    // Workspace Center Tags - ارتباط برچسب‌ها با مراکز
    await db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_center_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspaceId INTEGER NOT NULL,
        centerId INTEGER NOT NULL,
        tagId INTEGER NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (workspaceId) REFERENCES user_workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (centerId) REFERENCES centers(id) ON DELETE CASCADE,
        FOREIGN KEY (tagId) REFERENCES workspace_tags(id) ON DELETE CASCADE
      )
    `);
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workspace_center_tags_workspace ON workspace_center_tags(workspaceId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workspace_center_tags_center ON workspace_center_tags(centerId)');
    await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_center_tags_unique ON workspace_center_tags(workspaceId, centerId, tagId)');

    // Workspace Workflow Board Connection - اتصال workspace به workflow board
    await db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_workflow_boards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspaceId INTEGER NOT NULL,
        workflowBoardId INTEGER NOT NULL,
        isDefault INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (workspaceId) REFERENCES user_workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (workflowBoardId) REFERENCES workflow_boards(id) ON DELETE CASCADE
      )
    `);
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workspace_workflow_boards_workspace ON workspace_workflow_boards(workspaceId)');
    await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_workflow_boards_unique ON workspace_workflow_boards(workspaceId, workflowBoardId)');

    await db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_card_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cardId INTEGER NOT NULL,
        actorId INTEGER,
        action TEXT NOT NULL,
        details TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (cardId) REFERENCES workflow_cards(id) ON DELETE CASCADE,
        FOREIGN KEY (actorId) REFERENCES personnel(id)
      )
    `);
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workflow_card_activity_card ON workflow_card_activity(cardId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workflow_card_activity_actor ON workflow_card_activity(actorId)');

    await db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_card_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cardId INTEGER NOT NULL,
        authorId INTEGER NOT NULL,
        message TEXT NOT NULL,
        taggedPersonnelIds TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (cardId) REFERENCES workflow_cards(id) ON DELETE CASCADE,
        FOREIGN KEY (authorId) REFERENCES personnel(id)
      )
    `);
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workflow_card_reports_card ON workflow_card_reports(cardId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workflow_card_reports_author ON workflow_card_reports(authorId)');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_card_report_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reportId INTEGER NOT NULL,
        cardId INTEGER NOT NULL,
        fileName TEXT NOT NULL,
        originalName TEXT NOT NULL,
        mimeType TEXT,
        size INTEGER,
        path TEXT NOT NULL,
        url TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (reportId) REFERENCES workflow_card_reports(id) ON DELETE CASCADE,
        FOREIGN KEY (cardId) REFERENCES workflow_cards(id) ON DELETE CASCADE
      )
    `);
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workflow_card_report_files_report ON workflow_card_report_files(reportId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_workflow_card_report_files_card ON workflow_card_report_files(cardId)');
    
    // User Activity Logs table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS user_activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        action TEXT NOT NULL,
        resourceType TEXT,
        resourceId INTEGER,
        details TEXT,
        ipAddress TEXT,
        userAgent TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (userId) REFERENCES personnel(id) ON DELETE CASCADE
      )
    `);
    await db.exec('CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user ON user_activity_logs(userId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_user_activity_logs_action ON user_activity_logs(action)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created ON user_activity_logs(createdAt)');
    
    // OTP table for email authentication
    await db.exec(`
      CREATE TABLE IF NOT EXISTS otp_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        token TEXT,
        userId INTEGER,
        purpose TEXT DEFAULT 'login',
        expiresAt TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (userId) REFERENCES personnel(id) ON DELETE CASCADE
      )
    `);
    await db.exec('CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes(email)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_otp_codes_code ON otp_codes(code)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_otp_codes_token ON otp_codes(token)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_otp_codes_expires ON otp_codes(expiresAt)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_otp_codes_user ON otp_codes(userId)');
    
    // 2FA Settings table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS two_factor_auth (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL UNIQUE,
        enabled INTEGER DEFAULT 0,
        method TEXT DEFAULT 'email',
        secret TEXT,
        backupCodes TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (userId) REFERENCES personnel(id) ON DELETE CASCADE
      )
    `);
    await db.exec('CREATE INDEX IF NOT EXISTS idx_two_factor_auth_user ON two_factor_auth(userId)');
    
    // Migration: Add approval status for mission cards
    tableInfo = await db.all(`PRAGMA table_info(workflow_cards)`);
    const hasApprovalStatus = tableInfo.some((col) => col.name === 'approvalStatus');
    if (!hasApprovalStatus) {
      await db.exec(`ALTER TABLE workflow_cards ADD COLUMN approvalStatus TEXT DEFAULT 'pending'`);
    }
    const hasApproverId = tableInfo.some((col) => col.name === 'approverId');
    if (!hasApproverId) {
      await db.exec(`ALTER TABLE workflow_cards ADD COLUMN approverId INTEGER`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_workflow_cards_approver ON workflow_cards(approverId)`);
    }

    await ensureDefaultWorkflowBoard();
    console.log('✅ جداول workflow آماده شدند');
  } catch (error) {
    console.error('❌ خطا در ایجاد جداول workflow:', error);
  }
};

const ensureDefaultWorkflowBoard = async () => {
  const existingBoard = await db.get("SELECT id FROM workflow_boards WHERE slug = 'ops-master'");
  if (existingBoard) {
    return;
  }

  console.log('🆕 ایجاد برد پیش‌فرض workflow (ops-master)...');
  const meta = {
    entityTypes: ['mission', 'contact', 'medical', 'leave', 'report'],
    description: 'برد مرکزی برای رهگیری خودکار مأموریت‌ها و تماس‌ها'
  };

  const result = await db.run(`
    INSERT INTO workflow_boards (slug, name, description, scope, meta)
    VALUES (?, ?, ?, ?, ?)
  `, [
    'ops-master',
    'داشبورد عملیات',
    'برد یکپارچه برای مأموریت‌ها، تماس‌ها و تاییدیه‌ها',
    'global',
    JSON.stringify(meta)
  ]);

  const boardId = result.lastID;
  const defaultLists = [
    { key: 'new', title: 'درخواست جدید', statusCategory: 'backlog', position: 10 },
    { key: 'in_progress', title: 'در حال انجام', statusCategory: 'in_progress', position: 20 },
    { key: 'waiting', title: 'منتظر تایید', statusCategory: 'waiting', position: 30 },
    { key: 'done', title: 'تکمیل شده', statusCategory: 'done', position: 40 }
  ];

  for (const list of defaultLists) {
    await db.run(`
      INSERT INTO workflow_lists (boardId, key, title, position, statusCategory, isDefault, meta)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      boardId,
      list.key,
      list.title,
      list.position,
      list.statusCategory,
      list.key === 'new' ? 1 : 0,
      JSON.stringify({ autoStatus: list.key })
    ]);
  }

  console.log('✅ برد و لیست‌های پیش‌فرض workflow ساخته شد');
};

// تابع برای ایجاد جداول سیستم مدیریت دسترسی پیشرفته
const ensurePermissionTables = async () => {
  try {
    console.log('🔐 بررسی و ایجاد جداول سیستم مدیریت دسترسی...');

    // جدول برای تعریف ماژول‌ها و بخش‌های سیستم
    await db.exec(`
      CREATE TABLE IF NOT EXISTS system_modules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        icon TEXT,
        order_index INTEGER DEFAULT 0,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // جدول برای دسترسی‌های اختصاصی کاربران
    await db.exec(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        moduleKey TEXT NOT NULL,
        permission TEXT NOT NULL,
        granted INTEGER DEFAULT 1,
        grantedBy INTEGER,
        grantedAt TEXT NOT NULL DEFAULT (datetime('now')),
        revokedAt TEXT,
        notes TEXT,
        FOREIGN KEY (userId) REFERENCES personnel(id) ON DELETE CASCADE,
        FOREIGN KEY (grantedBy) REFERENCES personnel(id) ON DELETE SET NULL,
        UNIQUE(userId, moduleKey, permission)
      )
    `);

    // جدول برای لاگ تغییرات دسترسی
    await db.exec(`
      CREATE TABLE IF NOT EXISTS permission_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        moduleKey TEXT NOT NULL,
        permission TEXT NOT NULL,
        action TEXT NOT NULL,
        changedBy INTEGER NOT NULL,
        oldValue TEXT,
        newValue TEXT,
        reason TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (userId) REFERENCES personnel(id) ON DELETE CASCADE,
        FOREIGN KEY (changedBy) REFERENCES personnel(id) ON DELETE CASCADE
      )
    `);

    // ایجاد indexes
    await db.exec('CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(userId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_user_permissions_module ON user_permissions(moduleKey)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_permission_logs_user ON permission_logs(userId)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_permission_logs_changed_by ON permission_logs(changedBy)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_permission_logs_created ON permission_logs(createdAt)');

    // اضافه کردن ستون role به personnel اگر وجود ندارد (برای super_admin)
    const personnelTableInfo = await db.all('PRAGMA table_info(personnel)');
    const hasSuperAdminRole = personnelTableInfo.some(col => col.name === 'role' && col.type === 'TEXT');
    
    // بررسی و اضافه کردن ماژول‌های پیش‌فرض
    const existingModules = await db.all('SELECT key FROM system_modules');
    const existingKeys = existingModules.map(m => m.key);

    const defaultModules = [
      { key: 'dashboard', name: 'داشبورد', category: 'main', icon: 'LayoutDashboard', order_index: 1 },
      { key: 'missions', name: 'ماموریت‌ها', category: 'operations', icon: 'Briefcase', order_index: 2 },
      { key: 'contacts', name: 'تماس‌ها', category: 'operations', icon: 'Users', order_index: 3 },
      { key: 'centers', name: 'مراکز', category: 'operations', icon: 'Building', order_index: 4 },
      { key: 'personnel', name: 'کارمندان', category: 'management', icon: 'UserCog', order_index: 5 },
      { key: 'reports', name: 'گزارش‌ها', category: 'reports', icon: 'FileText', order_index: 6 },
      { key: 'sales-analysis', name: 'آنالیز فروش', category: 'reports', icon: 'TrendingUp', order_index: 7 },
      { key: 'ez-dashboard', name: 'داشبورد EZ', category: 'operations', icon: 'ShoppingCart', order_index: 8 },
      { key: 'leave-management', name: 'مدیریت مرخصی', category: 'hr', icon: 'Calendar', order_index: 9 },
      { key: 'medical-files', name: 'پرونده‌های پزشکی', category: 'hr', icon: 'FileMedical', order_index: 10 },
      { key: 'recruitment', name: 'استخدام', category: 'hr', icon: 'UserPlus', order_index: 11 },
      { key: 'workflow', name: 'گردش کار', category: 'operations', icon: 'Workflow', order_index: 12 },
      { key: 'settings', name: 'تنظیمات', category: 'system', icon: 'Settings', order_index: 13 },
      { key: 'permissions', name: 'سطح دسترسی', category: 'system', icon: 'Shield', order_index: 14 },
      { key: 'activity-logs', name: 'لاگ فعالیت‌ها', category: 'system', icon: 'History', order_index: 15 }
    ];

    for (const module of defaultModules) {
      if (!existingKeys.includes(module.key)) {
        await db.run(
          `INSERT INTO system_modules (key, name, description, category, icon, order_index, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [module.key, module.name, module.description || '', module.category, module.icon, module.order_index]
        );
      }
    }

    console.log('✅ جداول سیستم مدیریت دسترسی آماده شدند');
  } catch (error) {
    console.error('❌ خطا در ایجاد جداول سیستم مدیریت دسترسی:', error);
  }
};

// Graceful shutdown
// Temporarily disabled to debug crash
// process.on('SIGINT', async () => {
//   if (db) {
//     await db.close();
//     console.log('✅ SQLite connection closed');
//     process.exit(0);
//   }
// });

// process.on('SIGTERM', async () => {
//   if (db) {
//     await db.close();
//     console.log('✅ SQLite connection closed');
//     process.exit(0);
//   }
// });
