#!/usr/bin/env bash
# Build the test site of this pack in a DDEV project: Leantime's own image on the project's own MySQL, installed by
# Leantime's own installer, the accounts of the suite in their roles of the project Webship site, and the sample content
# the features read (its tasks, the sprint "Sprint 1", comments and logged time). It is what CI runs; on a machine with
# Docker, DDEV and 1.5 GB of free memory it makes the same site. As the Webship Workspace's builder does for a test
# site, it allows 1000 calls of the API a minute for an account and 100 logins a minute (Leantime's own are 120 and 20):
# a suite reads and logs in more often than a person.
#
#   SITE_DIR=<folder>        where the project goes (default: ../leantime-site beside the pack)
#   RELEASE=<X.Y.Z>          the release of the image (default: 3.17.0)
#   COUNTS_ONLY=1            build nothing: print what the site holds, one count a line (a run must leave them)
#   TIDY_ONLY=1              build nothing: remove what a run left that Leantime keeps out of sight (a deleted task's
#                            comments, time and history, of the suite's accounts)
#
# The site answers at https://leantimesteps.ddev.site, the address cucumber.js opens by default. Its own values (its
# session key, the owner's password) are made for it, in $SITE_DIR/leantime/, never printed. The site script
# (site/leantime-site.php) is the one of the Webship Workspace's Leantime plugin.
set -euo pipefail

PACK="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE_DIR="${SITE_DIR:-${PACK}/../leantime-site}"
NAME=leantimesteps
RELEASE="${RELEASE:-3.17.0}"
IMAGE="docker.io/leantime/leantime:${RELEASE}"
PASSWORD='dD.123123ddd'

# The site script, with Leantime's own code in its container; its input reaches it.
site() {
  docker exec -i "ddev-${NAME}-leantime" sh -c "cd /var/www/html && php /opt/webship/leantime-site.php $*"
}

if [ "${COUNTS_ONLY:-}" = 1 ] ; then
  site counts < /dev/null | grep -E '^[a-z ]+: [0-9]+$'
  exit 0
fi
if [ "${TIDY_ONLY:-}" = 1 ] ; then
  site tidy < /dev/null
  exit 0
fi

secret() { head -c 200 /dev/urandom | base64 -w0 | tr -dc 'A-Za-z0-9' | head -c "$1" ; }

mkdir -p "${SITE_DIR}/leantime" "${SITE_DIR}/.ddev"
SITE_DIR="$(cd "${SITE_DIR}" && pwd)"
cd "${SITE_DIR}"
ddev config --project-type=generic --project-name="${NAME}" --database=mysql:8.4 < /dev/null

cp "${PACK}/site/leantime-site.php" leantime/
( umask 077
  cat > leantime/env <<ENVEOF
LEANTIME_RELEASE=${RELEASE}
LEAN_APP_URL=https://${NAME}.ddev.site
LEAN_DB_HOST=db
LEAN_DB_USER=db
LEAN_DB_PASSWORD=db
LEAN_DB_DATABASE=db
LEAN_DB_PORT=3306
LEAN_SESSION_PASSWORD=$(secret 64)
LEAN_SESSION_SECURE=true
LEAN_SITENAME=Leantime
LEAN_LANGUAGE=en-US
LEAN_DEFAULT_TIMEZONE=UTC
LEAN_ALLOW_TELEMETRY=false
LEAN_EMAIL_RETURN=leantime@example.com
LEAN_EMAIL_USE_SMTP=true
LEAN_EMAIL_SMTP_HOSTS=web
LEAN_EMAIL_SMTP_PORT=1025
LEAN_EMAIL_SMTP_AUTH=false
LEAN_EMAIL_SMTP_AUTO_TLS=false
LEAN_RATELIMIT_API=1000
LEAN_RATELIMIT_AUTH=100
ENVEOF
)
printf 'LEANTIME_IMAGE=%s\n' "${IMAGE}" > .ddev/.env
cat > .ddev/docker-compose.leantime.yaml <<'YAMLEOF'
# Leantime: its own image on the project's MySQL, at the project's address; the project's web container keeps the
# mail catcher. The same service as the Webship Workspace's Leantime plugin.
services:
  web:
    environment:
      - HTTP_EXPOSE=8093:80,8025:8025
      - HTTPS_EXPOSE=8457:80,8026:8025
  leantime:
    image: "${LEANTIME_IMAGE:-docker.io/leantime/leantime:3.17.0}"
    container_name: ddev-${DDEV_SITENAME}-leantime
    labels:
      com.ddev.site-name: ${DDEV_SITENAME}
      com.ddev.approot: ${DDEV_APPROOT}
    restart: "no"
    expose:
      - "8080"
    depends_on:
      db:
        condition: service_healthy
    env_file:
      - ${DDEV_APPROOT}/leantime/env
    volumes:
      - ${DDEV_APPROOT}/leantime:/opt/webship:ro
      - userfiles:/var/www/html/userfiles
      - public_userfiles:/var/www/html/public/userfiles
      - plugins:/var/www/html/app/Plugins
      - logs:/var/www/html/storage/logs
    environment:
      VIRTUAL_HOST: ${DDEV_HOSTNAME}
      HTTP_EXPOSE: "80:8080"
      HTTPS_EXPOSE: "443:8080"
