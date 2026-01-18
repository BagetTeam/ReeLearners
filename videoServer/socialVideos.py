import datetime
import logging
import re
from typing import Dict, List, Optional

import requests
from apify_client import ApifyClient

logger = logging.getLogger(__name__)


class TikTokVideoSearcher:
    """
    TikTok Scraper (Apify) client for hashtag-based video searches.
    """

    def __init__(self, apify_token: str, actor_id: str = "clockworks/tiktok-scraper"):
        self.client = ApifyClient(apify_token)
        self.actor_id = actor_id

    def search_videos(self, query: str, max_results: int = 25) -> List[Dict]:
        def _extract_video_url(item: Dict) -> Optional[str]:
            candidates: List[Optional[str]] = [
                item.get("videoUrl"),
                item.get("videoUrlNoWaterMark"),
                item.get("video_url"),
                item.get("downloadAddr"),
                item.get("videoDownloadAddress"),
            ]

            video = item.get("video")
            if isinstance(video, dict):
                candidates.extend(
                    [
                        video.get("downloadAddr"),
                        video.get("playAddr"),
                        video.get("playAddrH264"),
                        video.get("playAddrBytevc1"),
                    ]
                )

                for key in ("playAddr", "downloadAddr"):
                    nested = video.get(key)
                    if isinstance(nested, dict):
                        url_list = nested.get("urlList") or nested.get("url_list")
                        if isinstance(url_list, list):
                            candidates.extend(url_list)
                        direct_url = nested.get("url") or nested.get("uri")
                        if isinstance(direct_url, str):
                            candidates.append(direct_url)

            for value in candidates:
                if isinstance(value, list):
                    for entry in value:
                        if isinstance(entry, str) and entry:
                            return entry
                if isinstance(value, str) and value:
                    return value
            return None

        tags = [
            re.sub(r"[^0-9A-Za-z_]", "", token)
            for token in re.split(r"\s+", query or "")
            if token.strip()
        ]
        tags = [tag for tag in tags if tag]
        if not tags:
            tags = ["fyp"]

        run_input = {
            "commentsPerPost": 0,
            "excludePinnedPosts": False,
            "hashtags": tags,
            "maxFollowersPerProfile": 0,
            "maxFollowingPerProfile": 0,
            "maxRepliesPerComment": 0,
            "proxyCountryCode": "None",
            "resultsPerPage": max_results,
            "scrapeRelatedVideos": False,
            "shouldDownloadAvatars": False,
            "shouldDownloadCovers": False,
            "shouldDownloadMusicCovers": False,
            "shouldDownloadSlideshowImages": False,
            "shouldDownloadSubtitles": False,
            "shouldDownloadVideos": False,
        }

        run = self.client.actor(self.actor_id).call(run_input=run_input)
        dataset_items = self.client.dataset(run["defaultDatasetId"]).list_items()
        items = dataset_items.items or []

        results: List[Dict] = []
        for item in items:
            web_url = item.get("webVideoUrl")
            if not web_url:
                continue
            match = re.search(r"/video/(\d+)", web_url)
            video_id = match.group(1) if match else None
            embed_url = (
                f"https://www.tiktok.com/embed/v2/{video_id}" if video_id else web_url
            )
            video_url = _extract_video_url(item)
            title = item.get("text") or "TikTok clip"
            results.append(
                {
                    "video_id": video_id or web_url,
                    "title": title,
                    "watch_url": web_url,
                    "embed_url": embed_url,
                    "video_url": video_url,
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
