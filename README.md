# GeoSQL setup

This repo is set up with the [GeoSQL](https://github.com/dekart-xyz/geosql) skill for
Claude Code, for geospatial SQL work on PostGIS, BigQuery, Snowflake, and Wherobots.

The skill lives in `.claude/skills/geosql/`, so any Claude Code session opened in this
repo picks it up automatically — no install step needed. Try a prompt like:

```
/geosql Show EV charger density along major roads and render a map
```

## Optional: maps with Dekart

To let the agent render maps and read them back, install and authorize the Dekart CLI
(one-time, on the machine you work from):

```sh
python3 -m pip install dekart
dekart init
```

`dekart init` opens a browser to connect to Dekart Cloud (no Docker needed), or you can
point it at a local/self-hosted instance with `dekart config`.

## Database connections

GeoSQL uses your local CLI authentication (`bq` for BigQuery, `snow` for Snowflake,
`psql`/connection strings for PostGIS), so credentials never go to the agent. Make sure
the relevant CLI is authenticated before asking for queries against your warehouse.
