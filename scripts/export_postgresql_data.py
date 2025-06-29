#!/usr/bin/env python3
"""
PostgreSQL Data Export Script for D1 Migration
==============================================

This script exports all data from the PostgreSQL database to JSON format
for migration to Cloudflare D1. It handles JSONField serialization and
provides comprehensive error handling and validation.

Usage:
    python export_postgresql_data.py [--output-dir OUTPUT_DIR] [--validate]

Environment Variables:
    POSTGRES_HOST     - PostgreSQL host
    POSTGRES_PORT     - PostgreSQL port (default: 5432)
    POSTGRES_DB       - PostgreSQL database name
    POSTGRES_USER     - PostgreSQL username
    POSTGRES_PASSWORD - PostgreSQL password
"""

import os
import json
import sys
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import psycopg2.extensions


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('export_postgresql_data.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class PostgreSQLExporter:
    """Handles PostgreSQL data export with proper error handling and validation."""
    
    def __init__(self, db_config: Dict[str, str], output_dir: str = "migration_data"):
        self.db_config = db_config
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.connection = None
        self.export_stats = {
            'tables_exported': 0,
            'total_records': 0,
            'errors': []
        }
    
    def connect(self) -> bool:
        """Establish PostgreSQL connection."""
        try:
            self.connection = psycopg2.connect(
                host=self.db_config['host'],
                port=self.db_config['port'],
                database=self.db_config['database'],
                user=self.db_config['user'],
                password=self.db_config['password'],
                cursor_factory=RealDictCursor
            )
            logger.info("Successfully connected to PostgreSQL database")
            return True
        except psycopg2.Error as e:
            logger.error(f"Failed to connect to PostgreSQL: {e}")
            return False
    
    def disconnect(self):
        """Close PostgreSQL connection."""
        if self.connection:
            self.connection.close()
            logger.info("Disconnected from PostgreSQL database")
    
    def get_table_schema(self, table_name: str) -> List[Dict[str, Any]]:
        """Get table schema information."""
        try:
            with self.connection.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        column_name, 
                        data_type, 
                        is_nullable,
                        column_default,
                        character_maximum_length
                    FROM information_schema.columns 
                    WHERE table_name = %s 
                    ORDER BY ordinal_position
                """, (table_name,))
                return cursor.fetchall()
        except psycopg2.Error as e:
            logger.error(f"Failed to get schema for table {table_name}: {e}")
            return []
    
    def export_table(self, table_name: str) -> bool:
        """Export a single table to JSON."""
        try:
            logger.info(f"Exporting table: {table_name}")
            
            # Get table schema
            schema = self.get_table_schema(table_name)
            if not schema:
                logger.warning(f"No schema found for table {table_name}")
                return False
            
            # Export data
            with self.connection.cursor() as cursor:
                cursor.execute(f"SELECT * FROM {table_name} ORDER BY 1")
                rows = cursor.fetchall()
                
                # Convert to list of dictionaries with proper serialization
                data = []
                for row in rows:
                    row_dict = {}
                    for key, value in row.items():
                        if value is None:
                            row_dict[key] = None
                        elif isinstance(value, datetime):
                            row_dict[key] = value.isoformat()
                        elif isinstance(value, (list, dict)):
                            # Handle JSONField data
                            row_dict[key] = value
                        else:
                            row_dict[key] = value
                    data.append(row_dict)
                
                # Save to JSON file
                output_file = self.output_dir / f"{table_name}.json"
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump({
                        'table_name': table_name,
                        'schema': [dict(col) for col in schema],
                        'data': data,
                        'record_count': len(data),
                        'exported_at': datetime.now().isoformat()
                    }, f, indent=2, ensure_ascii=False, default=str)
                
                logger.info(f"Exported {len(data)} records from {table_name}")
                self.export_stats['tables_exported'] += 1
                self.export_stats['total_records'] += len(data)
                return True
                
        except psycopg2.Error as e:
            error_msg = f"Failed to export table {table_name}: {e}"
            logger.error(error_msg)
            self.export_stats['errors'].append(error_msg)
            return False
        except Exception as e:
            error_msg = f"Unexpected error exporting table {table_name}: {e}"
            logger.error(error_msg)
            self.export_stats['errors'].append(error_msg)
            return False
    
    def export_all_tables(self) -> bool:
        """Export all relevant tables."""
        # Tables to export in order (to handle foreign keys)
        tables = [
            'chesscom_app_user',
            'chesscom_app_emailsubscription',
            'chesscom_app_notificationlog'
        ]
        
        success = True
        for table in tables:
            if not self.export_table(table):
                success = False
        
        return success
    
    def validate_export(self) -> bool:
        """Validate the exported data."""
        logger.info("Validating exported data...")
        
        try:
            # Check if all expected files exist
            tables = ['chesscom_app_user', 'chesscom_app_emailsubscription', 'chesscom_app_notificationlog']
            for table in tables:
                file_path = self.output_dir / f"{table}.json"
                if not file_path.exists():
                    logger.error(f"Export file missing: {file_path}")
                    return False
                
                # Load and validate JSON structure
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                    required_keys = ['table_name', 'schema', 'data', 'record_count', 'exported_at']
                    for key in required_keys:
                        if key not in data:
                            logger.error(f"Missing key '{key}' in {table} export")
                            return False
                    
                    # Validate record count matches actual data
                    if len(data['data']) != data['record_count']:
                        logger.error(f"Record count mismatch in {table}: expected {data['record_count']}, got {len(data['data'])}")
                        return False
                    
                    logger.info(f"Validated {table}: {data['record_count']} records")
            
            # Validate foreign key relationships
            return self._validate_foreign_keys()
            
        except Exception as e:
            logger.error(f"Validation failed: {e}")
            return False
    
    def _validate_foreign_keys(self) -> bool:
        """Validate foreign key relationships in exported data."""
        try:
            # Load all data
            users_file = self.output_dir / "chesscom_app_user.json"
            subscriptions_file = self.output_dir / "chesscom_app_emailsubscription.json"
            notifications_file = self.output_dir / "chesscom_app_notificationlog.json"
            
            with open(users_file, 'r') as f:
                users_data = json.load(f)
            with open(subscriptions_file, 'r') as f:
                subscriptions_data = json.load(f)
            with open(notifications_file, 'r') as f:
                notifications_data = json.load(f)
            
            # Create lookup sets
            user_ids = {user['player_id'] for user in users_data['data']}
            subscription_ids = {sub['id'] for sub in subscriptions_data['data']}
            
            # Validate subscription -> user foreign keys
            for subscription in subscriptions_data['data']:
                if subscription['player_id'] not in user_ids:
                    logger.error(f"Subscription {subscription['id']} references non-existent user {subscription['player_id']}")
                    return False
            
            # Validate notification -> subscription foreign keys
            for notification in notifications_data['data']:
                if notification['subscription_id'] not in subscription_ids:
                    logger.error(f"Notification {notification['id']} references non-existent subscription {notification['subscription_id']}")
                    return False
            
            logger.info("All foreign key relationships validated successfully")
            return True
            
        except Exception as e:
            logger.error(f"Foreign key validation failed: {e}")
            return False
    
    def generate_export_report(self) -> Dict[str, Any]:
        """Generate a comprehensive export report."""
        report = {
            'export_timestamp': datetime.now().isoformat(),
            'database_config': {
                'host': self.db_config['host'],
                'port': self.db_config['port'],
                'database': self.db_config['database'],
                'user': self.db_config['user']
            },
            'export_statistics': self.export_stats,
            'output_directory': str(self.output_dir),
            'files_created': []
        }
        
        # List all created files
        for file_path in self.output_dir.glob("*.json"):
            report['files_created'].append({
                'filename': file_path.name,
                'size_bytes': file_path.stat().st_size,
                'size_mb': round(file_path.stat().st_size / 1024 / 1024, 2)
            })
        
        return report
    
    def save_export_report(self, report: Dict[str, Any]):
        """Save the export report to file."""
        report_file = self.output_dir / "export_report.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        logger.info(f"Export report saved to {report_file}")


def get_db_config() -> Dict[str, str]:
    """Get database configuration from environment variables."""
    config = {
        'host': os.getenv('POSTGRES_HOST'),
        'port': os.getenv('POSTGRES_PORT', '5432'),
        'database': os.getenv('POSTGRES_DB'),
        'user': os.getenv('POSTGRES_USER'),
        'password': os.getenv('POSTGRES_PASSWORD')
    }
    
    # Validate required environment variables
    required_vars = ['host', 'database', 'user', 'password']
    missing_vars = [var for var in required_vars if not config[var]]
    
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {', '.join(f'POSTGRES_{var.upper()}' for var in missing_vars)}")
    
    return config


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description='Export PostgreSQL data for D1 migration')
    parser.add_argument('--output-dir', default='migration_data', 
                       help='Output directory for exported data (default: migration_data)')
    parser.add_argument('--validate', action='store_true', 
                       help='Validate exported data after export')
    parser.add_argument('--dry-run', action='store_true',
                       help='Test database connection without exporting data')
    
    args = parser.parse_args()
    
    try:
        # Get database configuration
        db_config = get_db_config()
        logger.info(f"Starting PostgreSQL export to {args.output_dir}")
        
        # Initialize exporter
        exporter = PostgreSQLExporter(db_config, args.output_dir)
        
        # Connect to database
        if not exporter.connect():
            logger.error("Failed to connect to database")
            sys.exit(1)
        
        if args.dry_run:
            logger.info("Dry run completed successfully - database connection verified")
            exporter.disconnect()
            return
        
        try:
            # Export all tables
            if not exporter.export_all_tables():
                logger.error("Export completed with errors")
                sys.exit(1)
            
            # Validate if requested
            if args.validate:
                if not exporter.validate_export():
                    logger.error("Export validation failed")
                    sys.exit(1)
                logger.info("Export validation passed")
            
            # Generate and save report
            report = exporter.generate_export_report()
            exporter.save_export_report(report)
            
            logger.info(f"Export completed successfully!")
            logger.info(f"Tables exported: {report['export_statistics']['tables_exported']}")
            logger.info(f"Total records: {report['export_statistics']['total_records']}")
            logger.info(f"Output directory: {report['output_directory']}")
            
            if report['export_statistics']['errors']:
                logger.warning(f"Completed with {len(report['export_statistics']['errors'])} errors")
                for error in report['export_statistics']['errors']:
                    logger.warning(f"  - {error}")
            
        finally:
            exporter.disconnect()
    
    except Exception as e:
        logger.error(f"Export failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()