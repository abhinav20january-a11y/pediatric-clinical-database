# Lightweight Node image used to run the Vite development server.
FROM node:22-alpine
WORKDIR /app
# Install dependencies before copying source so Docker can reuse the dependency layer.
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm","run","dev"]
