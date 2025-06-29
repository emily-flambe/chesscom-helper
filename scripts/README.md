# Migration Scripts

This directory contains the complete data migration pipeline for migrating from PostgreSQL to Cloudflare D1.

## Quick Start

### Test the Pipeline
```bash
python test_migration_pipeline.py --cleanup
```

### Run Complete Migration
```bash
# Dry run first
./run_complete_migration.sh --dry-run

# Actual migration
./run_complete_migration.sh
```

## Scripts Overview

| Script | Purpose | Language | Dependencies |
|--------|---------|----------|--------------|
| `export_postgresql_data.py` | Export PostgreSQL data to JSON | Python | psycopg2 |
| `transform_data_for_d1.py` | Transform data for D1 compatibility | Python | sqlite3 |
| `import_to_d1.js` | Import data to D1 via batch API | Node.js | https |
| `validate_migration.py` | Validate migration integrity | Python | requests |
| `test_migration_pipeline.py` | Test complete pipeline | Python | subprocess |
| `run_complete_migration.sh` | Run complete migration | Bash | - |

## Required Environment Variables

### PostgreSQL Export
```bash
export POSTGRES_HOST=your-host
export POSTGRES_PORT=5432
export POSTGRES_DB=your-database  
export POSTGRES_USER=your-username
export POSTGRES_PASSWORD=your-password
```

### D1 Import/Validation
```bash
export CLOUDFLARE_API_TOKEN=your-api-token
export CLOUDFLARE_ACCOUNT_ID=your-account-id
export D1_DATABASE_ID=your-d1-database-id
```

## Migration Process

1. **Export** - Extract current PostgreSQL data
2. **Transform** - Convert to D1-compatible format
3. **Import** - Batch upload to D1 database
4. **Validate** - Verify data integrity

## Data Transformations

- **DateTime**: PostgreSQL timestamps → SQLite format
- **JSON Fields**: Native JSON → JSON strings
- **Booleans**: PostgreSQL booleans → SQLite booleans
- **Foreign Keys**: Preserved with validation

## Output Files

```
migration_data_TIMESTAMP/
├── chesscom_app_user.json
├── chesscom_app_emailsubscription.json
├── chesscom_app_notificationlog.json
└── export_report.json

d1_migration_data_TIMESTAMP/
├── chesscom_app_user_transformed.json
├── chesscom_app_emailsubscription_transformed.json
├── chesscom_app_notificationlog_transformed.json
├── transformation_report.json
├── import_report.json
└── validation_report.json
```

## Error Handling

- Comprehensive logging to `*.log` files
- Detailed error reports in JSON format
- Foreign key validation at each step
- Rollback information for failed imports

## Security Notes

- All credentials via environment variables
- No sensitive data in logs or reports
- Secure API token handling
- Data validation at each step

## Troubleshooting

1. **Connection Issues**: Check environment variables
2. **Import Failures**: Verify Cloudflare API permissions
3. **Validation Errors**: Check foreign key relationships
4. **Performance**: Adjust batch sizes for large datasets

For detailed documentation, see [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md).

## Support

- Check log files for detailed error information
- Run test pipeline to validate setup
- Use dry-run mode to test without actual imports
- Review validation reports for data integrity issues