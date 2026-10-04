# Load DATABASE_URL for migrations when it is not already exported.
# Prefers server/.env, then a systemd Environment line, including the quoted form:
#   Environment="DATABASE_URL=postgres://..."

load_database_url() {
  if [ -n "${DATABASE_URL:-}" ]; then
    return 0
  fi

  local server_dir="${1:-server}"
  local env_file="$server_dir/.env"
  local unit_file="/etc/systemd/system/sorryangelina.service"

  if [ -f "$env_file" ]; then
    DATABASE_URL=$(grep -E '^[[:space:]]*DATABASE_URL=' "$env_file" | head -1 | cut -d= -f2-)
    DATABASE_URL=${DATABASE_URL%\"}
    DATABASE_URL=${DATABASE_URL#\"}
    DATABASE_URL=${DATABASE_URL%\'}
    DATABASE_URL=${DATABASE_URL#\'}
    export DATABASE_URL
  fi

  if [ -n "${DATABASE_URL:-}" ]; then
    return 0
  fi

  if [ ! -f "$unit_file" ]; then
    return 0
  fi

  DATABASE_URL=$(awk '
    /^[[:space:]]*Environment=/ {
      line = $0
      sub(/^[[:space:]]*Environment=/, "", line)
      gsub(/^["'\'']|["'\'']$/, "", line)
      if (line ~ /^DATABASE_URL=/) {
        sub(/^DATABASE_URL=/, "", line)
        gsub(/^["'\'']|["'\'']$/, "", line)
        print line
        exit
      }
    }
  ' "$unit_file")
  export DATABASE_URL
}
