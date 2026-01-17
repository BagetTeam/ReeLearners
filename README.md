## 1. Executive Summary

I am building a web-based application that reimagines the "infinite scroll" short-form video experience (similar to TikTok/Instagram Reels). Instead of an opaque algorithm dictating the feed, the user explicitly drives the content algorithm via natural language prompts.

## 2. Core User Flow

1. Input: The user enters a text prompt describing the content they want to see (e.g., "calisthenics tutorials," "funny cat fails," "explained physics concepts").

2. Feed Generation: The system creates a persistent "Channel" or "Session" based on this prompt.

3. Consumption: The user enters a vertical, full-screen video player interface and scrolls through content specifically curated or generated for that prompt.

4. Persistence: This specific prompt session is saved in the database. The user can leave and return later to continue scrolling from where they left off, or view previously watched videos within that specific prompt context.

## 3. Hybrid Content Sourcing Strategy (The "Backend Brain")

When a prompt is received, the backend must aggregate content from three distinct sources using a fallback/priority logic:


- Source A: Internal Database (Vector/Tag Match):
	- Search the existing video database for content with metadata or vector embeddings that match the user's prompt.


- Source B: Generative AI (Google Veo 3):
	- The system utilizes Google Veo 3 to generate new video assets on the fly based on the prompt. It should prompt veo 3 in the background, and wait for it to generate before playing the video to the user.

	- Note: This should likely happen asynchronously to prevent loading delays. It will also most likely be making multiple requests at the same time to generate enough content for the user.


- Source C: External Aggregation (YouTube/Social APIs):
	- While the Generative AI content is getting generated, use APIs (e.g., YouTube Data API for Shorts) or scraping methods to fetch existing external short-form content matching the topic.

	- These external links are indexed into our database for the user.


## 4. Functional Requirements


- 
Frontend:


	- Mobile-responsive web app.

	- Vertical Swipe Interface: Smooth snapping scroll (similar to CSS scroll-snap).

	- Prompt Input/Dashboard: A home screen to input new prompts or select from "Saved Searches/History."

	- Video Player: Custom controls, auto-play next, support for both hosted files (GenAI) and embedded players (YouTube).


- 
Backend:


	- API Layer: To handle prompt submission and feed pagination.

	- Orchestrator: A service that takes the prompt and delegates tasks to the DB Search, External Scraper, and Veo 3 Generator.

	- Database:
		- Must store Users.

		- Must store Prompts/Feeds (linked to Users).

		- Must store Videos (metadata, source type, URL, and tags/embeddings).

		- Must store WatchHistory (tracking scroll position and watched status per feed).



## 5. Technical Stack Constraints & Preferences


- Generative Model: Google Veo 3 (Video generation).

- Database: [Insert your pref, e.g., PostgreSQL with pgvector or MongoDB] for storing prompt history and video metadata.

- Frontend: [Insert your pref, e.g., Next.js/React].

- Backend: [Insert your pref, e.g., Python FastAPI or Node.js] (Python is recommended for easier AI/Scraping integration).

## 6. Goal for the LLM

Based on this architecture, please assist me in [insert current task, e.g., designing the database schema / writing the backend orchestrator logic / creating the frontend component].
