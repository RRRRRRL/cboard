# Stage 1 - the build process
FROM node:20.18.1 as build-deps
WORKDIR /usr/src/app

# Configure yarn registry and retry settings
RUN yarn config set registry https://registry.yarnpkg.com && \
    yarn config set network-timeout 300000 && \
    yarn config set network-concurrency 1

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies with retry logic
# First try with engine checks, then fallback to ignoring engine checks if needed
RUN yarn install --network-timeout 300000 --network-concurrency 1 || \
    (echo "First attempt failed, retrying..." && sleep 5 && yarn install --network-timeout 300000 --network-concurrency 1) || \
    (echo "Second attempt failed, retrying with engine checks ignored..." && sleep 10 && yarn install --network-timeout 300000 --network-concurrency 1 --ignore-engines) || \
    (echo "Third attempt failed, retrying with cache and engine checks ignored..." && sleep 15 && yarn install --network-timeout 300000 --network-concurrency 1 --prefer-offline --ignore-engines)

# Copy source code
COPY . ./

# Build the application
RUN NODE_OPTIONS="--max-old-space-size=4192" yarn build

# Stage 2 - the production environment
FROM nginx:stable-alpine
COPY ./rootfs/ /
COPY --from=build-deps /usr/src/app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
