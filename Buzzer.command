#!/bin/bash
cd "$(dirname "$0")"
node server.js &
sleep 1.5
open http://127.0.0.1:3000/host.html
wait
