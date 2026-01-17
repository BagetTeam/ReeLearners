# ReeLearners

This is a web app that allows users to scroll infinitely by having an AI generate reels based on a prompt.

## Requirements

### Stack
- Frontend: Next.js
- Database: Convex
- Authentication: Auth0
- Backend (for video generation): FastApi
- Image Generation: Google Nano Banana Pro

### Frontend
- The application must have an AI chat interface
  - The left sidebar displays the user's prompt history
  - The right side displays the main content
- The main content first displays a prompt input field
  - After the user typed the prompt (optionally attach a file for context) they want to see reels for, the frontend sends the prompt content to the FastApi backend server, where it will starts generating reels about the prompt the user typed.
  - After receiving the reels, the frontend will display them in the main content area with a UI akin to Instagram reels and Youtube shorts.

### Database (Convex)
- The database used is Convex
- The database stores user data and reel data
- User data must (but not limited to) include user's auth0 id
- Reel data must (but not limited to) include the user's prompt, the prompt's title, attachment storage ID
- Every user has a reel history

### Backend Server (FastApi)
- The backend server handles video generation
- It uses Google Nano Banana Pro to generate videos
- The frontend sends the prompt and the attachment url to the backend server and sends back the video url
