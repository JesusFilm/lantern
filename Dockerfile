FROM node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c AS secure-node
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && sed -i -e 's|^mozilla/emSign_ECC_Root_CA_-_G3.crt|!&|' -e 's|^mozilla/Comodo_AAA_Services_root.crt|!&|' /etc/ca-certificates.conf \
    && update-ca-certificates --fresh \
    && rm -rf /var/lib/apt/lists/*
ENV SSL_CERT_DIR=/usr/local/share/security-ca/certs
RUN mkdir -p "$SSL_CERT_DIR" \
    && awk '/-----BEGIN CERTIFICATE-----/ { n++; f=sprintf("%s/root-%03d.pem", ENVIRON["SSL_CERT_DIR"], n) } f != "" { print > f } /-----END CERTIFICATE-----/ { close(f); f="" }' /etc/ssl/certs/ca-certificates.crt \
    && openssl rehash "$SSL_CERT_DIR"

FROM secure-node AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM secure-node
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY release.json ./release.json
USER node
CMD ["node", "dist/server/index.js"]
