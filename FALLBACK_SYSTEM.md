# Fallback Extraction System

## Overview

MediaLoader now includes dedicated fallback libraries for YouTube and Instagram that automatically activate when yt-dlp fails. This provides enhanced reliability and resilience.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              User Request                       │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│        Primary: yt-dlp (12 strategies)          │
│  ├─ iOS Music                                   │
│  ├─ Android Creator                             │
│  ├─ Android VR                                  │
│  ├─ iOS Embedded                                │
│  ├─ Android TV                                  │
│  ├─ Media Connect                               │
│  ├─ TV Embedded                                 │
│  ├─ Mobile Web                                  │
│  ├─ Web with legacy                             │
│  ├─ Android Music                               │
│  ├─ Minimal config                              │
│  └─ Verbose/debug                               │
└────────────────────┬────────────────────────────┘
                     │
           All strategies failed?
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌───────────────┐         ┌───────────────┐
│   YouTube?    │         │  Instagram?   │
└───────┬───────┘         └───────┬───────┘
        │                         │
        ▼                         ▼
┌───────────────┐         ┌───────────────┐
│  pytubefix    │         │  instaloader  │
│   fallback    │         │    fallback   │
└───────┬───────┘         └───────┬───────┘
        │                         │
        └────────────┬────────────┘
                     │
                     ▼
           ┌─────────────────┐
           │  Return result  │
           │   or error      │
           └─────────────────┘
```

## Fallback Libraries

### 1. pytubefix (YouTube)

**When activated:** After all 12 yt-dlp strategies fail for YouTube URLs

**Capabilities:**
- Extract video metadata (title, duration, views, formats)
- Download progressive streams (video + audio combined)
- Download adaptive streams (video-only or audio-only)
- Support for various resolutions

**Limitations:**
- May not support all YouTube features
- Format selection is simpler than yt-dlp
- Some restricted videos may still fail

### 2. instaloader (Instagram)

**When activated:** When yt-dlp fails for Instagram URLs

**Capabilities:**
- Extract post metadata (caption, likes, views)
- Download videos from posts and reels
- Support for public content

**Limitations:**
- Cannot access private accounts
- Stories require authentication
- Rate limiting may apply

## Installation

Fallback libraries are included in `requirements.txt`:

```bash
cd backend
pip install -r requirements.txt
```

Or install manually:

```bash
pip install pytubefix>=6.10.0
pip install instaloader>=4.10.0
```

## Usage

The fallback system is **completely automatic**:

1. User requests a video URL
2. yt-dlp tries all 12 strategies
3. If all fail:
   - YouTube URLs → pytubefix attempts extraction
   - Instagram URLs → instaloader attempts extraction
4. Result is returned to the user (or error if both fail)

**No configuration needed!**

## Logging

Fallback activations are logged for monitoring:

```
WARNING: All yt-dlp strategies failed for YouTube URL, trying pytubefix fallback...
SUCCESS: Successfully extracted metadata using pytubefix fallback
```

Or in case of failure:

```
WARNING: All yt-dlp strategies failed for YouTube URL, trying pytubefix fallback...
ERROR: YouTube fallback also failed: Video unavailable
```

## Monitoring

Check if fallbacks are available on startup:

```
🚀 MediaLoader Media Engine started
📦 yt-dlp version: 2024.12.23
✅ Fallback extractors available (pytubefix, instaloader)
```

Or via the health endpoint:

```bash
curl http://localhost:10000/health
```

## Code Structure

### Files

- `backend/services/fallback_extractors.py` - Fallback extraction logic
- `backend/services/ytdlp_service.py` - Main extraction with fallback integration
- `backend/requirements.txt` - Dependencies

### Key Functions

#### Metadata Extraction
- `get_youtube_metadata_fallback(url)` - YouTube metadata via pytubefix
- `get_instagram_metadata_fallback(url)` - Instagram metadata via instaloader

#### Download
- `download_youtube_video_fallback(url, format_id)` - YouTube download via pytubefix
- `download_instagram_video_fallback(url)` - Instagram download via instaloader

## Error Handling

The system has three levels of error handling:

1. **yt-dlp strategies (1-12)** - Try different extraction methods
2. **Platform fallback** - Use dedicated library for YouTube/Instagram
3. **Final error** - Return user-friendly error message

This ensures maximum reliability and provides detailed error information when all methods fail.

## Performance Considerations

### First Request (Success)
- yt-dlp succeeds → Fast (1-3 seconds)

### First Request (Failure, with fallback success)
- All yt-dlp strategies fail (~30 seconds)
- Fallback succeeds → Additional 2-5 seconds
- **Total: ~35 seconds max**

### When to Expect Fallback Usage

**Common scenarios:**
- YouTube implements new API restrictions
- yt-dlp is outdated
- Specific video has unusual restrictions
- Temporary platform issues

**You should still:**
- Keep yt-dlp updated (primary method)
- Monitor logs for fallback usage patterns
- Update fallback libraries occasionally

## Best Practices

1. **Update all extractors regularly:**
   ```bash
   pip install --upgrade yt-dlp pytubefix instaloader
   ```

2. **Monitor fallback usage:**
   - High fallback usage = yt-dlp needs update
   - Occasional fallback = Normal operation

3. **Test both systems:**
   ```bash
   # Test YouTube
   curl -X POST http://localhost:10000/metadata \
     -H "Content-Type: application/json" \
     -d '{"url": "https://youtube.com/watch?v=..."}'
   
   # Test Instagram
   curl -X POST http://localhost:10000/metadata \
     -H "Content-Type: application/json" \
     -d '{"url": "https://instagram.com/p/..."}'
   ```

4. **Check logs regularly:**
   - Frequent fallback activation → Update yt-dlp
   - Fallback failures → Check library compatibility

## Disabling Fallbacks

If you want to use only yt-dlp (not recommended):

```bash
pip uninstall pytubefix instaloader
```

The system will gracefully handle missing fallback libraries and log a warning on startup.

## Future Enhancements

Potential additions:
- TikTok-specific fallback (TikTok-Api library)
- Twitter/X fallback (tweepy or gallery-dl)
- Reddit fallback (PRAW)
- Vimeo fallback (vimeo-downloader)

## Troubleshooting

### "Fallback extractors not available"

**Solution:**
```bash
pip install pytubefix instaloader
```

### "pytubefix fallback also failed"

**Causes:**
- Video is age-restricted or private
- Network issues
- Library needs update

**Solution:**
```bash
pip install --upgrade pytubefix
```

### "instaloader fallback also failed"

**Causes:**
- Private account
- Story expired
- Rate limited

**Solution:**
- Wait a few minutes (rate limit)
- Check if content is publicly accessible
- Update library: `pip install --upgrade instaloader`

## Support

For issues with:
- **yt-dlp:** https://github.com/yt-dlp/yt-dlp/issues
- **pytubefix:** https://github.com/JuanBindez/pytubefix/issues
- **instaloader:** https://github.com/instaloader/instaloader/issues
