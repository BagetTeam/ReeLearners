import datetime
import logging
import re
from typing import Dict, List, Optional

import requests

logger = logging.getLogger(__name__)


class TikTokVideoSearcher:
    """
    TikTok Research API client for keyword-based video searches.
    """

    def __init__(self, access_token: str, base_url: str = "https://open.tiktokapis.com"):
        self.access_token = access_token
        self.base_url = base_url.rstrip("/")

    def search_videos(self, query: str, max_results: int = 25) -> List[Dict]:
        if not query:
            return []

        today = datetime.date.today()
        end_date = today.strftime("%Y%m%d")
        start_date = (today - datetime.timedelta(days=30)).strftime("%Y%m%d")

        keywords = [token for token in re.split(r"\s+", query) if token]
        if not keywords:
            keywords = [query]

        payload = {
            "query": {
                "and": [
                    {
                        "operation": "IN",
                        "field_name": "keyword",
                        "field_values": keywords,
                    }
                ]
            },
            "start_date": start_date,
            "end_date": end_date,
            "max_count": max_results,
        }

        url = f"{self.base_url}/v2/research/video/query/"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

        response = requests.post(url, json=payload, headers=headers, timeout=20)
        response.raise_for_status()

        data = response.json()
        videos = data.get("data", {}).get("videos") or data.get("videos") or []
        results: List[Dict] = []

        for video in videos:
            video_id = video.get("video_id") or video.get("id")
            if not video_id:
                continue

            title = (
                video.get("video_description")
                or video.get("title")
                or "Untitled TikTok"
            )
            watch_url = video.get("share_url") or video.get("video_url")
            if not watch_url:
                watch_url = f"https://www.tiktok.com/@tiktok/video/{video_id}"

            embed_url = video.get("embed_url") or f"https://www.tiktok.com/embed/v2/{video_id}"

            results.append(
                {
                    "video_id": video_id,
                    "title": title,
                    "watch_url": watch_url,
                    "embed_url": embed_url,
                    "source": "tiktok",
                }
            )

        return results


class InstagramReelsSearcher:
    """
    Instagram Graph API client that pulls recent reels from a hashtag search.
    """

    def __init__(
        self,
        access_token: str,
        user_id: str,
        base_url: str = "https://graph.facebook.com/v20.0",
    ):
        self.access_token = access_token
        self.user_id = user_id
        self.base_url = base_url.rstrip("/")

    def search_reels(self, query: str, max_results: int = 25) -> List[Dict]:
        hashtag = self._normalize_hashtag(query)
        if not hashtag:
            return []

        hashtag_id = self._get_hashtag_id(hashtag)
        if not hashtag_id:
            logger.warning("Instagram hashtag search returned no results for '%s'", hashtag)
            return []

        url = f"{self.base_url}/{hashtag_id}/recent_media"
        params = {
            "user_id": self.user_id,
            "fields": "id,caption,media_type,media_url,permalink,thumbnail_url",
            "limit": max_results,
            "access_token": self.access_token,
        }

        response = requests.get(url, params=params, timeout=20)
        response.raise_for_status()

        data = response.json()
        media_items = data.get("data", [])
        results: List[Dict] = []

        for media in media_items:
            media_type = media.get("media_type")
            if media_type not in ("REELS", "VIDEO"):
                continue

            video_id = media.get("id")
            if not video_id:
                continue

            permalink = media.get("permalink")
            shortcode = self._extract_shortcode(permalink)
            embed_url = (
                f"https://www.instagram.com/reel/{shortcode}/embed"
                if shortcode
                else None
            )

            results.append(
                {
                    "video_id": video_id,
                    "title": media.get("caption") or "Untitled Reel",
                    "watch_url": permalink or "",
                    "embed_url": embed_url or "",
                    "source": "instagram",
                }
            )

        return results

    def _get_hashtag_id(self, hashtag: str) -> Optional[str]:
        url = f"{self.base_url}/ig_hashtag_search"
        params = {
            "user_id": self.user_id,
            "q": hashtag,
            "access_token": self.access_token,
        }
        response = requests.get(url, params=params, timeout=20)
        response.raise_for_status()

        data = response.json()
        matches = data.get("data", [])
        if not matches:
            return None
        return matches[0].get("id")

    def _normalize_hashtag(self, query: str) -> str:
        tokens = re.split(r"\s+", query.strip())
        if not tokens:
            return ""
        token = re.sub(r"[^0-9A-Za-z_]", "", tokens[0])
        return token.lower()

    def _extract_shortcode(self, permalink: Optional[str]) -> Optional[str]:
        if not permalink:
            return None
        match = re.search(r"/(reel|p)/([^/]+)/?", permalink)
        if not match:
            return None
        return match.group(2)
