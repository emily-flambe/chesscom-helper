# D1 Migration Scripts Guide

This guide covers the complete data migration pipeline from PostgreSQL to Cloudflare D1.

## Overview

The migration consists of 4 main scripts that work together to safely migrate data:

1. **`export_postgresql_data.py`** - Export current PostgreSQL data
2. **`transform_data_for_d1.py`** - Transform data for SQLite/D1 compatibility  
3. **`import_to_d1.js`** - Import data to D1 via batch API
4. **`validate_migration.py`** - Validate data integrity after migration

## Prerequisites

### Environment Setup

1. **Python Dependencies** (for Python scripts):
   ```bash
   pip install psycopg2-binary requests
   ```

2. **Node.js** (for import script):
   ```bash
   node --version  # Should be v18+
   ```

3. **Environment Variables**:
   ```bash
   # For PostgreSQL export
   export POSTGRES_HOST=your-host
   export POSTGRES_PORT=5432
   export POSTGRES_DB=your-database
   export POSTGRES_USER=your-username
   export POSTGRES_PASSWORD=your-password
   
   # For D1 import and validation
   export CLOUDFLARE_API_TOKEN=your-api-token
   export CLOUDFLARE_ACCOUNT_ID=your-account-id
   export D1_DATABASE_ID=your-d1-database-id
   ```

### Required Permissions

- PostgreSQL: READ access to all application tables
- Cloudflare: D1 database access via API token
- File system: Write access to working directory

## Migration Process

### Step 1: Export PostgreSQL Data

Export your current PostgreSQL data to JSON format:

```bash
python export_postgresql_data.py --output-dir migration_data --validate
```

**Options:**
- `--output-dir DIR`: Output directory (default: migration_data)
- `--validate`: Validate exported data after export
- `--dry-run`: Test database connection without exporting

**Output:**
- `migration_data/chesscom_app_user.json`
- `migration_data/chesscom_app_emailsubscription.json`
- `migration_data/chesscom_app_notificationlog.json`
- `migration_data/export_report.json`

### Step 2: Transform Data for D1

Transform the exported data to SQLite/D1 compatible format:

```bash
python transform_data_for_d1.py --input-dir migration_data --output-dir d1_migration_data --validate
```

**Options:**
- `--input-dir DIR`: Input directory with PostgreSQL export (default: migration_data)
- `--output-dir DIR`: Output directory for transformed data (default: d1_migration_data)
- `--validate`: Validate foreign key relationships after transformation
- `--keep-temp-db`: Keep temporary SQLite database for inspection

**Key Transformations:**
- PostgreSQL timestamps → SQLite datetime format
- JSONField data → JSON strings for D1 compatibility
- Boolean values → SQLite boolean format
- Handle null values and data type conversions

**Output:**
- `d1_migration_data/chesscom_app_user_transformed.json`
- `d1_migration_data/chesscom_app_emailsubscription_transformed.json`
- `d1_migration_data/chesscom_app_notificationlog_transformed.json`
- `d1_migration_data/transformation_report.json`

### Step 3: Import to D1

Import the transformed data to your D1 database:

```bash
node import_to_d1.js --input-dir d1_migration_data --batch-size 100
```

**Options:**
- `--input-dir DIR`: Input directory with transformed data (default: d1_migration_data)
- `--batch-size SIZE`: Batch size for imports (default: 100, max: 100)
- `--dry-run`: Test run without actual imports

**Features:**
- Automatic schema creation
- Batch processing (100 records per batch)
- Automatic retry with exponential backoff
- Progress tracking and error reporting
- Rollback data collection

**Output:**
- `d1_migration_data/import_report.json`
- Console progress updates

### Step 4: Validate Migration

Validate that the migration completed successfully:

```bash
python validate_migration.py --export-dir migration_data --transformed-dir d1_migration_data --detailed
```

**Options:**
- `--export-dir DIR`: Directory with PostgreSQL export (default: migration_data)
- `--transformed-dir DIR`: Directory with transformed data (default: d1_migration_data)
- `--detailed`: Perform detailed sample data validation
- `--output-report PATH`: Custom output path for validation report

**Validation Checks:**
- Record count validation
- Primary key integrity
- Foreign key relationships
- JSON field parsing
- Unique constraint validation
- Sample data comparison (if --detailed)

**Output:**
- `d1_migration_data/validation_report.json`
- Console validation summary

## Complete Migration Example

Here's a complete migration workflow:

```bash
# 1. Export PostgreSQL data
python export_postgresql_data.py --validate
echo "Export completed"

# 2. Transform for D1
python transform_data_for_d1.py --validate
echo "Transformation completed"

# 3. Import to D1
node import_to_d1.js
echo "Import completed"

# 4. Validate migration
python validate_migration.py --detailed
echo "Validation completed"

# 5. Check final reports
echo "Migration reports:"
ls -la migration_data/*.json d1_migration_data/*.json
```

