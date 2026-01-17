import sys
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'realVideos')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'AIVideos')))
from realVideos import YouTubeShortsSearcher
from dotenv import load_dotenv

load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="ReeLearners Video API",
    description="API to serve embedded video links for iframe playback",
    version="1.0.0"
)

# Add CORS middleware to allow requests from your Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL instead of "*"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize YouTube Shorts Searcher
api_key = os.getenv('YOUTUBE_API_KEY')
if not api_key:
    raise ValueError("YOUTUBE_API_KEY environment variable not set")

youtube_searcher = YouTubeShortsSearcher(api_key)


# Pydantic models for request/response
class VideoResponse(BaseModel):
    video_id: str
    title: str
    watch_url: str
    embed_url: str


class VideoListResponse(BaseModel):
    videos: List[VideoResponse]
    count: int
    query: str


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
    return {
        "status": "ok",
        "message": "ReeLearners Video API is running",
        "version": "1.0.0"
    }


@app.get("/health", tags=["Health"])
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.get("/search", response_model=VideoListResponse, tags=["Search"])
async def search_videos(
    query: str,
    max_results: int = 10
):
    """
    Search for YouTube Shorts based on a query.
    
    Args:
        query: Search term (e.g., "Python tutorial", "Machine Learning")
        max_results: Maximum number of results (1-50, default: 10)
    
    Returns:
        List of videos with embedded links
    """
    if not query or len(query.strip()) == 0:
        raise HTTPException(status_code=400, detail="Query parameter is required")
    
    if max_results < 1 or max_results > 50:
        raise HTTPException(status_code=400, detail="max_results must be between 1 and 50")
    
    try:
        videos = youtube_searcher.search_shorts(query, max_results)
        if not videos:
            return VideoListResponse(
                videos=[],
                count=0,
                query=query
            )
        
        return VideoListResponse(
            videos=[VideoResponse(**video) for video in videos],
            count=len(videos),
            query=query
        )
    except Exception as e:
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
            html=iframe_html
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate embed link: {str(e)}")


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
        embeds.append({
            "video_id": video_id,
            "embed_url": embed_url
        })
    
    return BatchEmbedResponse(embeds=embeds, count=len(embeds))


# Run the server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=True
    )