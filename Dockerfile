FROM node:14 as common

WORKDIR /usr/src/app

COPY package*.json .

COPY ./shared/ ./shared/
COPY ./backend/shared/ ./shared/

# This version must be used accoriding to the docs
RUN yarn policies set-version 1.22.5
RUN yarn
RUN yarn build
