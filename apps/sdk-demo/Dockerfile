FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./
COPY apps/sdk-demo/package.json apps/sdk-demo/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/creator-core/package.json packages/creator-core/package.json
COPY packages/creator-react/package.json packages/creator-react/package.json
COPY packages/react/package.json packages/react/package.json
COPY packages/themes/package.json packages/themes/package.json
RUN pnpm install --frozen-lockfile --filter @kajay/sdk-demo...

COPY contracts contracts
COPY packages packages
COPY apps/sdk-demo apps/sdk-demo
ARG VITE_KAJAY_RUNTIME=typescript
ENV VITE_KAJAY_RUNTIME=$VITE_KAJAY_RUNTIME
RUN pnpm --filter @kajay/sdk-demo... run build

FROM nginx:1.29-alpine AS typescript
COPY --from=build /workspace/apps/sdk-demo/dist /usr/share/nginx/html
COPY apps/sdk-demo/nginx/static.conf /etc/nginx/conf.d/default.conf

FROM nginx:1.29-alpine AS dotnet
COPY --from=build /workspace/apps/sdk-demo/dist /usr/share/nginx/html
COPY apps/sdk-demo/nginx/dotnet.conf /etc/nginx/conf.d/default.conf
