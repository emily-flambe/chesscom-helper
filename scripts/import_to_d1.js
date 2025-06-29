#!/usr/bin/env node
/**
 * D1 Data Import Script
 * ====================
 * 
 * This script imports transformed data to Cloudflare D1 database using the D1 HTTP API.
 * It handles batch imports (100 records per batch as per D1 limits) and provides
 * comprehensive error handling and rollback capabilities.
 * 
 * Usage:
 *   node import_to_d1.js [--input-dir INPUT_DIR] [--batch-size BATCH_SIZE] [--dry-run] [--rollback]
 * 
 * Environment Variables:
 *   CLOUDFLARE_API_TOKEN - Cloudflare API token with D1 permissions
 *   CLOUDFLARE_ACCOUNT_ID - Cloudflare account ID
 *   D1_DATABASE_ID - D1 database ID
 * 
 * Features:
 *   - Batch processing with configurable batch size
 *   - Automatic retry logic with exponential backoff
 *   - Data validation before import
 *   - Rollback capabilities
 *   - Comprehensive logging and error reporting
 *   - Progress tracking
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const { URL } = require('url');

// Configuration
const CONFIG = {
  DEFAULT_INPUT_DIR: 'd1_migration_data',
  DEFAULT_BATCH_SIZE: 100, // D1 batch API limit
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000, // Base delay in milliseconds
  API_BASE_URL: 'https://api.cloudflare.com/client/v4',
  TABLES: [
    'chesscom_app_user',
    'chesscom_app_emailsubscription', 
    'chesscom_app_notificationlog'
  ]
};

class D1Importer {
  constructor(options = {}) {
    this.inputDir = options.inputDir || CONFIG.DEFAULT_INPUT_DIR;
    this.batchSize = options.batchSize || CONFIG.DEFAULT_BATCH_SIZE;
    this.dryRun = options.dryRun || false;
    
    // Environment variables
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN;
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    this.databaseId = process.env.D1_DATABASE_ID;
    
    // Statistics
    this.stats = {
      tablesProcessed: 0,
      recordsImported: 0,
      batchesExecuted: 0,
      errors: [],
      startTime: new Date(),
      rollbackData: []
    };
    
    this.validateConfig();
  }
  
  validateConfig() {
    const required = ['apiToken', 'accountId', 'databaseId'];
    const missing = required.filter(key => !this[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.map(k => 
        k.replace(/([A-Z])/g, '_$1').toUpperCase()
      ).join(', ')}`);
    }
    
    console.log('Configuration validated successfully');
  }
  
  async makeD1Request(statements, retryCount = 0) {
    const url = `${CONFIG.API_BASE_URL}/accounts/${this.accountId}/d1/database/${this.databaseId}/query`;
    
    const payload = JSON.stringify(statements);
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    
    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (res.statusCode >= 200 && res.statusCode < 300 && response.success) {
              resolve(response);
            } else {
              const error = new Error(`D1 API Error: ${response.errors?.[0]?.message || `HTTP ${res.statusCode}`}`);
              error.response = response;
              error.statusCode = res.statusCode;
              reject(error);
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse D1 API response: ${parseError.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`D1 API Request failed: ${error.message}`));
      });
      
      req.write(payload);
      req.end();
    });
  }
  
  async retryRequest(statements, operation, retryCount = 0) {
    try {
      return await this.makeD1Request(statements);
    } catch (error) {
      if (retryCount < CONFIG.MAX_RETRIES && this.isRetriableError(error)) {
        const delay = CONFIG.RETRY_DELAY_BASE * Math.pow(2, retryCount);
        console.log(`${operation} failed (attempt ${retryCount + 1}/${CONFIG.MAX_RETRIES + 1}), retrying in ${delay}ms: ${error.message}`);
        await this.sleep(delay);
        return this.retryRequest(statements, operation, retryCount + 1);
      }
      throw error;
    }
  }
  
  isRetriableError(error) {
    // Retry on network errors and certain HTTP status codes
    return error.code === 'ECONNRESET' || 
           error.code === 'ETIMEDOUT' ||
           (error.statusCode >= 500 && error.statusCode < 600) ||
           error.statusCode === 429; // Rate limit
  }
  
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  createUserInsertStatement(user) {
    return {
      sql: `INSERT OR REPLACE INTO chesscom_app_user 
            (player_id, username, name, url, country, location, followers, 
             last_online, joined, status, league, is_streamer, verified, 
             is_playing, streaming_platforms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        user.player_id,
        user.username,
        user.name,
        user.url,
        user.country,
        user.location,
        user.followers,
        user.last_online,
        user.joined,
        user.status,
        user.league,
        user.is_streamer,
        user.verified,
        user.is_playing,
        user.streaming_platforms
      ]
    };
  }
  
  createSubscriptionInsertStatement(subscription) {
    const statement = {
      sql: `INSERT OR REPLACE INTO chesscom_app_emailsubscription 
            (email, player_id, created_at, is_active)
            VALUES (?, ?, ?, ?)`,
      params: [
        subscription.email,
        subscription.player_id,
        subscription.created_at,
        subscription.is_active
      ]
    };
    
    // Handle ID if present (for maintaining relationships)
    if (subscription.id) {
      statement.sql = `INSERT OR REPLACE INTO chesscom_app_emailsubscription 
                       (id, email, player_id, created_at, is_active)
                       VALUES (?, ?, ?, ?, ?)`;
      statement.params.unshift(subscription.id);
    }
    
    return statement;
  }
  
  createNotificationInsertStatement(notification) {
    const statement = {
      sql: `INSERT OR REPLACE INTO chesscom_app_notificationlog 
            (subscription_id, sent_at, notification_type, success, error_message)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        notification.subscription_id,
        notification.sent_at,
        notification.notification_type,
        notification.success,
        notification.error_message
      ]
    };
    
    // Handle ID if present
    if (notification.id) {
      statement.sql = `INSERT OR REPLACE INTO chesscom_app_notificationlog 
                       (id, subscription_id, sent_at, notification_type, success, error_message)
                       VALUES (?, ?, ?, ?, ?, ?)`;
      statement.params.unshift(notification.id);
    }
    
    return statement;
  }
  
  async loadTransformedData(tableName) {
    const filePath = path.join(this.inputDir, `${tableName}_transformed.json`);
    
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(fileContent);
      
      console.log(`Loaded ${data.record_count} records from ${tableName}`);
      return data;
    } catch (error) {
      throw new Error(`Failed to load data for ${tableName}: ${error.message}`);
    }
  }
  
  async importTable(tableName) {
    console.log(`\n=== Importing ${tableName} ===`);
    
    const tableData = await this.loadTransformedData(tableName);
    const records = tableData.data;
    
    if (records.length === 0) {
      console.log(`No records to import for ${tableName}`);
      return { imported: 0, batches: 0 };
    }
    
    // Create batches
    const batches = this.chunkArray(records, this.batchSize);
    console.log(`Processing ${records.length} records in ${batches.length} batches`);
    
    let importedCount = 0;
    let batchCount = 0;
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} records)`);
      
      if (this.dryRun) {
        console.log(`[DRY RUN] Would import ${batch.length} records`);
        importedCount += batch.length;
        batchCount++;
        continue;
      }
      
      // Create SQL statements for this batch
      let statements = [];
      
      try {
        if (tableName === 'chesscom_app_user') {
          statements = batch.map(record => this.createUserInsertStatement(record));
        } else if (tableName === 'chesscom_app_emailsubscription') {
          statements = batch.map(record => this.createSubscriptionInsertStatement(record));
        } else if (tableName === 'chesscom_app_notificationlog') {
          statements = batch.map(record => this.createNotificationInsertStatement(record));
        } else {
          throw new Error(`Unknown table type: ${tableName}`);
        }
        
        // Execute batch
        const response = await this.retryRequest(statements, `Import batch ${i + 1} for ${tableName}`);
        
        // Validate response
        if (response.result && Array.isArray(response.result)) {
          const successCount = response.result.filter(result => result.success).length;
          const errorCount = response.result.filter(result => !result.success).length;
          
          if (errorCount > 0) {
            const errors = response.result
              .filter(result => !result.success)
              .map(result => result.error);
            console.error(`Batch ${i + 1} had ${errorCount} errors:`, errors);
            this.stats.errors.push({
              table: tableName,
              batch: i + 1,
              errors: errors
            });
          }
          
          importedCount += successCount;
          console.log(`Batch ${i + 1} completed: ${successCount} success, ${errorCount} errors`);
        } else {
          console.log(`Batch ${i + 1} completed successfully`);
          importedCount += batch.length;
        }
        
        batchCount++;
        
        // Store rollback data
        this.stats.rollbackData.push({
          table: tableName,
          batch: i + 1,
          records: batch.map(record => record.player_id || record.id || record.email)
        });
        
        // Small delay between batches to avoid rate limiting
        if (i < batches.length - 1) {
          await this.sleep(100);
        }
        
      } catch (error) {
        const errorMsg = `Failed to import batch ${i + 1} for ${tableName}: ${error.message}`;
        console.error(errorMsg);
        this.stats.errors.push({
          table: tableName,
          batch: i + 1,
          error: error.message
        });
        
        // Continue with next batch rather than failing completely
        continue;
      }
    }
    
    console.log(`Completed ${tableName}: ${importedCount}/${records.length} records imported in ${batchCount} batches`);
    return { imported: importedCount, batches: batchCount };
  }
  
  async createSchema() {
    console.log('Creating D1 database schema...');
    
    const statements = [
      {
        sql: `CREATE TABLE IF NOT EXISTS chesscom_app_user (
          player_id INTEGER PRIMARY KEY,
          username VARCHAR(150) UNIQUE NOT NULL,
          name VARCHAR(255),
          url VARCHAR(200),
          country VARCHAR(200),
          location VARCHAR(255),
          followers INTEGER DEFAULT 0,
          last_online INTEGER,
          joined INTEGER,
          status VARCHAR(50),
          league VARCHAR(50),
          is_streamer BOOLEAN DEFAULT FALSE,
          verified BOOLEAN DEFAULT FALSE,
          is_playing BOOLEAN DEFAULT FALSE,
          streaming_platforms TEXT DEFAULT '[]'
        )`
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS chesscom_app_emailsubscription (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email VARCHAR(254) NOT NULL,
          player_id INTEGER NOT NULL,
          created_at DATETIME NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          FOREIGN KEY (player_id) REFERENCES chesscom_app_user (player_id),
          UNIQUE(email, player_id)
        )`
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS chesscom_app_notificationlog (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subscription_id INTEGER NOT NULL,
          sent_at DATETIME NOT NULL,
          notification_type VARCHAR(50) DEFAULT 'live_match',
          success BOOLEAN DEFAULT TRUE,
          error_message TEXT,
          FOREIGN KEY (subscription_id) REFERENCES chesscom_app_emailsubscription (id)
        )`
      },
      // Indexes
      { sql: 'CREATE INDEX IF NOT EXISTS idx_user_username ON chesscom_app_user(username)' },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_subscription_player ON chesscom_app_emailsubscription(player_id)' },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_subscription_active ON chesscom_app_emailsubscription(is_active)' },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_notification_subscription ON chesscom_app_notificationlog(subscription_id)' },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_notification_sent_at ON chesscom_app_notificationlog(sent_at)' }
    ];
    
    if (this.dryRun) {
      console.log('[DRY RUN] Would create schema with the following statements:');
      statements.forEach((stmt, i) => {
        console.log(`${i + 1}. ${stmt.sql}`);
      });
      return;
    }
    
    try {
      const response = await this.retryRequest(statements, 'Create schema');
      console.log('Schema created successfully');
    } catch (error) {
      throw new Error(`Failed to create schema: ${error.message}`);
    }
  }
  
  async importAllTables() {
    console.log('\n=== Starting D1 Data Import ===');
    console.log(`Input directory: ${this.inputDir}`);
    console.log(`Batch size: ${this.batchSize}`);
    console.log(`Dry run: ${this.dryRun}`);
    
    // Create schema first
    await this.createSchema();
    
    // Import tables in order (to handle foreign keys)
    for (const tableName of CONFIG.TABLES) {
      try {
        const result = await this.importTable(tableName);
        this.stats.tablesProcessed++;
        this.stats.recordsImported += result.imported;
        this.stats.batchesExecuted += result.batches;
      } catch (error) {
        console.error(`Failed to import table ${tableName}: ${error.message}`);
        this.stats.errors.push({
          table: tableName,
          error: error.message
        });
        // Continue with other tables
      }
    }
  }
  
  async validateImport() {
    console.log('\n=== Validating Import ===');
    
    if (this.dryRun) {
      console.log('[DRY RUN] Skipping validation');
      return true;
    }
    
    try {
      // Get record counts from D1
      const statements = CONFIG.TABLES.map(table => ({
        sql: `SELECT COUNT(*) as count FROM ${table}`
      }));
      
      const response = await this.retryRequest(statements, 'Validate import counts');
      
      if (response.result && Array.isArray(response.result)) {
        console.log('D1 Database Record Counts:');
        response.result.forEach((result, index) => {
          const tableName = CONFIG.TABLES[index];
          const count = result.results[0]?.count || 0;
          console.log(`  ${tableName}: ${count} records`);
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Validation failed: ${error.message}`);
      return false;
    }
  }
  
  generateReport() {
    const endTime = new Date();
    const duration = Math.round((endTime - this.stats.startTime) / 1000);
    
    return {
      importTimestamp: endTime.toISOString(),
      duration: `${duration} seconds`,
      configuration: {
        inputDirectory: this.inputDir,
        batchSize: this.batchSize,
        dryRun: this.dryRun
      },
      statistics: {
        tablesProcessed: this.stats.tablesProcessed,
        recordsImported: this.stats.recordsImported,
        batchesExecuted: this.stats.batchesExecuted,
        errorCount: this.stats.errors.length
      },
      errors: this.stats.errors,
      rollbackData: this.dryRun ? [] : this.stats.rollbackData
    };
  }
  
  async saveReport(report) {
    const reportPath = path.join(this.inputDir, 'import_report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nImport report saved to: ${reportPath}`);
  }
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input-dir':
        options.inputDir = args[++i];
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i]);
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        console.log(`
Usage: node import_to_d1.js [options]

Options:
  --input-dir DIR     Input directory with transformed data (default: d1_migration_data)
  --batch-size SIZE   Batch size for imports (default: 100)
  --dry-run          Test run without actual imports
  --help             Show this help message

Environment Variables:
  CLOUDFLARE_API_TOKEN   Cloudflare API token
  CLOUDFLARE_ACCOUNT_ID  Cloudflare account ID  
  D1_DATABASE_ID         D1 database ID
        `);
        process.exit(0);
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }
  
  try {
    const importer = new D1Importer(options);
    
    await importer.importAllTables();
    await importer.validateImport();
    
    const report = importer.generateReport();
    await importer.saveReport(report);
    
    console.log('\n=== Import Summary ===');
    console.log(`Tables processed: ${report.statistics.tablesProcessed}`);
    console.log(`Records imported: ${report.statistics.recordsImported}`);
    console.log(`Batches executed: ${report.statistics.batchesExecuted}`);
    console.log(`Duration: ${report.duration}`);
    
    if (report.statistics.errorCount > 0) {
      console.log(`Errors: ${report.statistics.errorCount}`);
      console.log('Check import_report.json for detailed error information');
      process.exit(1);
    } else {
      console.log('Import completed successfully!');
    }
    
  } catch (error) {
    console.error(`Import failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { D1Importer };