"""
Video parser service for YouTube and VK videos
"""
import re
import httpx
from bs4 import BeautifulSoup
from typing import Optional, Dict


async def get_video_info(url: str) -> Optional[Dict]:
    """Get video information from URL (YouTube, VK, etc.)"""
    try:
        if "youtube.com" in url or "youtu.be" in url:
            # Extract video ID from YouTube URL
            video_id = None
            if "youtube.com/watch?v=" in url:
                video_id = url.split("v=")[1].split("&")[0]
            elif "youtu.be/" in url:
                video_id = url.split("youtu.be/")[1].split("?")[0]
            
            if video_id:
                # Get video title from YouTube
                video_title = await get_youtube_title(video_id)
                
                return {
                    "type": "youtube",
                    "video_id": video_id,
                    "embed_url": f"https://www.youtube.com/embed/{video_id}",
                    "title": video_title
                }
        elif "rutube.ru" in url:
            # Extract video ID from Rutube URL
            # Format: https://rutube.ru/video/XXXX/ or https://rutube.ru/play/embed/XXXX
            video_id = None
            if "/video/" in url:
                video_id = url.split("/video/")[1].split("/")[0]
            elif "/play/embed/" in url:
                video_id = url.split("/play/embed/")[1].split("/")[0]
            
            if video_id:
                return {
                    "type": "rutube",
                    "video_id": video_id,
                    "embed_url": f"https://rutube.ru/play/embed/{video_id}/",
                    "title": "Rutube видео"
                }
        elif "vk.com" in url:
            # VK videos often have format vk.com/video-OID_ID
            video_id = None
            if "video" in url:
                video_id = url.split("video")[-1].split("?")[0].strip("-")
            
            return {
                "type": "vk",
                "video_id": video_id,
                "url": url,
                "title": "VK видео " + (video_id if video_id else "")
            }
        else:
            return {
                "type": "other",
                "url": url,
                "title": "Видео"
            }
    except Exception as e:
        return None


async def get_youtube_title(video_id: str) -> str:
    """Get YouTube video title by ID"""
    try:
        # Create URL for video page
        video_url = f"https://www.youtube.com/watch?v={video_id}"
        
        # Headers to mimic browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        # Get page
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(video_url, headers=headers)
            response.raise_for_status()
            
            # Parse HTML
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Look for title in head
            title_tag = soup.find('title')
            if title_tag:
                title = title_tag.get_text().strip()
                # Remove " - YouTube" from title
                if title.endswith(' - YouTube'):
                    title = title[:-10].strip()
                return title
            
            # If not found in title, look in meta tags
            meta_title = soup.find('meta', property='og:title')
            if meta_title:
                return meta_title.get('content', '').strip()
            
            # If nothing found, return ID
            return f"YouTube видео {video_id}"
            
    except Exception as e:
        # If failed to get title, return ID
        return f"YouTube видео {video_id}"

