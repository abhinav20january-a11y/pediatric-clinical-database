# Lightweight production-style image for the Express API.
FROM node:22-alpine
WORKDIR /app
# The API has no development runtime dependency, so omit dev-only packages.
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
EXPOSE 3000
CMD ["npm","start"]
