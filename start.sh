#!/usr/bin/bash
cd /home/ubuntu/genie
#export PATH=$PATH:/home/ubuntu/.nvm/versions/node/v21.6.0/bin
#/home/ubuntu/.nvm/versions/node/v21.6.0/bin/npm update&
/home/ubuntu/.bun/bin/bun update&
/home/ubuntu/.bun/bin/bun /home/ubuntu/genie/main.js
#/home/ubuntu/.nvm/versions/node/v21.6.0/bin/node /home/ubuntu/genie/main.js
