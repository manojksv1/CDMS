FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY package*.json ./

# Install ALL dependencies (including devDeps needed for Vite/Tailwind build)
RUN npm ci

# Copy source — this layer is rebuilt only when source changes
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
