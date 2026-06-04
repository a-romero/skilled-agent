#!/bin/bash
# Start the Meridian Assistant backend server
uvicorn backend.server:app --reload --port 8000