## Testing the Pipeline

Before running the actual migration, test the complete pipeline:

```bash
python test_migration_pipeline.py --cleanup
```

This will:
- Create sample data
- Test all transformation steps
- Validate the import script (dry run)
- Generate a test report
- Clean up test files

## Error Handling and Rollback

### Common Issues

1. **Export Errors:**
   - Check PostgreSQL connection details
   - Verify database permissions
   - Ensure all required tables exist

2. **Transformation Errors:**
   - Invalid JSON data in streaming_platforms field
   - Datetime format issues
   - Missing foreign key references

3. **Import Errors:**
   - Invalid Cloudflare API credentials
   - D1 database doesn't exist
   - Network connectivity issues
   - Rate limiting

4. **Validation Errors:**
   - Record count mismatches
   - Foreign key violations
   - Data type incompatibilities

### Rollback Procedures

If migration fails:

1. **Immediate Rollback** (if Workers were updated):
   ```bash
   # Revert Workers deployment
   wrangler rollback
   ```

2. **Data Recovery** (if D1 data is corrupted):
   ```bash
   # Clear D1 database
   wrangler d1 execute your-db --command "DELETE FROM chesscom_app_notificationlog"
   wrangler d1 execute your-db --command "DELETE FROM chesscom_app_emailsubscription"  
   wrangler d1 execute your-db --command "DELETE FROM chesscom_app_user"
   
   # Re-run import with corrected data
   node import_to_d1.js
   ```

## Data Compatibility Notes

### JSONField Handling

The `streaming_platforms` field requires special handling:

- **PostgreSQL**: Stored as native JSON
- **D1**: Stored as TEXT with JSON string
- **Workers**: Parsed with `JSON.parse()` when retrieved

### Datetime Formats

- **PostgreSQL**: `2024-01-01T10:00:00Z`
- **D1**: `2024-01-01 10:00:00`
- **Workers**: Handles both formats automatically

### Boolean Values

- **PostgreSQL**: `true`/`false`
- **D1**: `1`/`0` or `true`/`false`
- **Workers**: JavaScript boolean conversion

## Performance Considerations

### Batch Sizes

- **Export**: Processes all records at once (acceptable for small datasets)
- **Transform**: Processes all records in memory
- **Import**: 100 records per batch (D1 API limit)
- **Validate**: Queries in batches for large datasets

### Timing Estimates

For a typical dataset:
- Export: 1-2 minutes
- Transform: 30 seconds
- Import: 2-5 minutes (depends on record count)
- Validate: 1-2 minutes

### Resource Usage

- **Memory**: Peak usage during transformation (~50MB for 10K records)
- **Network**: Batch API calls to D1 (rate limited)
- **Storage**: 2-3x original data size during migration

## Monitoring and Logging

All scripts generate detailed logs:

- **Console output**: Real-time progress and errors
- **Log files**: `*.log` files in script directory
- **JSON reports**: Detailed statistics and error information

### Log Locations

- `export_postgresql_data.log`
- `transform_data_for_d1.log`
- `validate_migration.log`
- `migration_data/export_report.json`
- `d1_migration_data/transformation_report.json`
- `d1_migration_data/import_report.json`
- `d1_migration_data/validation_report.json`

## Security Considerations

### Credential Management

- Use environment variables for all credentials
- Never commit credentials to version control
- Use Cloudflare API tokens with minimal required permissions
- Rotate credentials after migration

### Data Handling

- Export files contain sensitive user data
- Secure storage of migration files during process
- Clean up temporary files after migration
- Verify data integrity at each step

## Troubleshooting

### Debug Information

Enable verbose logging by setting:
```bash
export PYTHONPATH="."
python -v script_name.py  # For detailed Python output
```

### Common Solutions

1. **"Module not found"**:
   ```bash
   pip install -r requirements.txt
   ```

2. **"Connection refused"**:
   - Check PostgreSQL host/port
   - Verify network connectivity
   - Check firewall settings

3. **"API authentication failed"**:
   - Verify Cloudflare API token
   - Check account ID and database ID
   - Ensure token has D1 permissions

4. **"Foreign key constraint failed"**:
   - Run validation script to identify issues
   - Check data transformation logic
   - Verify import order (users → subscriptions → notifications)

## Support and Maintenance

### Regular Maintenance

- Archive migration logs after successful completion
- Update scripts when database schema changes
- Test migration pipeline with sample data periodically

### Emergency Contacts

- Database issues: Check PostgreSQL/Railway logs
- D1 issues: Check Cloudflare dashboard
- Script issues: Check log files and error reports

---

*This guide provides comprehensive instructions for the D1 migration process. Follow each step carefully and validate results at each stage.*