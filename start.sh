#!/usr/bin/bash
cd /home/ubuntu/genie
export PATH=$PATH:/home/ubuntu/.nvm/versions/node/v18.15.0/bin
/home/ubuntu/.nvm/versions/node/v18.15.0/bin/npm update&
/home/ubuntu/.nvm/versions/node/v18.15.0/bin/node /home/ubuntu/genie/main.js