"""
Test script to verify fallback extraction systems are working.
Run this to ensure pytubefix and instaloader are properly installed.

Usage:
    python test_fallbacks.py
"""

import sys


def test_imports():
    """Test if fallback libraries can be imported."""
    print("=" * 60)
    print("Testing Fallback Extractor Imports")
    print("=" * 60)
    
    success = True
    
    # Test pytubefix
    try:
        from pytubefix import YouTube
        print("✅ pytubefix imported successfully")
    except ImportError as e:
        print(f"❌ pytubefix import failed: {e}")
        print("   Install with: pip install pytubefix")
        success = False
    
    # Test instaloader
    try:
        import instaloader
        print("✅ instaloader imported successfully")
    except ImportError as e:
        print(f"❌ instaloader import failed: {e}")
        print("   Install with: pip install instaloader")
        success = False
    
    # Test fallback_extractors module
    try:
        from backend.services import fallback_extractors
        print("✅ fallback_extractors module loaded successfully")
    except ImportError as e:
        print(f"❌ fallback_extractors module failed: {e}")
        success = False
    
    print("=" * 60)
    
    if success:
        print("✅ All fallback extractors are ready!")
        print("\nThe system will automatically use:")
        print("  • pytubefix for YouTube when yt-dlp fails")
        print("  • instaloader for Instagram when yt-dlp fails")
        return 0
    else:
        print("❌ Some fallback extractors are missing")
        print("\nTo install missing packages:")
        print("  pip install pytubefix instaloader")
        return 1


def test_youtube_fallback():
    """Test YouTube fallback extraction (optional - requires internet)."""
    print("\n" + "=" * 60)
    print("Testing YouTube Fallback (pytubefix)")
    print("=" * 60)
    
    try:
        from pytubefix import YouTube
        
        # Use a public YouTube video
        test_url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"  # "Me at the zoo" - first YouTube video
        print(f"Testing with: {test_url}")
        
        yt = YouTube(test_url)
        print(f"✅ Title: {yt.title}")
        print(f"✅ Duration: {yt.length} seconds")
        print(f"✅ Available streams: {len(yt.streams)} formats")
        print("✅ YouTube fallback is working!")
        return True
        
    except Exception as e:
        print(f"⚠️  YouTube fallback test failed: {e}")
        print("   This might be temporary - the fallback may still work for other videos")
        return False


def test_basic_functionality():
    """Test that the fallback functions exist and are callable."""
    print("\n" + "=" * 60)
    print("Testing Fallback Function Availability")
    print("=" * 60)
    
    try:
        from backend.services import fallback_extractors
        
        functions = [
            "get_youtube_metadata_fallback",
            "download_youtube_video_fallback",
            "get_instagram_metadata_fallback",
            "download_instagram_video_fallback",
        ]
        
        for func_name in functions:
            if hasattr(fallback_extractors, func_name):
                print(f"✅ {func_name} is available")
            else:
                print(f"❌ {func_name} is missing")
                return False
        
        return True
        
    except Exception as e:
        print(f"❌ Error checking functions: {e}")
        return False


def main():
    """Run all tests."""
    print("\n🧪 MediaLoader Fallback System Test Suite\n")
    
    # Test imports (required)
    result = test_imports()
    if result != 0:
        print("\n❌ Critical imports failed. Fix these first!")
        return result
    
    # Test function availability
    if not test_basic_functionality():
        print("\n❌ Fallback functions are not properly configured")
        return 1
    
    # Test YouTube fallback (optional - requires internet)
    print("\n📡 Testing live extraction (requires internet)...")
    response = input("Test YouTube fallback with internet connection? (y/n): ").lower()
    if response == 'y':
        test_youtube_fallback()
    else:
        print("⏭️  Skipped live YouTube test")
    
    print("\n" + "=" * 60)
    print("✅ Fallback system test complete!")
    print("=" * 60)
    print("\nYour MediaLoader instance will now:")
    print("  1. Try yt-dlp (12 strategies)")
    print("  2. If yt-dlp fails:")
    print("     • Use pytubefix for YouTube")
    print("     • Use instaloader for Instagram")
    print("  3. Return error only if all methods fail")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
