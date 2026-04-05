#!/usr/bin/env python3
"""
Quick SMTP configuration test script.
Run this after setting up your Google App Password in .env
"""

import os
import sys
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

sys.path.insert(0, os.path.dirname(__file__))

from services.email_service import send_otp_email


async def test_smtp_configuration():
    """Test SMTP setup with a test email"""
    
    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("TERRITORY RUNNER - EMAIL CONFIGURATION TEST")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
    
    # Check environment setup
    host = os.getenv("SMTP_HOST")
    port = os.getenv("SMTP_PORT")
    username = os.getenv("SMTP_USERNAME")
    from_email = os.getenv("SMTP_FROM_EMAIL")
    use_tls = os.getenv("SMTP_USE_TLS", "true")
    debug_mode = os.getenv("OTP_DEBUG_MODE", "false").lower() == "true"
    
    print("Configuration Check:")
    print(f"  SMTP_HOST: {host or '❌ NOT SET'}")
    print(f"  SMTP_PORT: {port or '587'}")
    print(f"  SMTP_USERNAME: {username or '❌ NOT SET'}")
    print(f"  SMTP_FROM_EMAIL: {from_email or '❌ NOT SET'}")
    print(f"  SMTP_USE_TLS: {use_tls}")
    print(f"  OTP_DEBUG_MODE: {debug_mode} (should be False for production)")
    
    if not host or not username:
        print("\n❌ SMTP configuration incomplete!")
        print("   Please set SMTP_HOST and SMTP_USERNAME in your .env file")
        return False
    
    # Test email sending
    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("Sending Test OTP Email...")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
    
    # Use the same email as SMTP_USERNAME for testing
    test_email = username
    test_code = "123456"
    
    print(f"Sending to: {test_email}")
    print(f"Test code: {test_code}")
    print("Waiting...\n")
    
    try:
        success = await send_otp_email(test_email, test_code, "signup", 10)
        
        if success:
            print("✅ Email sent successfully!")
            print(f"\nCheck your inbox at {test_email}")
            print("You should receive an email with the code: 123456")
            return True
        else:
            print("❌ Email sending failed (check backend logs for details)")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


if __name__ == "__main__":
    success = asyncio.run(test_smtp_configuration())
    sys.exit(0 if success else 1)