volumes:
  userfiles:
    name: ddev-${DDEV_SITENAME}-leantime-userfiles
  public_userfiles:
    name: ddev-${DDEV_SITENAME}-leantime-public-userfiles
  plugins:
    name: ddev-${DDEV_SITENAME}-leantime-plugins
  logs:
    name: ddev-${DDEV_SITENAME}-leantime-logs
YAMLEOF

echo "Starting Leantime ${RELEASE}."
ddev start -y < /dev/null
code=''
for attempt in $(seq 1 100) ; do
  code="$(ddev exec "curl -s -o /dev/null -m 10 -w '%{http_code}' http://leantime:8080/auth/login" < /dev/null 2>/dev/null | tr -d '\r' | tail -1 || true)"
  case "${code}" in 200|302|303) break ;; esac
  [ "${attempt}" = 100 ] && { echo "Leantime did not answer (${code:-none})." ; ddev logs -s leantime --tail 80 < /dev/null || true ; exit 1 ; }
  sleep 3
done

# Leantime's own installer, with an owner of its own (its password made for this site, never printed), then the
# accounts of the suite (owner a Company Manager, member an Editor, commenter a Commenter, reader Read Only, all in the
# project's team; stranger an Editor outside it) and the sample content.
OWNER_PASSWORD="Aa1.$(secret 20)"
OWNER_PASSWORD="${OWNER_PASSWORD}" python3 -c 'import base64, json, os; print(base64.b64encode(json.dumps({"mail": "webmaster@example.com", "password": os.environ["OWNER_PASSWORD"], "first": "Webmaster", "last": "Workspace", "company": "Webship"}).encode()).decode())' | site install defaults
OWNER_PASSWORD=''
code="$(ddev exec "curl -s -o /dev/null -m 10 -w '%{http_code}' http://leantime:8080/auth/login" < /dev/null 2>/dev/null | tr -d '\r' | tail -1)"
[ "${code}" = 200 ] || { echo "Leantime answers ${code} on its login page after its installer: a visitor would not get the login form." ; exit 1 ; }
python3 - "${PASSWORD}" <<'PYEOF' | site accounts
import base64, json, sys
password = sys.argv[1]
rows = [{'login': login, 'mail': login + '@example.com', 'password': password, 'first': login.capitalize(), 'last': 'Test',
         'role': role, 'member': member, 'action': ''}
        for login, role, member in [('owner', 'manager', True), ('member', 'editor', True), ('commenter', 'commenter', True),
                                    ('reader', 'readonly', True), ('stranger', 'editor', False)]]
print(base64.b64encode(json.dumps(rows).encode()).decode())
PYEOF
site content list < /dev/null

echo "The site: https://${NAME}.ddev.site (Leantime ${RELEASE})"
[ -n "${GITHUB_ENV:-}" ] && echo "LAUNCH_URL=https://${NAME}.ddev.site" >> "${GITHUB_ENV}"
exit 0
