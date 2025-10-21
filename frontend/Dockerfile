FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat

# Copy package files first
COPY package.json package-lock.json* ./

# Build arguments - use empty string for API URL to enable nginx proxy
ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_WS_URL=
ARG NEXT_PUBLIC_KAKAO_API_KEY=""

# Environment variables
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_KAKAO_API_KEY=$NEXT_PUBLIC_KAKAO_API_KEY
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV=production

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

EXPOSE 3000

ENV PORT 3000

# Start Next.js
CMD ["./node_modules/.bin/next", "start"]
