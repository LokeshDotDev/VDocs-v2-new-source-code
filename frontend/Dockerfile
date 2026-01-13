FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN npm ci --no-audit --no-fund || npm install

COPY . .

ENV PORT=3001
EXPOSE 3001

CMD ["npm", "run", "dev"]
