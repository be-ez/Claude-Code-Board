import { Database } from '../database';
import { logger } from '../../utils/logger';

/**
 * 遷移資料庫 messages 表的 role 欄位為 type 欄位
 * 統一 WebSocket 即時訊息與 API 載入訊息的格式
 */
export class MigrateRoleToTypeMigration {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async up(): Promise<void> {
    logger.info('=== 開始執行 role → type 遷移 ===');

    try {
      // 1. 檢查 type 欄位是否已存在
      const hasTypeColumn = await this.checkColumnExists('messages', 'type');
      
      if (hasTypeColumn) {
        logger.info('type 欄位已存在，跳過遷移');
        return;
      }

      // 2. 新增 type 欄位
      await this.addTypeColumn();

      // 3. 遷移現有資料
      await this.migrateData();

      // 4. 更新約束條件
      await this.updateConstraints();

      // 5. 驗證遷移結果
      await this.validateMigration();

      logger.info('=== role → type 遷移完成 ===');
    } catch (error) {
      logger.error('遷移失敗:', error);
      throw error;
    }
  }

  async down(): Promise<void> {
    logger.info('=== 開始執行 type → role 回滾 ===');

    try {
      // 回滾：移除 type 欄位，保留 role 欄位
      const hasTypeColumn = await this.checkColumnExists('messages', 'type');
      
      if (hasTypeColumn) {
        // SQLite 不支援 DROP COLUMN，需要重建表
        await this.rebuildTableWithoutType();
        logger.info('=== type → role 回滾完成 ===');
      } else {
        logger.info('type 欄位不存在，無需回滾');
      }
    } catch (error) {
      logger.error('回滾失敗:', error);
      throw error;
    }
  }

  private async checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
    try {
      const tableInfo = await this.db.all(`PRAGMA table_info(${tableName})`);
      return tableInfo.some((column: any) => column.name === columnName);
    } catch (error) {
      logger.error(`檢查欄位 ${columnName} 失敗:`, error);
      return false;
    }
  }

  private async addTypeColumn(): Promise<void> {
    logger.info('新增 type 欄位...');
    
    await this.db.run(`
      ALTER TABLE messages 
      ADD COLUMN type TEXT
    `);
    
    logger.info('type 欄位新增成功');
  }

  private async migrateData(): Promise<void> {
    logger.info('開始遷移 role → type 資料...');
    
    // 將所有 role 的值複製到 type 欄位
    const result = await this.db.run(`
      UPDATE messages 
      SET type = role 
      WHERE type IS NULL
    `);
    
    logger.info(`成功遷移 ${result.changes} 筆訊息資料`);
  }

  private async updateConstraints(): Promise<void> {
    logger.info('更新約束條件...');
    
    // SQLite 不支援修改約束條件，需要重建表
    await this.rebuildTableWithTypeConstraint();
    
    logger.info('約束條件更新完成');
  }

  private async rebuildTableWithTypeConstraint(): Promise<void> {
    await this.db.beginTransaction();
    
    try {
      // 1. 建立新表結構
      await this.db.run(`
        CREATE TABLE messages_new (
          message_id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('user', 'assistant', 'system', 'tool_use', 'thinking', 'output', 'error')),
          content TEXT NOT NULL,
          compressed BOOLEAN DEFAULT FALSE,
          original_size INTEGER,
          compressed_size INTEGER,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          metadata TEXT,
          FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
        )
      `);

      // 2. 複製資料到新表
      await this.db.run(`
        INSERT INTO messages_new (
          message_id, session_id, type, content, compressed, 
          original_size, compressed_size, timestamp, metadata
        )
        SELECT 
          message_id, session_id, type, content, compressed,
          original_size, compressed_size, timestamp, metadata
        FROM messages
      `);

      // 3. 刪除舊表
      await this.db.run(`DROP TABLE messages`);

      // 4. 重命名新表
      await this.db.run(`ALTER TABLE messages_new RENAME TO messages`);

      // 5. 重建索引
      await this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)
      `);
      
      await this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)
      `);
      
      await this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type)
      `);

      await this.db.commit();
      logger.info('表結構重建完成');
    } catch (error) {
      await this.db.rollback();
      throw error;
    }
  }

  private async rebuildTableWithoutType(): Promise<void> {
    await this.db.beginTransaction();
    
    try {
      // 1. 建立舊表結構（只有 role）
      await this.db.run(`
        CREATE TABLE messages_old (
          message_id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
          content TEXT NOT NULL,
          compressed BOOLEAN DEFAULT FALSE,
          original_size INTEGER,
          compressed_size INTEGER,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
        )
      `);

      // 2. 複製資料，將 type 複製回 role
      await this.db.run(`
        INSERT INTO messages_old (
          message_id, session_id, role, content, compressed, 
          original_size, compressed_size, timestamp
        )
        SELECT 
          message_id, session_id, 
          CASE 
            WHEN type IN ('user', 'assistant', 'system') THEN type
            ELSE 'assistant'  -- 將新增的類型映射回 assistant
          END as role,
          content, compressed,
          original_size, compressed_size, timestamp
        FROM messages
      `);

      // 3. 刪除新表
      await this.db.run(`DROP TABLE messages`);

      // 4. 重命名回原表名
      await this.db.run(`ALTER TABLE messages_old RENAME TO messages`);

      // 5. 重建索引
      await this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)
      `);
      
      await this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)
      `);

      await this.db.commit();
    } catch (error) {
      await this.db.rollback();
      throw error;
    }
  }

  private async validateMigration(): Promise<void> {
    logger.info('驗證遷移結果...');
    
    // 檢查資料一致性
    const roleTypeMatch = await this.db.get(`
      SELECT COUNT(*) as count 
      FROM messages 
      WHERE role = type
    `);
    
    const totalMessages = await this.db.get(`
      SELECT COUNT(*) as count 
      FROM messages
    `);
    
    if (roleTypeMatch?.count !== totalMessages?.count) {
      throw new Error(`Migration validation failed: role and type data are inconsistent`);
    }
    
    // 檢查約束條件
    const invalidTypes = await this.db.get(`
      SELECT COUNT(*) as count 
      FROM messages 
      WHERE type NOT IN ('user', 'assistant', 'system', 'tool_use', 'thinking', 'output', 'error')
    `);
    
    if (invalidTypes?.count > 0) {
      logger.warn(`發現 ${invalidTypes.count} 筆無效的 type 值`);
    }
    
    logger.info(`遷移驗證成功: ${totalMessages?.count} 筆訊息資料一致`);
  }

  async getStatus(): Promise<{
    hasTypeColumn: boolean;
    hasRoleColumn: boolean;
    totalMessages: number;
    consistentData: number;
  }> {
    const hasTypeColumn = await this.checkColumnExists('messages', 'type');
    const hasRoleColumn = await this.checkColumnExists('messages', 'role');
    
    const totalMessages = await this.db.get(`SELECT COUNT(*) as count FROM messages`);
    
    let consistentData = 0;
    if (hasTypeColumn && hasRoleColumn) {
      const consistent = await this.db.get(`
        SELECT COUNT(*) as count 
        FROM messages 
        WHERE role = type
      `);
      consistentData = consistent?.count || 0;
    }
    
    return {
      hasTypeColumn,
      hasRoleColumn,
      totalMessages: totalMessages?.count || 0,
      consistentData
    };
  }
}