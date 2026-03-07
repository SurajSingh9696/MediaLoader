# Troubleshooting Guide

## YouTube Extraction Issues

### Problem: "Failed to extract any player response"

This error occurs when YouTube implements new anti-bot measures or changes their API.

**Solutions:**

1. **Update yt-dlp to the latest version:**
   ```bash
   pip install --upgrade yt-dlp
   ```

2. **The application automatically tries 8 different extraction strategies:**
   - iOS client
   - Android TV client  
   - Android embedded player
   - Media Connect (Smart TV)
   - TV embedded
   - Mobile web
   - Web with bypasses
   - Default with certificate bypass

3. **If issues persist:**
   - Wait a few minutes and try again (YouTube may be temporarily blocking your IP)
   - Try a different video to confirm if it's video-specific or global
   - Check if yt-dlp has known issues: https://github.com/yt-dlp/yt-dlp/issues

### Problem: "Bot detection triggered"

YouTube is detecting automated access patterns.

**Solutions:**
- The app uses rotating player clients (iOS, Android TV, embedded players)
- Delays between retry attempts increase exponentially (1s, 2s, 3s)
- Consider implementing rate limiting on your frontend
- For production at scale, consider using a proxy service

### Problem: "Sign in to confirm you're not a bot"

YouTube requires authentication for this video.

**Solutions:**
- The iOS and Android TV clients bypass most of these checks
- Age-restricted content may still require authentication
- Private/members-only videos cannot be downloaded without cookies

## Other Platform Issues

### Instagram
- Stories expire after 24 hours
- Private accounts require authentication
- Some Reels may be geo-restricted

### TikTok
- Watermarks are included in downloads
- Some videos may be region-locked
- Very new videos (< 1 hour old) may not be available yet

### Twitter/X
- Videos from protected accounts cannot be downloaded
- Some videos are only available to logged-in users

## Backend Issues

### FFmpeg Errors
- The app uses bundled FFmpeg via `imageio-ffmpeg`
- If you see FFmpeg errors, ensure the package is installed:
  ```bash
  pip install imageio-ffmpeg
  ```

### Network Timeouts
- Default timeout is 30 seconds
- Large videos may need longer timeouts
- Configure in `backend/core/config.py`:
  ```python
  yt_dlp_socket_timeout: int = 30  # Increase if needed
  ```

### Memory Issues
- Downloaded files are stored in `/tmp/mediafetch`
- Configure cleanup to avoid disk filling up
- Consider implementing a cron job to clean old files

## Deployment Issues

### Vercel/Render Timeout
- Serverless functions have time limits (10-30 seconds)
- For long videos, download may timeout
- Consider using background jobs or streaming responses

### CORS Errors
- Ensure your API allows requests from your frontend domain
- Check `ALLOWED_ORIGINS` in config

### Port Already in Use
```bash
# Find process using port 10000
lsof -i :10000
# Kill it
kill -9 <PID>
```

## Best Practices

1. **Keep yt-dlp updated** - YouTube changes frequently
2. **Use the latest strategy** - The app tries multiple methods automatically
3. **Monitor logs** - Check which strategy succeeds for debugging
4. **Rate limiting** - Implement delays on repeated requests
5. **Error handling** - The app provides user-friendly error messages

## Getting Help

If you continue experiencing issues:
1. Check yt-dlp version: `yt-dlp --version`
2. Update: `pip install --upgrade yt-dlp`
3. Test the URL directly with yt-dlp: `yt-dlp --dump-json <url>`
4. Report issues at: https://github.com/yt-dlp/yt-dlp/issues
