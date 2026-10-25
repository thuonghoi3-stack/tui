#!/bin/sh
# Restart contract: bring the preview up on 0.0.0.0:8080 if it is down.
cd /workspace
if curl -sf -o /dev/null --max-time 1 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev > /tmp/orca-dev.log 2>&1 &
i=0
while [ "$i" -lt 40 ]; do
  if curl -sf -o /dev/null --max-time 1 http://127.0.0.1:8080/; then
    exit 0
  fi
  i=$((i + 1))
  sleep 0.5
done
echo "dev server did not start" >&2
tail -n 40 /tmp/orca-dev.log >&2
exit 1
