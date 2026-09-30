# Typesense Dashboard (typesense-dashboard)

A dashboard to manage and browse a [Typesense](https://typesense.org) server: collections, documents, search, relevance tuning, API keys, AI search and server settings. It runs in the browser or as a desktop app (Electron).

This is a fork of [bfritscher/typesense-dashboard](https://github.com/bfritscher/typesense-dashboard), updated for **Typesense 30.2** and redesigned. The original project began as a side project to test the Typesense API and Quasar with Electron.

## What's different in this fork

**Up to date with Typesense 30.2**

- **Schema editor:** saves only what changed instead of dropping and re-adding every field. Settings Typesense only accepts when a collection is created (`enable_nested_fields`, token separators, symbols to index, default sorting field) are applied by recreating the collection. The documents are first copied into a temporary collection with the new schema, so the original is only replaced once every document has been checked; you can keep the temporary copy as a backup. This fixes the error "Type `object` or `object[]` can be used only when nested fields are enabled" when adding nested fields.
- **Field options:** the field form covers the 30.2 options: references (joins) with async reference and cascade delete, auto-embedding and vector fields (distance, HNSW settings), stemming dictionaries, range index, per-field locale, token separators and symbols, plus collection metadata.
- **Synonym and curation sets (v30):** browse sets, see which collections use each one, and link or unlink collections explicitly. Deleting a set first removes it from every collection that uses it, since a linked set that no longer exists breaks search on that collection. Servers before v30 keep per-collection synonyms and curations.
- **AI search:** manage natural-language search models and conversation models (OpenAI, Azure, Gemini, Vertex AI, Cloudflare, vLLM). On a collection's Search page, **Ask** runs natural-language search, which shows the filters, sorting and keywords the model chose, or conversational search (RAG), with follow-up questions and the documents each answer was based on.
- **Bulk deletes:** delete documents by filter, with a live count of matches first, or delete all documents while keeping the collection and its schema.

**Server settings**

- Change runtime settings on the running node: slow request and slow search logging, logging every search, cache sizes, healthy read and write lag, and skipping writes.
- Run operations: create a snapshot, compact the database, clear the search cache, trigger a leader election, and see the node's Raft state and any schema changes in progress.
- Settings that can only be set at startup, such as CORS domains, can't be changed on a running server. For those, the page generates a `docker run` command, a `docker-compose.yml`, an environment file or a config file.

**Easier to use**

- A new design with dark mode, navigation grouped by task, and a **Ctrl K / ⌘K** menu to jump to any page or collection.
- Forms instead of raw JSON for API keys (with presets; the new key is shown once, with a copy button), analytics rules, search presets, stopwords, stemming dictionaries and curations. JSON editing is still available where it was before.
- Adding documents starts from an example built from the schema, including nested fields. Files can be imported from the page (in the browser and the desktop app), with a choice of what happens when an ID already exists, and the summary lists only the documents that failed.
- **Help built in:** each page and most settings have a help button that explains them in plain language and links to the matching section of the Typesense [API reference](https://typesense.org/docs/30.2/api/) (for the connected server's version) or [Guide](https://typesense.org/docs/guide/). A Help page gives a getting-started path.

**Under the hood**

- The app's state is split into one Pinia store per feature.
- Unit tests cover the schema diff (including a randomized check), field options, document templates, server configuration, AI model settings and help links.
- A GitHub Actions workflow runs the tests, lint, the type check and a formatting check on every push.

## Usage

### Web

As a web application, only a Typesense server started with `--enable-cors` will work, because the browser talks to the server directly. The Server settings page can generate the startup configuration for this.

https://bfritscher.github.io/typesense-dashboard/ hosts the **original** project, which doesn't include the changes above. This fork isn't hosted anywhere yet, so build it and serve it yourself, for example with Docker.

#### Limitation

When the dashboard is served from an https address, your Typesense server must also use https, or the browser blocks the requests with a mixed content error. You can allow mixed content in your browser, but this isn't recommended.

#### Docker

Self-host the dashboard with Docker:

```bash
docker build -t typesense-dashboard .
docker run -d -p 80:80 typesense-dashboard
```

nginx serves the files. You can also copy `/srv` from the final image into another image:

```Dockerfile
FROM alpine
COPY --from=typesense-dashboard /srv /typesense-dashboard
```

To serve from a subfolder such as `/example` (it must start with `/`), set the `PUBLIC_PATH` build argument. It applies when the image is built, not when the container starts:

```bash
docker build --build-arg=PUBLIC_PATH=/example -t typesense-dashboard .
```

#### Pre-built images

The `Build and Deploy Docker Image` workflow publishes the image on every push to `main` and on version tags, to GitHub Container Registry and Docker Hub:

- `ghcr.io/kcarpenter528/typesense-dashboard`
- `kcarpenter528/typesense-dashboard` on [Docker Hub](https://hub.docker.com/r/kcarpenter528/typesense-dashboard)

`main` follows the main branch. A version tag such as `v2.5.0` publishes `2.5.0`, `2.5` and `latest`.

```bash
docker run -d -p 80:80 kcarpenter528/typesense-dashboard:main
```

To publish from your own fork, add these under **Settings › Secrets and variables › Actions**:

- variable `DOCKERHUB_USERNAME`: the Docker Hub account to publish to
- secret `DOCKERHUB_TOKEN`: a Docker Hub access token with read and write access

GitHub makes a new container package private. To let anyone pull it, change its visibility under the package's settings on GitHub.

`ghcr.io/bfritscher/typesense-dashboard` is the **original** project's image and doesn't include the changes in this fork.

#### Development proxy (`/api`)

When running `npm run dev`, you can proxy `/api` to a remote Typesense server to avoid CORS issues during local development.

Set `DEV_API_PROXY_TARGET` to the remote origin (protocol, host and optional port). The dev server forwards `/api/*` to the target and removes the `/api` prefix.

PowerShell example:

```powershell
$env:DEV_API_PROXY_TARGET = "https://my-typesense.example.com"; npm run dev
```

### Configuration

The web version can be configured with a `config.json` file: autologin, a connection timeout, UI options, bookmarks (through the server history) and cluster tags. The desktop app doesn't read this file.

The file is loaded from the same path as the dashboard: `/config.json`, or for example `/example/config.json` when built with `PUBLIC_PATH=/example`. There are two ways to provide it when running in Docker:

- mount a `config.json` file into the container at `/srv/config.json` (or `/srv/<PUBLIC_PATH>/config.json`)
- set the environment variable `TYPESENSE_DASHBOARD_CONFIG` to the file's contents, base64 encoded. The container writes it to `/srv/config.json` at startup, so this only works with the default `PUBLIC_PATH` of `/`.

```bash
docker run -d -p 80:80 -v /path/to/config.json:/srv/config.json typesense-dashboard
```

```bash
docker run -d -p 80:80 -e TYPESENSE_DASHBOARD_CONFIG=$(base64 -w 0 /path/to/config.json) typesense-dashboard
```

The file holds the same data the dashboard saves in the browser's local storage. A full example is in `config.json.sample`:

```json
{
  "apiKey": "xyz",
  "node": {
    "host": "somehost",
    "port": "443",
    "protocol": "https",
    "path": "",
    "tls": true
  },
  "connectionTimeoutSeconds": 10,
  "ui": {
    "hideProjectInfo": false
  },
  "history": [
    {
      "apiKey": "abc",
      "node": {
        "host": "anotherhost",
        "port": "80",
        "protocol": "http",
        "path": "",
        "tls": false
      }
    },
    {
      "apiKey": "def",
      "node": {
        "host": "yetanotherhost",
        "port": "8080",
        "protocol": "http",
        "path": "",
        "tls": true
      },
      "clusterTag": "dev-cluster"
    }
  ]
}
```

- With `apiKey` and `node`, the dashboard connects automatically.
- `connectionTimeoutSeconds` sets how long a request may take. The default is 5 seconds; large imports and exports may need more.
- `history` fills the list of recent servers, which work as bookmarks.

#### Special host mode: `SAME`

For the web version, you can set `node.host` to `"SAME"` to connect to a Typesense node on the same hostname the dashboard is served from. When `host` is `"SAME"`, the dashboard uses:

- `host` from `window.location.hostname`
- `protocol` from `window.location.protocol` (`http` / `https`)
- `port` from `window.location.port`, else the `port` in the file, else 80 or 443

This is useful when you reverse-proxy the dashboard and Typesense under the same domain:

```json
{
  "node": {
    "host": "SAME",
    "path": "/api"
  }
}
```

#### UI Configuration

The `ui` section customizes the interface:

- `hideProjectInfo`: set to `true` to hide the project information (version, GitHub link and issue tracker) at the bottom of the navigation. Default is `false`.

### Cluster Status

The Cluster page shows several Typesense nodes side by side and polls their status in parallel. Each node card shows:

- Node URL and version
- Role (Leader or Follower)
- Memory and disk usage
- Typesense memory metrics (the `typesense_*` metrics)
- System network received and sent
- Stats (if enabled on the node)

How it works:

- The **Cluster** entry appears in the navigation (under Server) only when the connected node belongs to a cluster.
- Nodes belong to a cluster through an optional `clusterTag` on each saved server.
- Nodes are listed in a stable order (host, then port, then protocol), and the current node is marked. You can connect to another node directly from its card.

Ways to define clusters:

- In the UI: tag any saved server (from the server menu in the header, or the recent servers on the login page). The tag input suggests existing tags and accepts new ones.
- In `config.json`: give history entries a `clusterTag` to group them. An entry without `clusterTag` isn't part of any cluster.

### Desktop

In the desktop app, requests go through Electron rather than the browser, so the Typesense server doesn't need CORS. The exception is the **Browse** tab of a collection's Search page (InstantSearch), which still runs in the page and needs CORS.

Pre-built downloads are on the original project's [release page](https://github.com/bfritscher/typesense-dashboard/releases) and **don't include the changes in this fork**. This fork has no releases yet, so build the desktop app yourself (see [Build the app for production](#build-the-app-for-production)).

#### _Linux_

The app can't be started by clicking on it in Nautilus[\*](https://stackoverflow.com/questions/55060402/electron-executable-not-recognized-by-nautilus). Make it executable, then run it from the command line:

```
./'Typesense-Dashboard'
```

## Screenshots

### Server

Server status: health, request rates, search latency and resource use, refreshed every two seconds.

![Server status](docs/images/server.png)

Server settings: change runtime settings, run operations such as snapshots and cache clearing, and generate the startup configuration for settings like CORS.

![Server settings](docs/images/settings.png)

### Collections and documents

![Collections](docs/images/collections.png)

Create a collection with a form or as JSON. Each setting has an ⓘ button that explains it.

![New collection](docs/images/collection_add.png)

![Schema editor](docs/images/schema.png)

![Add documents](docs/images/document.png)

### Search

Browse with facets and sorting:

![Search](docs/images/search.png)

Send any search parameters as JSON:

![Search as JSON](docs/images/search_json.png)

Ask in plain language, with natural-language search or conversational search (RAG):

![Ask](docs/images/ask.png)

### Relevance

![Synonyms](docs/images/synonyms.png)

![Curations](docs/images/curations.png)

### AI search and access

![Conversation models](docs/images/ai_models.png)

![Aliases](docs/images/aliases.png)

![API keys](docs/images/apikeys.png)

### Help and navigation

Every page and setting explains itself and links to the matching section of the Typesense API reference or Guide:

![Help for a field option](docs/images/field_help.png)

![Help](docs/images/help.png)

Press Ctrl K (⌘K on macOS) to jump to any page or collection:

![Jump to a page or collection](docs/images/jump.png)

Dark mode:

![Dark mode](docs/images/dark.png)

## Known Issues and Limitations

- **Scoped search keys** can't be generated in the dashboard. Generate them with a Typesense client library.
- **Large imports and exports** are read fully into memory and must finish within the connection timeout, 5 seconds by default. Raise **Connection timeout** under Advanced on the login screen, or `connectionTimeoutSeconds` in `config.json`. This applies to the desktop app too.
- **Runtime settings:** Typesense doesn't report their current values, so the Server settings page shows the last value applied from this browser, or the default. Changes apply only to the node you're connected to and are lost when it restarts.
- **Startup-only settings**, such as CORS domains, the API port or memory limits, can't be changed from the dashboard. The Server settings page generates the configuration to restart the server with.
- **Recreating a collection** (to change a setting only accepted at creation) copies every document twice: into a temporary collection and back. The collection is missing or incomplete while it's being refilled, and large collections take time and memory.
- **AI search** was tested against a local OpenAI-compatible stand-in model, not a real provider. Conversational answers arrive in one piece; streaming (`conversation_stream`) isn't supported.
- **Servers before v30:** per-collection synonyms and curations are still supported, but haven't been tested against a real pre-v30 server since the redesign.
- **The hosted version and desktop downloads** linked above are the original project's, not this fork's. The GitHub Pages and release workflows in `.github/workflows` haven't been set up or run for this fork.
- The API key you log in with is saved in the browser's local storage (and in the recent servers list), so only use the dashboard on machines you trust.

# Development

Requires Node.js 22.22 or newer (the CI and Docker builds use Node 24) and npm.

## Install the dependencies

```bash
npm ci
# desktop app dependencies, also needed for the type check
npm ci --prefix src-electron
```

To install only Electron's type definitions without downloading Electron itself, as CI does, set `ELECTRON_SKIP_BINARY_DOWNLOAD=1` and add `--ignore-scripts` to the second command.

### Start the app in development mode (hot-code reloading, error reporting, etc.)

```bash
npm run dev
npm run dev:desktop
```

### Test

```bash
npm test            # unit tests (Vitest)
npm run type-check  # vue-tsc
npm run lint        # ESLint
```

The Tests workflow runs these, plus a Prettier check on `src/`, on every push.

### Format the files

```bash
npm run format
```

### Build the app for production

```bash
npm run build
npm run build:desktop
```

`npm run build` writes the web app to `dist/spa`. Without `PUBLIC_PATH` it expects to be served from `/typesense-dashboard/` (for GitHub Pages); set `PUBLIC_PATH=/` to serve it from the root. `npm run build:desktop` builds the desktop app for all platforms into `dist/electron`.

### Customize the configuration

See [the Quasar config file documentation](https://quasar.dev/quasar-cli-vite/quasar-config-file).
