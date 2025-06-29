#!/usr/bin/env python3
"""
Data Transformation Script for D1 Migration
==========================================

This script transforms exported PostgreSQL data to SQLite/D1 compatible format.
It handles data type conversions, JSON field transformations, and ensures 
compatibility with Cloudflare D1's SQLite backend.

Usage:
    python transform_data_for_d1.py [--input-dir INPUT_DIR] [--output-dir OUTPUT_DIR] [--validate]

Key Transformations:
    - PostgreSQL timestamps to SQLite-compatible datetime format
    - JSONField data to JSON strings for D1 compatibility
    - Handle PostgreSQL-specific data types
    - Preserve foreign key relationships
    - Convert BigInteger fields appropriately
"""

import os
import json
import sys
import argparse
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional, Union
import tempfile
import shutil


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('transform_data_for_d1.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class DataTransformer:
    """Handles data transformation from PostgreSQL export to D1-compatible format."""
    
    def __init__(self, input_dir: str = "migration_data", output_dir: str = "d1_migration_data"):
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.temp_db_path = None
        self.stats = {
            'tables_processed': 0,
            'records_transformed': 0,
            'errors': [],
            'transformations': []
        }
    
    def create_temp_sqlite_db(self) -> str:
        """Create a temporary SQLite database for validation."""
        temp_fd, temp_path = tempfile.mkstemp(suffix='.db')
        os.close(temp_fd)
        self.temp_db_path = temp_path
        
        # Create SQLite schema
        with sqlite3.connect(temp_path) as conn:
            cursor = conn.cursor()
            
            # Create tables with D1-compatible schema
            cursor.execute("""
                CREATE TABLE chesscom_app_user (
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
                )
            """)
            
            cursor.execute("""
                CREATE TABLE chesscom_app_emailsubscription (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email VARCHAR(254) NOT NULL,
                    player_id INTEGER NOT NULL,
                    created_at DATETIME NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    FOREIGN KEY (player_id) REFERENCES chesscom_app_user (player_id),
                    UNIQUE(email, player_id)
                )
            """)
            
            cursor.execute("""
                CREATE TABLE chesscom_app_notificationlog (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    subscription_id INTEGER NOT NULL,
                    sent_at DATETIME NOT NULL,
                    notification_type VARCHAR(50) DEFAULT 'live_match',
                    success BOOLEAN DEFAULT TRUE,
                    error_message TEXT,
                    FOREIGN KEY (subscription_id) REFERENCES chesscom_app_emailsubscription (id)
                )
            """)
            
            # Create indexes
            cursor.execute("CREATE INDEX idx_user_username ON chesscom_app_user(username)")
            cursor.execute("CREATE INDEX idx_subscription_player ON chesscom_app_emailsubscription(player_id)")
            cursor.execute("CREATE INDEX idx_subscription_active ON chesscom_app_emailsubscription(is_active)")
            cursor.execute("CREATE INDEX idx_notification_subscription ON chesscom_app_notificationlog(subscription_id)")
            cursor.execute("CREATE INDEX idx_notification_sent_at ON chesscom_app_notificationlog(sent_at)")
            
            conn.commit()
        
        logger.info(f"Created temporary SQLite database: {temp_path}")
        return temp_path
    
    def transform_datetime(self, dt_value: Any) -> Optional[str]:
        """Transform datetime values to SQLite-compatible format."""
        if dt_value is None:
            return None
        
        if isinstance(dt_value, str):
            try:
                # Parse ISO format datetime string
                dt = datetime.fromisoformat(dt_value.replace('Z', '+00:00'))
                return dt.strftime('%Y-%m-%d %H:%M:%S')
            except ValueError:
                logger.warning(f"Could not parse datetime string: {dt_value}")
                return dt_value
        
        if isinstance(dt_value, datetime):
            return dt_value.strftime('%Y-%m-%d %H:%M:%S')
        
        return str(dt_value)
    
    def transform_json_field(self, json_value: Any) -> str:
        """Transform JSON field data to string format for SQLite."""
        if json_value is None:
            return '[]'
        
        if isinstance(json_value, str):
            try:
                # Validate it's valid JSON
                json.loads(json_value)
                return json_value
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON string, converting to empty array: {json_value}")
                return '[]'
        
        if isinstance(json_value, (list, dict)):
            return json.dumps(json_value, ensure_ascii=False)
        
        logger.warning(f"Unexpected JSON field type: {type(json_value)}, value: {json_value}")
        return '[]'
    
    def transform_boolean(self, bool_value: Any) -> bool:
        """Transform boolean values to SQLite-compatible format."""
        if bool_value is None:
            return False
        
        if isinstance(bool_value, bool):
            return bool_value
        
        if isinstance(bool_value, str):
            return bool_value.lower() in ('true', '1', 'yes', 'on')
        
        if isinstance(bool_value, (int, float)):
            return bool(bool_value)
        
        return False
    
    def transform_user_record(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform a user record for D1 compatibility."""
        transformed = {}
        
        # Handle required fields
        transformed['player_id'] = int(user_data.get('player_id', 0))
        transformed['username'] = str(user_data.get('username', ''))
        transformed['name'] = user_data.get('name')
        transformed['url'] = user_data.get('url')
        transformed['country'] = user_data.get('country')
        transformed['location'] = user_data.get('location')
        transformed['followers'] = int(user_data.get('followers', 0))
        transformed['last_online'] = int(user_data.get('last_online', 0))
        transformed['joined'] = int(user_data.get('joined', 0))
        transformed['status'] = user_data.get('status', 'offline')
        transformed['league'] = user_data.get('league')
        
        # Handle boolean fields
        transformed['is_streamer'] = self.transform_boolean(user_data.get('is_streamer', False))
        transformed['verified'] = self.transform_boolean(user_data.get('verified', False))
        transformed['is_playing'] = self.transform_boolean(user_data.get('is_playing', False))
        
        # Handle JSON field
        streaming_platforms = user_data.get('streaming_platforms', [])
        transformed['streaming_platforms'] = self.transform_json_field(streaming_platforms)
        
        return transformed
    
    def transform_subscription_record(self, subscription_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform an email subscription record for D1 compatibility."""
        transformed = {}
        
        # Handle ID field (will be auto-generated in D1)
        if 'id' in subscription_data:
            transformed['id'] = int(subscription_data['id'])
        
        transformed['email'] = str(subscription_data.get('email', ''))
        transformed['player_id'] = int(subscription_data.get('player_id', 0))
        transformed['created_at'] = self.transform_datetime(subscription_data.get('created_at'))
        transformed['is_active'] = self.transform_boolean(subscription_data.get('is_active', True))
        
        return transformed
    
    def transform_notification_record(self, notification_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform a notification log record for D1 compatibility."""
        transformed = {}
        
        # Handle ID field (will be auto-generated in D1)
        if 'id' in notification_data:
            transformed['id'] = int(notification_data['id'])
        
        transformed['subscription_id'] = int(notification_data.get('subscription_id', 0))
        transformed['sent_at'] = self.transform_datetime(notification_data.get('sent_at'))
        transformed['notification_type'] = str(notification_data.get('notification_type', 'live_match'))
        transformed['success'] = self.transform_boolean(notification_data.get('success', True))
        transformed['error_message'] = notification_data.get('error_message')
        
        return transformed
    
    def transform_table_data(self, table_name: str, table_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform table data based on table type."""
        logger.info(f"Transforming table: {table_name}")
        
        original_data = table_data.get('data', [])
        transformed_data = []
        transformation_count = 0
        
        for record in original_data:
            try:
                if table_name == 'chesscom_app_user':
                    transformed_record = self.transform_user_record(record)
                elif table_name == 'chesscom_app_emailsubscription':
                    transformed_record = self.transform_subscription_record(record)
                elif table_name == 'chesscom_app_notificationlog':
                    transformed_record = self.transform_notification_record(record)
                else:
                    logger.warning(f"Unknown table type: {table_name}, using record as-is")
                    transformed_record = record
                
                transformed_data.append(transformed_record)
                transformation_count += 1
                
            except Exception as e:
                error_msg = f"Error transforming record in {table_name}: {e}"
                logger.error(error_msg)
                self.stats['errors'].append(error_msg)
                continue
        
        # Create transformed table structure
        transformed_table = {
            'table_name': table_name,
            'original_schema': table_data.get('schema', []),
            'data': transformed_data,
            'record_count': len(transformed_data),
            'original_record_count': len(original_data),
            'transformed_at': datetime.now().isoformat(),
            'transformation_notes': []
        }
        
        self.stats['transformations'].append({
            'table': table_name,
            'original_count': len(original_data),
            'transformed_count': len(transformed_data),
            'transformation_count': transformation_count
        })
        
        logger.info(f"Transformed {transformation_count} records for {table_name}")
        return transformed_table
    
    def validate_with_sqlite(self, transformed_data: Dict[str, Any]) -> bool:
        """Validate transformed data by inserting into temporary SQLite database."""
        if not self.temp_db_path:
            self.create_temp_sqlite_db()
        
        try:
            with sqlite3.connect(self.temp_db_path) as conn:
                cursor = conn.cursor()
                table_name = transformed_data['table_name']
                data = transformed_data['data']
                
                logger.info(f"Validating {len(data)} records for {table_name}")
                
                if table_name == 'chesscom_app_user':
                    for record in data:
                        cursor.execute("""
                            INSERT OR REPLACE INTO chesscom_app_user 
                            (player_id, username, name, url, country, location, followers, 
                             last_online, joined, status, league, is_streamer, verified, 
                             is_playing, streaming_platforms)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            record['player_id'], record['username'], record['name'],
                            record['url'], record['country'], record['location'],
                            record['followers'], record['last_online'], record['joined'],
                            record['status'], record['league'], record['is_streamer'],
                            record['verified'], record['is_playing'], record['streaming_platforms']
                        ))
                
                elif table_name == 'chesscom_app_emailsubscription':
                    for record in data:
                        cursor.execute("""
                            INSERT OR REPLACE INTO chesscom_app_emailsubscription 
                            (email, player_id, created_at, is_active)
                            VALUES (?, ?, ?, ?)
                        """, (
                            record['email'], record['player_id'], 
                            record['created_at'], record['is_active']
                        ))
                
                elif table_name == 'chesscom_app_notificationlog':
                    for record in data:
                        cursor.execute("""
                            INSERT OR REPLACE INTO chesscom_app_notificationlog 
                            (subscription_id, sent_at, notification_type, success, error_message)
                            VALUES (?, ?, ?, ?, ?)
                        """, (
                            record['subscription_id'], record['sent_at'],
                            record['notification_type'], record['success'], record['error_message']
                        ))
                
                conn.commit()
                logger.info(f"Successfully validated {table_name} data in SQLite")
                return True
                
        except Exception as e:
            error_msg = f"SQLite validation failed for {table_name}: {e}"
            logger.error(error_msg)
            self.stats['errors'].append(error_msg)
            return False
    
    def transform_all_tables(self) -> bool:
        """Transform all exported tables to D1-compatible format."""
        success = True
        tables = ['chesscom_app_user', 'chesscom_app_emailsubscription', 'chesscom_app_notificationlog']
        
        for table_name in tables:
            input_file = self.input_dir / f"{table_name}.json"
            
            if not input_file.exists():
                error_msg = f"Input file not found: {input_file}"
                logger.error(error_msg)
                self.stats['errors'].append(error_msg)
                success = False
                continue
            
            try:
                # Load original data
                with open(input_file, 'r', encoding='utf-8') as f:
                    table_data = json.load(f)
                
                # Transform data
                transformed_table = self.transform_table_data(table_name, table_data)
                
                # Validate with SQLite
                if not self.validate_with_sqlite(transformed_table):
                    success = False
                    continue
                
                # Save transformed data
                output_file = self.output_dir / f"{table_name}_transformed.json"
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(transformed_table, f, indent=2, ensure_ascii=False)
                
                logger.info(f"Saved transformed data to: {output_file}")
                self.stats['tables_processed'] += 1
                self.stats['records_transformed'] += len(transformed_table['data'])
                
            except Exception as e:
                error_msg = f"Failed to transform table {table_name}: {e}"
                logger.error(error_msg)
                self.stats['errors'].append(error_msg)
                success = False
        
        return success
    
    def validate_foreign_keys(self) -> bool:
        """Validate foreign key relationships in transformed data."""
        try:
            logger.info("Validating foreign key relationships...")
            
            # Load transformed data
            users_file = self.output_dir / "chesscom_app_user_transformed.json"
            subs_file = self.output_dir / "chesscom_app_emailsubscription_transformed.json"
            notifs_file = self.output_dir / "chesscom_app_notificationlog_transformed.json"
            
            with open(users_file, 'r') as f:
                users_data = json.load(f)
            with open(subs_file, 'r') as f:
                subs_data = json.load(f)
            with open(notifs_file, 'r') as f:
                notifs_data = json.load(f)
            
            # Create lookup sets
            user_ids = {user['player_id'] for user in users_data['data']}
            subscription_ids = set()
            
            # Validate subscription -> user foreign keys
            for subscription in subs_data['data']:
                if subscription['player_id'] not in user_ids:
                    error_msg = f"Subscription references non-existent user: {subscription['player_id']}"
                    logger.error(error_msg)
                    self.stats['errors'].append(error_msg)
                    return False
                
                if 'id' in subscription:
                    subscription_ids.add(subscription['id'])
            
            # Validate notification -> subscription foreign keys
            for notification in notifs_data['data']:
                if subscription_ids and notification['subscription_id'] not in subscription_ids:
                    error_msg = f"Notification references non-existent subscription: {notification['subscription_id']}"
                    logger.error(error_msg)
                    self.stats['errors'].append(error_msg)
                    return False
            
            logger.info("All foreign key relationships validated successfully")
            return True
            
        except Exception as e:
            error_msg = f"Foreign key validation failed: {e}"
            logger.error(error_msg)
            self.stats['errors'].append(error_msg)
            return False
    
    def generate_transformation_report(self) -> Dict[str, Any]:
        """Generate comprehensive transformation report."""
        report = {
            'transformation_timestamp': datetime.now().isoformat(),
            'input_directory': str(self.input_dir),
            'output_directory': str(self.output_dir),
            'transformation_statistics': self.stats,
            'sqlite_validation_db': self.temp_db_path,
            'files_created': []
        }
        
        # List all created files
        for file_path in self.output_dir.glob("*_transformed.json"):
            report['files_created'].append({
                'filename': file_path.name,
                'size_bytes': file_path.stat().st_size,
                'size_mb': round(file_path.stat().st_size / 1024 / 1024, 2)
            })
        
        return report
    
    def cleanup(self):
        """Clean up temporary resources."""
        if self.temp_db_path and os.path.exists(self.temp_db_path):
            os.unlink(self.temp_db_path)
            logger.info("Cleaned up temporary SQLite database")


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description='Transform PostgreSQL export data for D1 migration')
    parser.add_argument('--input-dir', default='migration_data',
                       help='Input directory containing PostgreSQL export (default: migration_data)')
    parser.add_argument('--output-dir', default='d1_migration_data',
                       help='Output directory for transformed data (default: d1_migration_data)')
    parser.add_argument('--validate', action='store_true',
                       help='Validate foreign key relationships after transformation')
    parser.add_argument('--keep-temp-db', action='store_true',
                       help='Keep temporary SQLite database for inspection')
    
    args = parser.parse_args()
    
    transformer = DataTransformer(args.input_dir, args.output_dir)
    
    try:
        logger.info(f"Starting data transformation from {args.input_dir} to {args.output_dir}")
        
        # Transform all tables
        if not transformer.transform_all_tables():
            logger.error("Data transformation completed with errors")
            sys.exit(1)
        
        # Validate foreign keys if requested
        if args.validate:
            if not transformer.validate_foreign_keys():
                logger.error("Foreign key validation failed")
                sys.exit(1)
            logger.info("Foreign key validation passed")
        
        # Generate and save report
        report = transformer.generate_transformation_report()
        report_file = transformer.output_dir / "transformation_report.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        logger.info("Data transformation completed successfully!")
        logger.info(f"Tables processed: {report['transformation_statistics']['tables_processed']}")
        logger.info(f"Records transformed: {report['transformation_statistics']['records_transformed']}")
        logger.info(f"Output directory: {report['output_directory']}")
        
        if report['transformation_statistics']['errors']:
            logger.warning(f"Completed with {len(report['transformation_statistics']['errors'])} errors")
            for error in report['transformation_statistics']['errors']:
                logger.warning(f"  - {error}")
        
    except Exception as e:
        logger.error(f"Data transformation failed: {e}")
        sys.exit(1)
    
    finally:
        if not args.keep_temp_db:
            transformer.cleanup()


if __name__ == "__main__":
    main()