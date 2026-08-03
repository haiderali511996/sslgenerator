#!/bin/sh
# Production entrypoint for the SSL generator backend.
#
# Mounted at /usr/local/bin/entrypoint.sh by docker-compose.prod.yml. It lives
# outside the sslgenerator repository so a `git pull` there cannot clobber it.
#
# It exists because the repository's Dockerfile runs uvicorn directly and
# nothing anywhere runs the migrations: there is no metadata.create_all() in
# the application, so on a fresh volume the tables simply do not exist and the
# first signup fails with 'relation "users" does not exist'. The SSL checker
# still works, because it never touches the database — which is exactly the
# split you see when only some of the site works.
set -e

# depends_on only waits for the container to start, not for PostgreSQL to
# finish initialising, so the first migration can otherwise race it.
echo "Waiting for PostgreSQL..."
i=0
until python -c 'import os, psycopg2; psycopg2.connect(os.environ["DATABASE_URL"]).close()' 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "PostgreSQL did not become reachable after 60s. Giving up." >&2
    exit 1
  fi
  sleep 2
done
echo "PostgreSQL is up."

# Idempotent: a no-op once the schema is current, so this is safe on every
# restart and is what applies new migrations after a deploy.
echo "Applying migrations..."
alembic upgrade head

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
