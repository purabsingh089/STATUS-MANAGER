FROM mcr.microsoft.com/playwright:v1.50.1-jammy

WORKDIR /app

COPY package.json package-lock.json* ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN npm install

COPY . .

RUN npm run build -w backend || npx tsc -p backend/tsconfig.json
RUN npm run build -w frontend

ENV NODE_ENV=production
ENV PORT=3001
ENV PROVIDER=mock
ENV PLAYWRIGHT_ENABLED=false

EXPOSE 3001
EXPOSE 3000

CMD ["sh", "-c", "npm run start -w backend & npm run start -w frontend & wait"]
