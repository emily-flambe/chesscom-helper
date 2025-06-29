#!/usr/bin/env python3
"""
Migration Pipeline Test Script
=============================

This script tests the complete migration pipeline with sample data to ensure
all components work correctly before running the actual migration.

Usage:
    python test_migration_pipeline.py [--cleanup]

This script will:
1. Create sample PostgreSQL export data
2. Test data transformation
3. Validate transformation results
4. Test import script (dry run)
5. Generate test report
"""

import os
import json
import sys
import tempfile
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
import argparse


def create_sample_export_data(test_dir: Path):
    """Create sample PostgreSQL export data for testing."""
    print("Creating sample export data...")
    
    # Sample user data
    sample_users = [
        {
            "player_id": 123456789,
            "username": "testuser1",
            "name": "Test User One",
            "url": "https://chess.com/member/testuser1",
            "country": "https://chess.com/country/US",
            "location": "New York, NY",
            "followers": 150,
            "last_online": 1703980800,
            "joined": 1640995200,
            "status": "online",
            "league": "Champion",
            "is_streamer": True,
            "verified": False,
            "is_playing": False,
            "streaming_platforms": [
                {"platform": "twitch", "url": "https://twitch.tv/testuser1"},
                {"platform": "youtube", "url": "https://youtube.com/testuser1"}
            ]
        },
        {
            "player_id": 987654321,
            "username": "testuser2",
            "name": "Test User Two",
            "url": "https://chess.com/member/testuser2",
            "country": "https://chess.com/country/GB",
            "location": "London, UK",
            "followers": 75,
            "last_online": 1703967200,
            "joined": 1641081600,
            "status": "offline",
            "league": "Diamond",
            "is_streamer": False,
            "verified": True,
            "is_playing": True,
            "streaming_platforms": []
        }
    ]
    
    # Sample subscription data
    sample_subscriptions = [
        {
            "id": 1,
            "email": "user1@example.com",
            "player_id": 123456789,
            "created_at": "2024-01-01T10:00:00Z",
            "is_active": True
        },
        {
            "id": 2,
            "email": "user2@example.com",
            "player_id": 123456789,
            "created_at": "2024-01-02T11:30:00Z",
            "is_active": True
        },
        {
            "id": 3,
            "email": "user3@example.com",
            "player_id": 987654321,
            "created_at": "2024-01-03T09:15:00Z",
            "is_active": False
        }
    ]
    
    # Sample notification data
    sample_notifications = [
        {
            "id": 1,
            "subscription_id": 1,
            "sent_at": "2024-01-01T15:30:00Z",
            "notification_type": "live_match",
            "success": True,
            "error_message": None
        },
        {
            "id": 2,
            "subscription_id": 2,
            "sent_at": "2024-01-02T16:45:00Z",
            "notification_type": "live_match",
            "success": False,
            "error_message": "SMTP connection failed"
        }
    ]
    
    # Create export files
    tables = [
        ("chesscom_app_user", sample_users),
        ("chesscom_app_emailsubscription", sample_subscriptions),
        ("chesscom_app_notificationlog", sample_notifications)
    ]
    
    for table_name, data in tables:
        export_data = {
            "table_name": table_name,
            "schema": [],  # Simplified for testing
            "data": data,
            "record_count": len(data),
            "exported_at": datetime.now().isoformat()
        }
        
        with open(test_dir / f"{table_name}.json", 'w') as f:
            json.dump(export_data, f, indent=2)
    
    print(f"Created sample export data in {test_dir}")


def test_transformation(test_dir: Path, scripts_dir: Path) -> bool:
    """Test the data transformation script."""
    print("\nTesting data transformation...")
    
    try:
        # Run transformation script
        result = subprocess.run([
            sys.executable,
            str(scripts_dir / "transform_data_for_d1.py"),
            "--input-dir", str(test_dir),
            "--output-dir", str(test_dir / "transformed"),
            "--validate"
        ], capture_output=True, text=True, cwd=scripts_dir)
        
        if result.returncode != 0:
            print(f"Transformation failed: {result.stderr}")
            return False
        
        # Check if transformed files were created
        transformed_dir = test_dir / "transformed"
        expected_files = [
            "chesscom_app_user_transformed.json",
            "chesscom_app_emailsubscription_transformed.json",
            "chesscom_app_notificationlog_transformed.json",
            "transformation_report.json"
        ]
        
        for filename in expected_files:
            file_path = transformed_dir / filename
            if not file_path.exists():
                print(f"Missing transformed file: {filename}")
                return False
        
        print("✓ Data transformation completed successfully")
        return True
        
    except Exception as e:
        print(f"Transformation test failed: {e}")
        return False


