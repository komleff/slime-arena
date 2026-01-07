FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=development

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json

RUN npm ci

COPY server ./server
COPY shared ./shared

RUN npm run build --workspace=shared

EXPOSE 2567

CMD ["npm", "run", "dev", "--workspace=server"]
