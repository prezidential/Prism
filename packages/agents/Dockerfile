FROM node:20-alpine AS base
WORKDIR /app

# Copy workspace config
COPY package.json package-lock.json* ./
COPY tsconfig.json ./

# Copy package manifests for all workspaces needed by agents
COPY packages/identograph/package.json packages/identograph/
COPY packages/api/package.json packages/api/
COPY packages/agents/package.json packages/agents/

# Install dependencies for agents and identograph workspaces
RUN npm ci --workspace=packages/agents --workspace=packages/identograph --ignore-scripts

# Copy source
COPY packages/identograph/src packages/identograph/src
COPY packages/agents/src packages/agents/src

# Build
RUN npm run build --workspace=packages/identograph
RUN npm run build --workspace=packages/agents

FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/identograph/dist ./packages/identograph/dist
COPY --from=base /app/packages/agents/dist ./packages/agents/dist
COPY --from=base /app/packages/agents/ssd ./packages/agents/ssd
COPY package.json ./
COPY packages/identograph/package.json packages/identograph/
COPY packages/agents/package.json packages/agents/

CMD ["node", "packages/agents/dist/okta/entrypoint.js"]