def test_import_script(test_dir: Path, scripts_dir: Path) -> bool:
    """Test the import script in dry-run mode."""
    print("\nTesting import script (dry run)...")
    
    try:
        # Set dummy environment variables for testing
        env = os.environ.copy()
        env.update({
            'CLOUDFLARE_API_TOKEN': 'test-token',
            'CLOUDFLARE_ACCOUNT_ID': 'test-account',
            'D1_DATABASE_ID': 'test-database'
        })
        
        # Run import script in dry-run mode
        result = subprocess.run([
            "node",
            str(scripts_dir / "import_to_d1.js"),
            "--input-dir", str(test_dir / "transformed"),
            "--dry-run"
        ], capture_output=True, text=True, cwd=scripts_dir, env=env)
        
        if result.returncode != 0:
            print(f"Import script test failed: {result.stderr}")
            return False
        
        print("✓ Import script test completed successfully")
        return True
        
    except Exception as e:
        print(f"Import script test failed: {e}")
        return False


def validate_transformed_data(test_dir: Path) -> bool:
    """Validate the transformed data structure."""
    print("\nValidating transformed data structure...")
    
    try:
        transformed_dir = test_dir / "transformed"
        
        # Load and validate user data
        with open(transformed_dir / "chesscom_app_user_transformed.json", 'r') as f:
            user_data = json.load(f)
        
        # Check required fields
        required_fields = ['player_id', 'username', 'streaming_platforms']
        for user in user_data['data']:
            for field in required_fields:
                if field not in user:
                    print(f"Missing required field '{field}' in user data")
                    return False
            
            # Validate JSON field is string
            if not isinstance(user['streaming_platforms'], str):
                print(f"streaming_platforms should be string, got {type(user['streaming_platforms'])}")
                return False
            
            # Validate JSON is parseable
            try:
                json.loads(user['streaming_platforms'])
            except json.JSONDecodeError:
                print(f"Invalid JSON in streaming_platforms: {user['streaming_platforms']}")
                return False
        
        # Load and validate subscription data
        with open(transformed_dir / "chesscom_app_emailsubscription_transformed.json", 'r') as f:
            sub_data = json.load(f)
        
        for sub in sub_data['data']:
            if 'email' not in sub or 'player_id' not in sub:
                print("Missing required fields in subscription data")
                return False
        
        print("✓ Transformed data structure validation passed")
        return True
        
    except Exception as e:
        print(f"Data validation failed: {e}")
        return False


def generate_test_report(test_dir: Path, results: dict) -> dict:
    """Generate comprehensive test report."""
    report = {
        "test_timestamp": datetime.now().isoformat(),
        "test_directory": str(test_dir),
        "test_results": results,
        "overall_status": "passed" if all(results.values()) else "failed",
        "files_created": []
    }
    
    # List all files created during testing
    for file_path in test_dir.rglob("*"):
        if file_path.is_file():
            report["files_created"].append({
                "path": str(file_path.relative_to(test_dir)),
                "size": file_path.stat().st_size
            })
    
    return report


def main():
    """Main test execution."""
    parser = argparse.ArgumentParser(description='Test migration pipeline')
    parser.add_argument('--cleanup', action='store_true',
                       help='Clean up test directory after completion')
    args = parser.parse_args()
    
    # Get script directory
    scripts_dir = Path(__file__).parent
    
    # Create temporary test directory
    test_dir = Path(tempfile.mkdtemp(prefix="migration_test_"))
    
    try:
        print(f"Migration Pipeline Test")
        print(f"Test directory: {test_dir}")
        print("=" * 50)
        
        # Test results
        results = {}
        
        # Step 1: Create sample data
        create_sample_export_data(test_dir)
        results['sample_data_creation'] = True
        
        # Step 2: Test transformation
        results['data_transformation'] = test_transformation(test_dir, scripts_dir)
        
        # Step 3: Validate transformed data
        if results['data_transformation']:
            results['data_validation'] = validate_transformed_data(test_dir)
        else:
            results['data_validation'] = False
        
        # Step 4: Test import script (dry run)
        if results['data_validation']:
            results['import_script_test'] = test_import_script(test_dir, scripts_dir)
        else:
            results['import_script_test'] = False
        
        # Generate test report
        report = generate_test_report(test_dir, results)
        report_path = test_dir / "test_report.json"
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        # Print summary
        print(f"\n{'='*50}")
        print("Test Summary:")
        print(f"Overall Status: {report['overall_status'].upper()}")
        
        for test_name, result in results.items():
            status = "✓ PASS" if result else "✗ FAIL"
            print(f"  {test_name}: {status}")
        
        print(f"\nTest report saved to: {report_path}")
        
        if not args.cleanup:
            print(f"Test files preserved in: {test_dir}")
            print("Use --cleanup flag to automatically remove test files")
        
        # Exit with appropriate code
        if report['overall_status'] == 'passed':
            print("\n🎉 All tests passed! Migration pipeline is ready.")
            exit_code = 0
        else:
            print("\n❌ Some tests failed. Check the output above for details.")
            exit_code = 1
        
    except Exception as e:
        print(f"Test execution failed: {e}")
        exit_code = 1
    
    finally:
        # Cleanup if requested
        if args.cleanup and test_dir.exists():
            shutil.rmtree(test_dir)
            print(f"Test directory cleaned up: {test_dir}")
    
    sys.exit(exit_code)


if __name__ == "__main__":
    main()