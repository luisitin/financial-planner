#!/bin/bash
# accept-all.sh <base> <root> <outdir>: B1..B16 one after another; one line per script in <outdir>/summary.txt
W=$SP/w1
mkdir -p "$3"; : > "$3/summary.txt"
for n in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16; do
  timeout 600 node $W/accept-forms/B$n.mjs "$1" "$2" > "$3/B$n.txt" 2>&1; code=$?
  echo "B$n exit $code: $(tail -n 1 "$3/B$n.txt")" >> "$3/summary.txt"
done
echo done >> "$3/summary.txt"
