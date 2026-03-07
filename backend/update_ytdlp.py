"""
Simple script to update yt-dlp to the latest version.
Run this if you're experiencing YouTube extraction issues.

Usage:
    python update_ytdlp.py
"""

import subprocess
import sys

def update_ytdlp():
    """Update yt-dlp to the latest version."""
    print("🔄 Updating yt-dlp to the latest version...")
    print("=" * 60)
    
    try:
        # Update yt-dlp
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--upgrade", "yt-dlp"],
            capture_output=True,
            text=True,
            check=True
        )
        
        print(result.stdout)
        print("✅ yt-dlp updated successfully!")
        print("=" * 60)
        
        # Check the new version
        try:
            import yt_dlp
            version = yt_dlp.version.__version__
            print(f"📦 Current yt-dlp version: {version}")
        except Exception as e:
            print(f"⚠️  Could not check version: {e}")
        
        print("\n🔄 Please restart your backend service for changes to take effect.")
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Error updating yt-dlp: {e}")
        print(e.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    update_ytdlp()
