
import os
import time
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
# We need the service key to create/manage the test user
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env")
    exit(1)

# Initialize Supabase Admin Client
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def test_password_change_flow():
    test_email = f"test_user_{int(time.time())}@example.com"
    initial_password = "OldPassword123!"
    new_password = "NewPassword456!"
    
    user_id = None

    try:
        print(f"🚀 Starting Password Change Test for {test_email}...")

        # 1. Create a test user via Admin API
        print("Creating test user...")
        user_response = supabase_admin.auth.admin.create_user({
            "email": test_email,
            "password": initial_password,
            "email_confirm": True
        })
        
        # Accessing user from the response object
        user_id = user_response.user.id
        print(f"✅ Test user created with ID: {user_id}")

        # 2. Sign in as the test user to get a session
        # Note: We use a separate client instance for the "user" session
        user_client: Client = create_client(SUPABASE_URL, os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
        
        print("Signing in with initial password...")
        login_response = user_client.auth.sign_in_with_password({
            "email": test_email,
            "password": initial_password
        })
        
        if not login_response.session:
             print("❌ Failed to sign in with initial password")
             return

        print("✅ Signed in successfully.")

        # 3. Update Password
        print(f"Updating password to: {new_password}...")
        update_response = user_client.auth.update_user({
            "password": new_password
        })

        # Check if update was successful
        # The python SDK might return user object on success
        if update_response.user:
            print("✅ Password updated successfully.")
        else:
            print("❌ Failed to update password.")
            return

        # 4. Sign out 
        print("Signing out...")
        user_client.auth.sign_out()

        # 5. Verify sign in with NEW password
        print("Verifying sign in with NEW password...")
        verify_login = user_client.auth.sign_in_with_password({
            "email": test_email,
            "password": new_password
        })

        if verify_login.session:
            print("🎉 SUCCESS: Signed in with the new password!")
        else:
            print("❌ ERROR: Could not sign in with the new password.")

        # 6. Verify sign in with OLD password should FAIL
        print("Verifying OLD password fails...")
        try:
            old_login = user_client.auth.sign_in_with_password({
                "email": test_email,
                "password": initial_password
            })
            if old_login.session:
                 print("❌ SECURITY ERROR: Old password still works!")
            else:
                 print("✅ Old password rejected as expected.")
        except Exception:
             print("✅ Old password rejected (exception) as expected.")

    except Exception as e:
        print(f"❌ Test failed with exception: {str(e)}")
    
    finally:
        # Cleanup: Delete the test user
        if user_id:
            print(f"Cleaning up: Deleting user {user_id}...")
            supabase_admin.auth.admin.delete_user(user_id)
            print("✅ Cleanup complete.")

if __name__ == "__main__":
    test_password_change_flow()
