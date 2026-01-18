"""
INSTALLATION INSTRUCTIONS:
==========================

1. Install required packages:
   pip install google-api-python-client google-generativeai python-dotenv

2. Get YouTube API Key:
   - Go to https://console.cloud.google.com/
   - Create a new project (or select existing)
   - Enable "YouTube Data API v3"
   - Go to "Credentials" → "Create Credentials" → "API Key"
   - Copy your API key

3. Get Gemini API Key:
   - Go to https://aistudio.google.com/app/apikey
   - Create API key

4. Add to .env file:
   YOUTUBE_API_KEY=your_youtube_key_here
   GEMINI_API_KEY=your_gemini_key_here
"""

import logging
import os
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from typing import List, Dict, Optional
from dotenv import load_dotenv
import google.generativeai as genai
import random
import json


logger = logging.getLogger(__name__)

load_dotenv()


class YouTubeShortsSearcher:
    """
    A class to search for YouTube Shorts and get playback URLs.
    Includes Gemini Flash for generating multiple search topics and aggregating results.
    """

    def __init__(self, api_key: str, gemini_api_key: Optional[str] = None):
        """
        Initialize the YouTube Shorts searcher.

        Args:
            api_key: Your YouTube Data API v3 key
            gemini_api_key: Your Gemini API key (optional, for prompt optimization)
        """
        self.api_key = api_key
        self.youtube = build("youtube", "v3", developerKey=api_key)

        # Initialize Gemini if API key is provided
        self.gemini_enabled = False
        if gemini_api_key:
            try:
                genai.configure(api_key=gemini_api_key)
                self.model = genai.GenerativeModel("gemini-2.0-flash-thinking-exp-1219")
                self.gemini_enabled = True
            except Exception as e:
                logger.error(f"Warning: Failed to initialize Gemini: {e}")

    def _generate_search_topics(
        self, user_prompt: str, num_topics: int = 4
    ) -> List[str]:
        """
        Use Gemini to generate multiple search topics from a user prompt.

        Args:
            user_prompt: Natural language prompt from user
            num_topics: Number of search topics to generate (default: 3)

        Returns:
            List of search keywords/topics
        """
        if not self.gemini_enabled:
            return [user_prompt]

        system_instruction = f"""You are a YouTube search optimizer. 
Given a user's prompt, generate {num_topics} different search queries that will help find diverse and relevant YouTube Shorts.

Rules:
- Generate exactly {num_topics} search queries
- Each query should be 1-6 words
- Make queries diverse but related to the main topic
- Use popular YouTube search terms
- Focus on different aspects or angles of the topic
- Output ONLY a JSON array of strings, nothing else

Examples:

User: "I want to learn about cooking healthy meals"
You: ["healthy recipes", "quick meal prep", "easy cooking tips"]

User: "Show me funny animal videos"
You: ["funny cats", "dog fails", "cute animals"]

User: "I need workout routines for beginners"
You: ["beginner workout", "home fitness", "exercise tutorial"]"""

        try:
            response = self.model.generate_content(
                f"{system_instruction}\n\nUser: {user_prompt}\nYou:"
            )

            # Extract JSON from response
            response_text = response.text.strip()

            # Remove markdown code blocks if present
            if response_text.startswith("```"):
                lines = response_text.split("\n")
                response_text = "\n".join(lines[1:-1])

            topics = json.loads(response_text)
            logger.info(
                f"[Gemini] Generated {len(topics)} search topics from '{user_prompt}':"
            )
            for i, topic in enumerate(topics, 1):
                logger.info(f"  {i}. {topic}")

            return topics

        except Exception as e:
            logger.error(f"[Gemini] Error generating topics: {e}")
            # Fallback to single search with original prompt
            return [user_prompt]

    def _search_single_topic(self, query: str, max_results: int = 15) -> List[Dict]:
        """
        Search for YouTube Shorts for a single topic.

        Args:
            query: Search query
            max_results: Maximum number of results

        Returns:
            List of video dictionaries
        """
        try:
            logger.debug(f"Searching for topic: {query}")
            # Search for short videos
            search_response = (
                self.youtube.search()
                .list(
                    q=query,
                    part="id,snippet",
                    type="video",
                    videoDuration="short",
                    maxResults=max_results,
                )
                .execute()
            )
            logger.debug(f"search_response: {json.dumps(search_response, indent=2)}")

            video_ids = [
                item["id"]["videoId"]
                for item in search_response.get("items", [])
                if "id" in item and "videoId" in item["id"]
            ]

            if not video_ids:
                return []

            # Get video duration to filter actual Shorts (≤60 seconds)
            videos_response = (
                self.youtube.videos()
                .list(part="snippet,contentDetails", id=",".join(video_ids))
                .execute()
            )

            shorts = []
            for video in videos_response.get("items", []):
                try:
                    # Safely extract video details with fallbacks
                    video_id = video.get("id")
                    if not video_id:
                        continue

                    duration = video.get("contentDetails", {}).get("duration")
                    if not duration:
                        continue

                    duration_seconds = self._parse_duration(duration)

                    # Only include videos 60 seconds or less (actual Shorts)
                    if duration_seconds <= 60:
                        title = video.get("snippet", {}).get("title", "Untitled")
                        shorts.append(
                            {
                                "video_id": video_id,
                                "title": title,
                                "watch_url": f"https://www.youtube.com/shorts/{video_id}",
                                "embed_url": f"https://www.youtube.com/embed/{video_id}",
                            }
                        )
                except (KeyError, TypeError) as e:
                    # Skip malformed video entries
                    logger.warning(f"Skipping malformed video entry: {e}")
                    continue

            return shorts

        except HttpError as e:
            logger.error(f"An HTTP error occurred for query '{query}': {e}")
            return []
        except Exception as e:
            logger.error(f"An unexpected error occurred for query '{query}': {e}")
            return []

    def search_shorts(
        self,
        prompt: str,
        max_results: int = 50,
        optimize_prompt: bool = True,
        num_topics: int = 5,
    ) -> List[Dict]:
        """
        Search for YouTube Shorts based on a prompt using multiple search topics.

        Args:
            prompt: Search query/prompt (can be natural language if Gemini is enabled)
            max_results: Total maximum number of results to return (default: 50)
            optimize_prompt: Whether to use Gemini to generate multiple topics (default: True)
            num_topics: Number of search topics to generate if optimizing (default: 4)

        Returns:
            List of dictionaries with video_id, title, and playback URLs (mixed from all topics)
        """
        try:
            # Generate multiple search topics if Gemini is enabled
            if optimize_prompt and self.gemini_enabled:
                search_topics = self._generate_search_topics(prompt, num_topics)
            else:
                search_topics = [prompt]

            if not search_topics:
                logger.info("[Search] No search topics generated")
                return []

            # Calculate results per topic (add buffer for deduplication)
            results_per_topic = max(1, (max_results // len(search_topics)) + 3)

            # Search each topic
            all_results = []
            seen_video_ids = set()  # Track duplicates across topics

            logger.info(
                f"\n[Search] Searching {len(search_topics)} topics, ~{results_per_topic} results each..."
            )

            for topic in search_topics:
                logger.info(f"[Search] Topic: '{topic}'")
                topic_results = self._search_single_topic(topic, results_per_topic)
                logger.info(json.dumps(topic_results, indent=2))

                # Filter out duplicates
                for video in topic_results:
                    if video["video_id"] not in seen_video_ids:
                        all_results.append(video)
                        seen_video_ids.add(video["video_id"])

                logger.info(
                    f"[Search] Found {len(topic_results)} shorts ({len(all_results)} unique total)"
                )

            # Shuffle to mix results from different topics
            random.shuffle(all_results)

            # Limit to max_results
            final_results = all_results[:max_results]

            logger.info(f"\n[Search] Returning {len(final_results)} mixed results\n")

            return final_results
        except Exception as e:
            logger.error(f"[Search] Error during search: {e}")
            return []

    def _parse_duration(self, duration: str) -> int:
        """Parse ISO 8601 duration format to seconds."""
        import re

        pattern = r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?"
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
            logger.info("No YouTube Shorts found for this search.")
            return

        logger.info(f"\nFound {len(shorts)} YouTube Shorts:\n")
        for i, short in enumerate(shorts, 1):
            logger.info(f"{i}. {short['title']}")
            logger.info(f"   Watch: {short['watch_url']}")
            logger.info(f"   Embed: {short['embed_url']}")
            logger.info("")


# Example usage
if __name__ == "__main__":
    API_KEY = os.getenv("YOUTUBE_API_KEY")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

    if not API_KEY:
        logger.error("Error: Please set YOUTUBE_API_KEY environment variable")
        exit(1)

    # Initialize with both keys (Gemini is optional)
    searcher = YouTubeShortsSearcher(API_KEY, GEMINI_API_KEY)

    # Example: Natural language prompt (will generate multiple search topics)
    long_prompt = "I want to learn about healthy cooking and meal preparation"
    results = searcher.search_shorts(long_prompt, max_results=50, num_topics=4)

    # Display results
    searcher.print_results(results)

    # Example: Get embed code for the first result
    if results:
        logger.info("\nEmbed code for first video:")
        logger.info(searcher.get_embed_html(results[0]["video_id"]))
