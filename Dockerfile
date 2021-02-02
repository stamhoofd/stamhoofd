FROM node:14 as common

WORKDIR /usr/src/app

COPY package*.json .

COPY ./shared/ ./shared/

RUN yarn
RUN yarn build
