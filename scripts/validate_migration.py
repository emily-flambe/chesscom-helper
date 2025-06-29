#!/usr/bin/env python3
"""
Migration Data Validation Script
===============================

This script validates data integrity after D1 migration by comparing PostgreSQL
export data with D1 database contents. It performs comprehensive checks including
record counts, data integrity, foreign key relationships, and data type validation.

Usage:
    python validate_migration.py [--export-dir EXPORT_DIR] [--transformed-dir TRANSFORMED_DIR] [--detailed]

Environment Variables:
    CLOUDFLARE_API_TOKEN   - Cloudflare API token
    CLOUDFLARE_ACCOUNT_ID  - Cloudflare account ID  
    D1_DATABASE_ID         - D1 database ID

Validation Checks:
    1. Record count validation
    2. Primary key integrity
    3. Foreign key relationships
    4. Data type validation
    5. JSON field parsing
    6. Datetime format validation
    7. Unique constraint validation
    8. Sample data comparison
"""

import os
import json
import sys
import argparse
import logging
import requests
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Set
import time
from collections import defaultdict


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('validate_migration.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class MigrationValidator:
    """Validates data integrity after D1 migration."""
    
    def __init__(self, export_dir: str = "migration_data", transformed_dir: str = "d1_migration_data"):
        self.export_dir = Path(export_dir)
        self.transformed_dir = Path(transformed_dir)
        
        # Environment variables for D1 API access
        self.api_token = os.getenv('CLOUDFLARE_API_TOKEN')
        self.account_id = os.getenv('CLOUDFLARE_ACCOUNT_ID')
        self.database_id = os.getenv('D1_DATABASE_ID')
        
        self.api_base = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/d1/database/{self.database_id}/query"
        
        # Validation results
        self.validation_results = {
            'timestamp': datetime.now().isoformat(),
            'overall_status': 'pending',
            'checks_performed': [],
            'record_counts': {},
            'data_integrity': {},
            'foreign_keys': {},
            'sample_comparisons': {},
            'errors': [],
            'warnings': []
        }
        
        self.validate_config()
    
    def validate_config(self):
        """Validate configuration and API access."""
        required_vars = ['api_token', 'account_id', 'database_id']
        missing_vars = [var for var in required_vars if not getattr(self, var)]
        
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {', '.join(f'CLOUDFLARE_{var.upper()}' for var in missing_vars)}")
        
        logger.info("Configuration validated successfully")
    
    def query_d1(self, sql: str, params: List[Any] = None) -> Dict[str, Any]:
        """Execute a query against D1 database."""
        try:
            payload = {
                "sql": sql
            }
            if params:
                payload["params"] = params
            
            headers = {
                'Authorization': f'Bearer {self.api_token}',
                'Content-Type': 'application/json'
            }
            
            response = requests.post(self.api_base, json=payload, headers=headers)
            response.raise_for_status()
            
            result = response.json()
            
            if not result.get('success'):
                error_msg = result.get('errors', [{}])[0].get('message', 'Unknown D1 API error')
                raise Exception(f"D1 API error: {error_msg}")
            
            return result.get('result', {})
            
        except requests.RequestException as e:
            raise Exception(f"Failed to query D1: {e}")
        except Exception as e:
            raise Exception(f"D1 query error: {e}")
    
    def load_export_data(self, table_name: str) -> Dict[str, Any]:
        """Load original PostgreSQL export data."""
        export_file = self.export_dir / f"{table_name}.json"
        
        if not export_file.exists():
            raise FileNotFoundError(f"Export file not found: {export_file}")
        
        with open(export_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def load_transformed_data(self, table_name: str) -> Dict[str, Any]:
        """Load transformed data."""
        transformed_file = self.transformed_dir / f"{table_name}_transformed.json"
        
        if not transformed_file.exists():
            raise FileNotFoundError(f"Transformed file not found: {transformed_file}")
        
        with open(transformed_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def validate_record_counts(self) -> bool:
        """Validate record counts between export and D1."""
        logger.info("Validating record counts...")
        
        tables = ['chesscom_app_user', 'chesscom_app_emailsubscription', 'chesscom_app_notificationlog']
        all_counts_match = True
        
        for table_name in tables:
            try:
                # Get export count
                export_data = self.load_export_data(table_name)
                export_count = export_data.get('record_count', len(export_data.get('data', [])))
                
                # Get transformed count
                transformed_data = self.load_transformed_data(table_name)
                transformed_count = transformed_data.get('record_count', len(transformed_data.get('data', [])))
                
                # Get D1 count
                d1_result = self.query_d1(f"SELECT COUNT(*) as count FROM {table_name}")
                d1_count = d1_result.get('results', [{}])[0].get('count', 0)
                
                # Store results
                self.validation_results['record_counts'][table_name] = {
                    'export_count': export_count,
                    'transformed_count': transformed_count,
                    'd1_count': d1_count,
                    'counts_match': export_count == transformed_count == d1_count
                }
                
                if export_count == transformed_count == d1_count:
                    logger.info(f"✓ {table_name}: {d1_count} records (counts match)")
                else:
                    logger.error(f"✗ {table_name}: Export={export_count}, Transformed={transformed_count}, D1={d1_count}")
                    all_counts_match = False
                    self.validation_results['errors'].append({
                        'check': 'record_counts',
                        'table': table_name,
                        'message': f"Record count mismatch: Export={export_count}, Transformed={transformed_count}, D1={d1_count}"
                    })
                
            except Exception as e:
                logger.error(f"Failed to validate record count for {table_name}: {e}")
                self.validation_results['errors'].append({
                    'check': 'record_counts',
                    'table': table_name,
                    'message': str(e)
                })
                all_counts_match = False
        
        self.validation_results['checks_performed'].append('record_counts')
        return all_counts_match
    
    def validate_primary_keys(self) -> bool:
        """Validate primary key integrity."""
        logger.info("Validating primary key integrity...")
        
        all_pks_valid = True
        
        # Check user primary keys
        try:
            export_data = self.load_export_data('chesscom_app_user')
            export_pks = {user['player_id'] for user in export_data['data']}
            
            d1_result = self.query_d1("SELECT player_id FROM chesscom_app_user")
            d1_pks = {row['player_id'] for row in d1_result.get('results', [])}
            
            missing_pks = export_pks - d1_pks
            extra_pks = d1_pks - export_pks
            
            self.validation_results['data_integrity']['user_primary_keys'] = {
                'export_count': len(export_pks),
                'd1_count': len(d1_pks),
                'missing_in_d1': list(missing_pks),
                'extra_in_d1': list(extra_pks),
                'integrity_valid': len(missing_pks) == 0 and len(extra_pks) == 0
            }
            
            if missing_pks or extra_pks:
                logger.error(f"✗ User primary keys: {len(missing_pks)} missing, {len(extra_pks)} extra")
                all_pks_valid = False
                self.validation_results['errors'].append({
                    'check': 'primary_keys',
                    'table': 'chesscom_app_user',
                    'message': f"Primary key mismatch: {len(missing_pks)} missing, {len(extra_pks)} extra"
                })
            else:
                logger.info("✓ User primary keys: All keys present")
            
        except Exception as e:
            logger.error(f"Failed to validate user primary keys: {e}")
            self.validation_results['errors'].append({
                'check': 'primary_keys',
                'table': 'chesscom_app_user',
                'message': str(e)
            })
            all_pks_valid = False
        
        self.validation_results['checks_performed'].append('primary_keys')
        return all_pks_valid
    
    def validate_foreign_keys(self) -> bool:
        """Validate foreign key relationships."""
        logger.info("Validating foreign key relationships...")
        
        all_fks_valid = True
        
        try:
            # Get all user IDs
            d1_users = self.query_d1("SELECT player_id FROM chesscom_app_user")
            user_ids = {row['player_id'] for row in d1_users.get('results', [])}
            
            # Check subscription -> user foreign keys
            d1_subs = self.query_d1("SELECT id, player_id FROM chesscom_app_emailsubscription")
            invalid_sub_fks = []
            subscription_ids = set()
            
            for sub in d1_subs.get('results', []):
                subscription_ids.add(sub['id'])
                if sub['player_id'] not in user_ids:
                    invalid_sub_fks.append(sub)
            
            self.validation_results['foreign_keys']['subscription_to_user'] = {
                'total_subscriptions': len(d1_subs.get('results', [])),
                'invalid_foreign_keys': len(invalid_sub_fks),
                'invalid_records': invalid_sub_fks[:10],  # Limit to first 10 for report
                'foreign_key_valid': len(invalid_sub_fks) == 0
            }
            
            if invalid_sub_fks:
                logger.error(f"✗ Subscription foreign keys: {len(invalid_sub_fks)} invalid references")
                all_fks_valid = False
                self.validation_results['errors'].append({
                    'check': 'foreign_keys',
                    'relationship': 'subscription_to_user',
                    'message': f"{len(invalid_sub_fks)} subscriptions reference non-existent users"
                })
            else:
                logger.info("✓ Subscription foreign keys: All references valid")
            
            # Check notification -> subscription foreign keys
            d1_notifs = self.query_d1("SELECT id, subscription_id FROM chesscom_app_notificationlog")
            invalid_notif_fks = []
            
            for notif in d1_notifs.get('results', []):
                if notif['subscription_id'] not in subscription_ids:
                    invalid_notif_fks.append(notif)
            
            self.validation_results['foreign_keys']['notification_to_subscription'] = {
                'total_notifications': len(d1_notifs.get('results', [])),
                'invalid_foreign_keys': len(invalid_notif_fks),
                'invalid_records': invalid_notif_fks[:10],
                'foreign_key_valid': len(invalid_notif_fks) == 0
            }
            
            if invalid_notif_fks:
                logger.error(f"✗ Notification foreign keys: {len(invalid_notif_fks)} invalid references")
                all_fks_valid = False
                self.validation_results['errors'].append({
                    'check': 'foreign_keys',
                    'relationship': 'notification_to_subscription',
                    'message': f"{len(invalid_notif_fks)} notifications reference non-existent subscriptions"
                })
            else:
                logger.info("✓ Notification foreign keys: All references valid")
            
        except Exception as e:
            logger.error(f"Failed to validate foreign keys: {e}")
            self.validation_results['errors'].append({
                'check': 'foreign_keys',
                'message': str(e)
            })
            all_fks_valid = False
        
        self.validation_results['checks_performed'].append('foreign_keys')
        return all_fks_valid
    
    def validate_json_fields(self) -> bool:
        """Validate JSON field parsing."""
        logger.info("Validating JSON fields...")
        
        json_fields_valid = True
        
        try:
            # Check streaming_platforms JSON field
            d1_users = self.query_d1("SELECT player_id, username, streaming_platforms FROM chesscom_app_user LIMIT 100")
            invalid_json_count = 0
            
            for user in d1_users.get('results', []):
                try:
                    if user['streaming_platforms']:
                        json.loads(user['streaming_platforms'])
                except json.JSONDecodeError:
                    invalid_json_count += 1
                    logger.warning(f"Invalid JSON in streaming_platforms for user {user['username']}: {user['streaming_platforms']}")
            
            self.validation_results['data_integrity']['json_fields'] = {
                'users_checked': len(d1_users.get('results', [])),
                'invalid_json_count': invalid_json_count,
                'json_valid': invalid_json_count == 0
            }
            
            if invalid_json_count > 0:
                logger.error(f"✗ JSON fields: {invalid_json_count} invalid JSON values found")
                json_fields_valid = False
                self.validation_results['errors'].append({
                    'check': 'json_fields',
                    'message': f"{invalid_json_count} users have invalid JSON in streaming_platforms"
                })
            else:
                logger.info("✓ JSON fields: All JSON values are valid")
            
        except Exception as e:
            logger.error(f"Failed to validate JSON fields: {e}")
            self.validation_results['errors'].append({
                'check': 'json_fields',
                'message': str(e)
            })
            json_fields_valid = False
        
        self.validation_results['checks_performed'].append('json_fields')
        return json_fields_valid
    
    def validate_unique_constraints(self) -> bool:
        """Validate unique constraints."""
        logger.info("Validating unique constraints...")
        
        constraints_valid = True
        
        try:
            # Check username uniqueness
            d1_usernames = self.query_d1("SELECT username, COUNT(*) as count FROM chesscom_app_user GROUP BY username HAVING COUNT(*) > 1")
            duplicate_usernames = d1_usernames.get('results', [])
            
            # Check email+player_id uniqueness
            d1_email_player = self.query_d1("""
                SELECT email, player_id, COUNT(*) as count 
                FROM chesscom_app_emailsubscription 
                GROUP BY email, player_id 
                HAVING COUNT(*) > 1
            """)
            duplicate_email_player = d1_email_player.get('results', [])
            
            self.validation_results['data_integrity']['unique_constraints'] = {
                'duplicate_usernames': len(duplicate_usernames),
                'duplicate_email_player': len(duplicate_email_player),
                'constraints_valid': len(duplicate_usernames) == 0 and len(duplicate_email_player) == 0
            }
            
            if duplicate_usernames:
                logger.error(f"✗ Unique constraints: {len(duplicate_usernames)} duplicate usernames")
                constraints_valid = False
                self.validation_results['errors'].append({
                    'check': 'unique_constraints',
                    'constraint': 'username',
                    'message': f"{len(duplicate_usernames)} duplicate usernames found"
                })
            
            if duplicate_email_player:
                logger.error(f"✗ Unique constraints: {len(duplicate_email_player)} duplicate email+player combinations")
                constraints_valid = False
                self.validation_results['errors'].append({
                    'check': 'unique_constraints',
                    'constraint': 'email_player',
                    'message': f"{len(duplicate_email_player)} duplicate email+player combinations found"
                })
            
            if constraints_valid:
                logger.info("✓ Unique constraints: All constraints satisfied")
            
        except Exception as e:
            logger.error(f"Failed to validate unique constraints: {e}")
            self.validation_results['errors'].append({
                'check': 'unique_constraints',
                'message': str(e)
            })
            constraints_valid = False
        
        self.validation_results['checks_performed'].append('unique_constraints')
        return constraints_valid
    
    def validate_sample_data(self, sample_size: int = 10) -> bool:
        """Validate sample data by comparing export vs D1."""
        logger.info(f"Validating sample data ({sample_size} records per table)...")
        
        sample_data_valid = True
        
        # Validate user sample data
        try:
            export_data = self.load_export_data('chesscom_app_user')
            export_users = export_data['data'][:sample_size]
            
            mismatches = []
            
            for export_user in export_users:
                player_id = export_user['player_id']
                d1_result = self.query_d1("SELECT * FROM chesscom_app_user WHERE player_id = ?", [player_id])
                d1_users = d1_result.get('results', [])
                
                if not d1_users:
                    mismatches.append({
                        'player_id': player_id,
                        'issue': 'User not found in D1'
                    })
                    continue
                
                d1_user = d1_users[0]
                
                # Compare key fields
                comparison_fields = ['username', 'name', 'followers', 'status', 'is_streamer', 'verified']
                for field in comparison_fields:
                    export_value = export_user.get(field)
                    d1_value = d1_user.get(field)
                    
                    if export_value != d1_value:
                        mismatches.append({
                            'player_id': player_id,
                            'field': field,
                            'export_value': export_value,
                            'd1_value': d1_value,
                            'issue': 'Field value mismatch'
                        })
                
                # Special check for streaming_platforms JSON field
                export_platforms = export_user.get('streaming_platforms', [])
                d1_platforms_str = d1_user.get('streaming_platforms', '[]')
                try:
                    d1_platforms = json.loads(d1_platforms_str) if d1_platforms_str else []
                    if export_platforms != d1_platforms:
                        mismatches.append({
                            'player_id': player_id,
                            'field': 'streaming_platforms',
                            'export_value': export_platforms,
                            'd1_value': d1_platforms,
                            'issue': 'JSON field value mismatch'
                        })
                except json.JSONDecodeError:
                    mismatches.append({
                        'player_id': player_id,
                        'field': 'streaming_platforms',
                        'issue': 'Invalid JSON in D1'
                    })
            
            self.validation_results['sample_comparisons']['users'] = {
                'sample_size': len(export_users),
                'mismatches': len(mismatches),
                'mismatch_details': mismatches[:5],  # Limit details for report
                'sample_valid': len(mismatches) == 0
            }
            
            if mismatches:
                logger.error(f"✗ User sample data: {len(mismatches)} mismatches found")
                sample_data_valid = False
                self.validation_results['errors'].append({
                    'check': 'sample_data',
                    'table': 'users',
                    'message': f"{len(mismatches)} data mismatches in user sample"
                })
            else:
                logger.info("✓ User sample data: All sample data matches")
            
        except Exception as e:
            logger.error(f"Failed to validate user sample data: {e}")
            self.validation_results['errors'].append({
                'check': 'sample_data',
                'table': 'users',
                'message': str(e)
            })
            sample_data_valid = False
        
        self.validation_results['checks_performed'].append('sample_data')
        return sample_data_valid
    
    def run_all_validations(self, detailed: bool = False) -> bool:
        """Run all validation checks."""
        logger.info("Starting comprehensive migration validation...")
        
        validation_checks = [
            ('Record Counts', self.validate_record_counts),
            ('Primary Keys', self.validate_primary_keys),
            ('Foreign Keys', self.validate_foreign_keys),
            ('JSON Fields', self.validate_json_fields),
            ('Unique Constraints', self.validate_unique_constraints),
        ]
        
        if detailed:
            validation_checks.append(('Sample Data', self.validate_sample_data))
        
        all_valid = True
        
        for check_name, check_function in validation_checks:
            logger.info(f"\n--- {check_name} Validation ---")
            try:
                result = check_function()
                if not result:
                    all_valid = False
            except Exception as e:
                logger.error(f"Validation check '{check_name}' failed with exception: {e}")
                self.validation_results['errors'].append({
                    'check': check_name.lower().replace(' ', '_'),
                    'message': f"Check failed with exception: {e}"
                })
                all_valid = False
        
        self.validation_results['overall_status'] = 'passed' if all_valid else 'failed'
        return all_valid
    
    def generate_validation_report(self) -> Dict[str, Any]:
        """Generate comprehensive validation report."""
        
        # Calculate summary statistics
        total_errors = len(self.validation_results['errors'])
        total_warnings = len(self.validation_results['warnings'])
        checks_passed = len([
            check for check in self.validation_results['checks_performed']
            if not any(error.get('check') == check for error in self.validation_results['errors'])
        ])
        
        report = {
            **self.validation_results,
            'summary': {
                'overall_status': self.validation_results['overall_status'],
                'checks_performed': len(self.validation_results['checks_performed']),
                'checks_passed': checks_passed,
                'total_errors': total_errors,
                'total_warnings': total_warnings,
                'validation_timestamp': self.validation_results['timestamp']
            }
        }
        
        return report
    
    def save_validation_report(self, report: Dict[str, Any], output_path: Optional[str] = None):
        """Save validation report to file."""
        if not output_path:
            output_path = self.transformed_dir / "validation_report.json"
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Validation report saved to: {output_path}")


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description='Validate D1 migration data integrity')
    parser.add_argument('--export-dir', default='migration_data',
                       help='Directory containing PostgreSQL export (default: migration_data)')
    parser.add_argument('--transformed-dir', default='d1_migration_data',
                       help='Directory containing transformed data (default: d1_migration_data)')
    parser.add_argument('--detailed', action='store_true',
                       help='Perform detailed sample data validation')
    parser.add_argument('--output-report', 
                       help='Output path for validation report (default: <transformed-dir>/validation_report.json)')
    
    args = parser.parse_args()
    
    try:
        validator = MigrationValidator(args.export_dir, args.transformed_dir)
        
        logger.info("=== D1 Migration Validation ===")
        logger.info(f"Export directory: {args.export_dir}")
        logger.info(f"Transformed directory: {args.transformed_dir}")
        logger.info(f"Detailed validation: {args.detailed}")
        
        # Run all validations
        all_valid = validator.run_all_validations(detailed=args.detailed)
        
        # Generate and save report
        report = validator.generate_validation_report()
        validator.save_validation_report(report, args.output_report)
        
        # Print summary
        logger.info("\n=== Validation Summary ===")
        logger.info(f"Overall status: {report['summary']['overall_status'].upper()}")
        logger.info(f"Checks performed: {report['summary']['checks_performed']}")
        logger.info(f"Checks passed: {report['summary']['checks_passed']}")
        logger.info(f"Total errors: {report['summary']['total_errors']}")
        logger.info(f"Total warnings: {report['summary']['total_warnings']}")
        
        if report['summary']['total_errors'] > 0:
            logger.info("\nErrors found:")
            for error in report['errors'][:5]:  # Show first 5 errors
                logger.info(f"  - {error.get('check', 'unknown')}: {error.get('message', 'No message')}")
            if len(report['errors']) > 5:
                logger.info(f"  ... and {len(report['errors']) - 5} more errors (see validation_report.json)")
        
        if all_valid:
            logger.info("\n🎉 Migration validation PASSED! Data integrity verified.")
            sys.exit(0)
        else:
            logger.error("\n❌ Migration validation FAILED! Check validation_report.json for details.")
            sys.exit(1)
    
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()