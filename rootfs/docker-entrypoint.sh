#!/bin/sh
# Docker entrypoint script (if needed)
# This could be used to set up environment variables, run migrations, etc.
# Currently, the Dockerfile uses CMD to run nginx directly

exec "$@"
