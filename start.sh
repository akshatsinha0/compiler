#!/bin/bash
export PATH="/usr/bin:/usr/local/bin:$PATH"
sudo service docker start
node server.js