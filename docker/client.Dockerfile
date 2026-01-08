FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=development

COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY shared/package.json shared/package.json

RUN npm ci

COPY client ./client
COPY shared ./shared

RUN npm run build --workspace=shared

EXPOSE 5174

CMD ["npm", "run", "dev", "--workspace=client"]
