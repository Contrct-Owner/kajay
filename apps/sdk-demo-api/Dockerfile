FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/sdk-demo-api/package.json apps/sdk-demo-api/package.json
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --frozen-lockfile --filter @kajay/sdk-demo-api...

COPY packages/core packages/core
COPY apps/sdk-demo-api apps/sdk-demo-api
COPY apps/sdk-demo/public/demo-survey.json apps/sdk-demo/public/demo-survey.json
RUN pnpm --filter @kajay/sdk-demo-api... run build

FROM node:22-alpine AS final
WORKDIR /workspace
ENV PORT=8080
EXPOSE 8080
COPY --from=build /workspace/node_modules node_modules
COPY --from=build /workspace/packages/core packages/core
COPY --from=build /workspace/apps/sdk-demo-api apps/sdk-demo-api
COPY --from=build /workspace/apps/sdk-demo apps/sdk-demo
WORKDIR /workspace/apps/sdk-demo-api
CMD ["node", "dist/main.js"]
