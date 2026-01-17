"""
INSTALLATION INSTRUCTIONS:
==========================

1. Install required package:
   pip install google-api-python-client

2. Get YouTube API Key:
   - Go to https://console.cloud.google.com/
   - Create a new project (or select existing)
   - Enable "YouTube Data API v3"
   - Go to "Credentials" → "Create Credentials" → "API Key"
   - Copy your API key
"""

import os
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from typing import List, Dict
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv('YOUTUBE_API_KEY')


class YouTubeShortsSearcher:
    """
    A class to search for YouTube Shorts and get playback URLs.
    """
    
    def __init__(self, api_key: str):
        """
        Initialize the YouTube Shorts searcher.
        
        Args:
            api_key: Your YouTube Data API v3 key
        """
        self.api_key = api_key
        self.youtube = build('youtube', 'v3', developerKey=api_key)
    
    def search_shorts(self, prompt: str, max_results: int = 10) -> List[Dict]:
        """
        Search for YouTube Shorts based on a prompt.
        
        Args:
            prompt: Search query/prompt
            max_results: Maximum number of results to return (default: 10, max: 50)
            
        Returns:
            List of dictionaries with video_id, title, and playback URLs
        """
        try:
            # Search for short videos
            search_response = self.youtube.search().list(
                q=prompt,
                part='id,snippet',
                type='video',
                videoDuration='short',
                maxResults=max_results
            ).execute()
            
            video_ids = [item['id']['videoId'] for item in search_response.get('items', [])]
            
            if not video_ids:
                return []
            
            # Get video duration to filter actual Shorts (≤60 seconds)
            videos_response = self.youtube.videos().list(
                part='snippet,contentDetails',
                id=','.join(video_ids)
            ).execute()
            
            shorts = []
            for video in videos_response.get('items', []):
                duration = video['contentDetails']['duration']
                duration_seconds = self._parse_duration(duration)
                
                # Only include videos 60 seconds or less (actual Shorts)
                if duration_seconds <= 60:
                    video_id = video['id']
                    shorts.append({
                        'video_id': video_id,
                        'title': video['snippet']['title'],
                        'watch_url': f"https://www.youtube.com/shorts/{video_id}",
                        'embed_url': f"https://www.youtube.com/embed/{video_id}",
                    })
            
            return shorts
            
        except HttpError as e:
            print(f"An HTTP error occurred: {e}")
            return []
    
    def _parse_duration(self, duration: str) -> int:
        """Parse ISO 8601 duration format to seconds."""
        import re
        pattern = r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?'
        match = re.match(pattern, duration)
        
        if not match:
            return 0
        
        hours = int(match.group(1) or 0)
        minutes = int(match.group(2) or 0)
        seconds = int(match.group(3) or 0)
        
        return hours * 3600 + minutes * 60 + seconds
    
    def get_embed_html(self, video_id: str, width: int = 315, height: int = 560) -> str:
        """
        Generate HTML embed code for a YouTube Short.
        
        Args:
            video_id: YouTube video ID
            width: Player width in pixels (default: 315)
            height: Player height in pixels (default: 560)
            
        Returns:
            HTML iframe embed code
        """
        return f'''<iframe 
    width="{width}" 
    height="{height}" 
    src="https://www.youtube.com/embed/{video_id}" 
    title="YouTube Short" 
    frameborder="0" 
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
    allowfullscreen>
</iframe>'''
    
    def print_results(self, shorts: List[Dict]):
        """Print search results with playback URLs."""
        if not shorts:
            print("No YouTube Shorts found for this search.")
            return
        
        print(f"\nFound {len(shorts)} YouTube Shorts:\n")
        for i, short in enumerate(shorts, 1):
            print(f"{i}. {short['title']}")
            print(f"   Watch: {short['watch_url']}")
            print(f"   Embed: {short['embed_url']}")
            print()


# Example usage
if __name__ == "__main__":
    API_KEY = os.getenv('YOUTUBE_API_KEY')
    
    if not API_KEY:
        print("Error: Please set YOUTUBE_API_KEY environment variable")
        exit(1)
    
    searcher = YouTubeShortsSearcher(API_KEY)
    
    # Search for shorts
    results = searcher.search_shorts("funny cats", max_results=5)
    
    # Display results
    searcher.print_results(results)
    
    # Example: Get embed code for the first result
    if results:
        print("\nEmbed code for first video:")
        print(searcher.get_embed_html(results[0]['video_id']))