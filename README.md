# SchemaFree

An embedded, schema-free, multi-modal database for node.js. Supports graph queries and sql queries. Persistence uses Google's leveldb. See sample.js for more information. Built for discussion purposes.

## Getting Started

1. Grab the source
2. `npm init`
3. `node sample.js`

## Api

The api is very short. The source is very short too. At this stage the best place to learn about the package is via sample.js.

- `db.set` to store a entity in the database
- `db.unset` to remove a entity from the database
- `db.link` to link two entities
- `db.unlink` to unlink two entities
- `db.query` to run a sql query against the database
- `db.walk` to run a graph traversal
