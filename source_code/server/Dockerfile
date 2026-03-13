FROM node:alpine3.18

WORKDIR /src

COPY package.json ./

# Install Python and build dependencies needed for bcrypt
RUN apk add --no-cache python3 make g++ && ln -sf python3 /usr/bin/python

RUN npm install

COPY . .

EXPOSE 443
EXPOSE 80
EXPOSE 3000

CMD ["npm", "start"]