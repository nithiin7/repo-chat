"""
Routes
------
POST   /index                       Fetch + index a GitHub or Bitbucket repository.
POST   /chat                        Stream an SSE answer about an indexed repo.
GET    /repos                       List all indexed repositories.
DELETE /repos/{repo_id}             Remove a repo's index, source tree, and metadata.
GET    /repos/{repo_id}/status      Check if the remote has new commits.
GET    /repos/{repo_id}/chats       List saved chats for a repo.
POST   /repos/{repo_id}/chats       Create a new chat session for a repo.
PATCH  /chats/{chat_id}             Rename a chat.
DELETE /chats/{chat_id}             Delete a chat and all its messages.
GET    /chats/{chat_id}/messages    Return saved messages for a chat.
GET    /ollama/models               List available Ollama models.
GET    /settings                    Return current settings.
PUT    /settings                    Update settings.

"""