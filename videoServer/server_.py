import sys
import os
import logging
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

base_dir = Path(__file__).resolve().parent
repo_root = base_dir.parent
sys.path.append(str(base_dir / "realVideos"))
sys.path.append(str(base_dir / "AIVideos"))

# Load env from repo root so .env.local is picked up when running videoServer.
load_dotenv(dotenv_path=repo_root / ".env.local")
load_dotenv(dotenv_path=repo_root / ".env")

# Initialize FastAPI app FIRST (before YouTube initialization)
app = FastAPI(
    title="ReeLearners Video API",
    description="API to serve embedded video links for iframe playback",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Searchers lazily (only when needed)
youtube_searcher = None
tiktok_searcher = None
instagram_searcher = None


def get_youtube_searcher():
    """Lazy initialization of YouTube Searcher with Gemini support"""
    global youtube_searcher
    if youtube_searcher is None:
        try:
            from realVideos import YouTubeShortsSearcher

            youtube_api_key = os.getenv("YOUTUBE_API_KEY")
            gemini_api_key = os.getenv("GEMINI_API_KEY")  # Get Gemini key

            if youtube_api_key:
                # Initialize with both keys (Gemini is optional)
                youtube_searcher = YouTubeShortsSearcher(
                    youtube_api_key, gemini_api_key
                )

                if gemini_api_key:
                    logger.info("YouTube Searcher initialized with Gemini optimization")
                else:
                    logger.info(
                        "YouTube Searcher initialized (Gemini disabled - no API key)"
                    )
            else:
                logger.warning("YOUTUBE_API_KEY not set")
        except Exception as e:
            logger.error(f"Failed to initialize YouTube Searcher: {e}")
    return youtube_searcher


# TikTok searcher initialization
def get_tiktok_searcher():
    global tiktok_searcher
    if tiktok_searcher is None:
        try:
            from socialVideos import TikTokVideoSearcher

            apify_token = os.getenv("APIFY_TOKEN")
            actor_id = os.getenv("APIFY_TIKTOK_ACTOR_ID", "clockworks/tiktok-scraper")

            if apify_token:
                tiktok_searcher = TikTokVideoSearcher(apify_token, actor_id=actor_id)
                logger.info("TikTok Searcher initialized (Apify)")
            else:
                logger.warning("APIFY_TOKEN not set")
        except Exception as e:
            logger.error(f"Failed to initialize TikTok Searcher: {e}")
    return tiktok_searcher


# Instagram searcher initialization
def get_instagram_searcher():
    global instagram_searcher
    if instagram_searcher is None:
        try:
            from socialVideos import InstagramReelsSearcher

            access_token = os.getenv("INSTAGRAM_ACCESS_TOKEN")
            user_id = os.getenv("INSTAGRAM_USER_ID")
            base_url = os.getenv(
                "INSTAGRAM_GRAPH_BASE_URL", "https://graph.facebook.com/v20.0"
            )

            if access_token and user_id:
                instagram_searcher = InstagramReelsSearcher(
                    access_token, user_id, base_url=base_url
                )
                logger.info("Instagram Reels Searcher initialized")
            else:
                logger.warning("INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_USER_ID not set")
        except Exception as e:
            logger.error(f"Failed to initialize Instagram Searcher: {e}")
    return instagram_searcher


# Pydantic models for request/response
class VideoResponse(BaseModel):
    video_id: str
    title: str
    watch_url: str
    embed_url: str
    source: Optional[str] = None


class VideoListResponse(BaseModel):
    videos: List[VideoResponse]
    count: int
    query: str
    optimized_query: Optional[str] = None  # Show what Gemini optimized it to


class EmbedLinkResponse(BaseModel):
    embed_url: str
    video_id: str
    title: str
    html: str  # HTML code for iframe embed


class BatchEmbedRequest(BaseModel):
    video_ids: List[str]


class BatchEmbedResponse(BaseModel):
    embeds: List[dict]
    count: int


# Routes


@app.get("/", tags=["Health"])
async def root():
    """Health check endpoint"""
    logger.info("Root endpoint called")
    return {
        "status": "ok",
        "message": "ReeLearners Video API is running",
        "version": "1.0.0",
        "gemini_enabled": os.getenv("GEMINI_API_KEY") is not None,
    }


@app.get("/health", tags=["Health"])
async def health():
    """Health check endpoint for Cloud Run"""
    logger.info("Health check endpoint called")
    return {"status": "healthy"}


@app.get("/search", response_model=VideoListResponse, tags=["Search"])
async def search_videos(
    query: str,
    max_results: int = 50,
    optimize: bool = True,  # New parameter to control Gemini optimization
    sources: Optional[str] = None,
):
    """
    Search for YouTube Shorts based on a query.

    Args:
        query: Search term - can be natural language if Gemini is enabled
               (e.g., "I want to learn Python programming for beginners"
                or just "Python tutorial")
        max_results: Maximum number of results (1-50, default: 10)
        optimize: Whether to use Gemini to optimize the query (default: True)

    Returns:
        List of videos with embedded links
    """

    requested_sources = [
        item.strip().lower()
        for item in (sources.split(",") if sources else ["tiktok"])
        if item.strip()
    ]
    if not requested_sources:
        requested_sources = ["tiktok"]

    if not query or len(query.strip()) == 0:
        raise HTTPException(status_code=400, detail="Query parameter is required")

    if max_results < 1 or max_results > 50:
        raise HTTPException(
            status_code=400, detail="max_results must be between 1 and 50"
        )

    try:
        logger.info(
            f"Searching for: {query} (sources={requested_sources}, optimize={optimize})"
        )

        per_source_limit = max(1, max_results // max(1, len(requested_sources)))
        videos = []

        # YouTube fetching disabled for TikTok-only debugging.
        # if "youtube" in requested_sources:
        #     searcher = get_youtube_searcher()
        #     if not searcher:
        #         raise HTTPException(
        #             status_code=503,
        #             detail=(
        #                 "YouTube API not configured. Please set YOUTUBE_API_KEY "
        #                 "environment variable."
        #             ),
        #         )
        #     videos.extend(
        #         searcher.search_shorts(
        #             query, per_source_limit, optimize_prompt=optimize
        #         )
        #     )

        if "tiktok" in requested_sources:
            searcher = get_tiktok_searcher()
            if not searcher:
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "TikTok scraper not configured. Please set APIFY_TOKEN "
                        "environment variable."
                    ),
                )
            videos.extend(searcher.search_videos(query, per_source_limit))

        if "instagram" in requested_sources or "reels" in requested_sources:
            searcher = get_instagram_searcher()
            if not searcher:
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "Instagram API not configured. Please set INSTAGRAM_ACCESS_TOKEN "
                        "and INSTAGRAM_USER_ID environment variables."
                    ),
                )
            videos.extend(searcher.search_reels(query, per_source_limit))

        if not videos:
            return VideoListResponse(
                videos=[], count=0, query=query, optimized_query=None
            )

        import random

        random.shuffle(videos)
        videos = videos[:max_results]

        if not videos:
            return VideoListResponse(
                videos=[], count=0, query=query, optimized_query=None
            )

        # Note: We don't have direct access to the optimized query from search_shorts
        # If you want to return it, you'd need to modify YouTubeShortsSearcher.search_shorts
        # to return both videos and the optimized query

        return VideoListResponse(
            videos=[VideoResponse(**video) for video in videos],
            count=len(videos),
            query=query,
            optimized_query=None,  # Could be enhanced to show actual optimized query
        )
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@app.get("/embed/{video_id}", response_model=EmbedLinkResponse, tags=["Embed"])
async def get_embed_link(video_id: str):
    """
    Get the embedded link for a specific video.

    Args:
        video_id: YouTube video ID

    Returns:
        Embedded link and HTML code for iframe
    """
    if not video_id or len(video_id.strip()) == 0:
        raise HTTPException(status_code=400, detail="video_id parameter is required")

    try:
        embed_url = f"https://www.youtube.com/embed/{video_id}"

        # HTML code for iframe embed
        iframe_html = f'''<iframe 
    width="100%" 
    height="315" 
    src="{embed_url}" 
    title="YouTube video player" 
    frameborder="0" 
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
    allowfullscreen>
</iframe>'''

        return EmbedLinkResponse(
            embed_url=embed_url,
            video_id=video_id,
            title=f"Video {video_id}",
            html=iframe_html,
        )
    except Exception as e:
        logger.error(f"Failed to generate embed link: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to generate embed link: {str(e)}"
        )


@app.post("/batch-embed", response_model=BatchEmbedResponse, tags=["Embed"])
async def batch_get_embed_links(request: BatchEmbedRequest):
    """
    Get embedded links for multiple videos.

    Args:
        request: Object containing list of YouTube video IDs

    Returns:
        List of embedded links
    """
    if not request.video_ids or len(request.video_ids) == 0:
        raise HTTPException(status_code=400, detail="video_ids list cannot be empty")

    embeds = []
    for video_id in request.video_ids:
        embed_url = f"https://www.youtube.com/embed/{video_id}"
        embeds.append({"video_id": video_id, "embed_url": embed_url})

    return BatchEmbedResponse(embeds=embeds, count=len(embeds))


# Run the server
if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8080"))
    logger.info(f"Starting server on port {port}")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        reload=False,  # Disable reload in production
    )
