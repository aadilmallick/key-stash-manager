# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/go/dockerfile-reference/

# Want to help us make this template better? Share your feedback here: https://forms.gle/ybq9Krt8jtBL3iCk7

ARG NODE_VERSION=24.0.2

FROM node:${NODE_VERSION}-alpine

# Use development for build to install devDependencies
ENV NODE_ENV=development
ENV USING_DOCKER=true
ENV USING_SERVER=true

# install bash
RUN apk add --no-cache bash

# Set working directory for all build stages.
RUN mkdir -p /usr/src/app
RUN chown -R node:node /usr/src/app
WORKDIR /usr/src/app

# Copy and install server dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy and install frontend dependencies (including devDependencies for build)
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm install

# Copy the rest of the source code (excluding node_modules via .dockerignore)
COPY . .

# Build the frontend
RUN cd frontend && npm run build

# Change to production environment for runtime
ENV NODE_ENV=production

# Expose the port that the application listens on.
EXPOSE 5000

# Switch to node user for runtime
USER node

# Run the application.
CMD ["npm", "start"]
