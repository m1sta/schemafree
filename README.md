# SchemaFree

An embedded, schema-free, multi-modal database for node.js. Supports graph queries and sql queries. Persistence uses Google's leveldb. See sample.js for more information. Built for discussion purposes.

## Getting Started

1. `npm install schemafree`
2. `let db = require('schemafree')()`
3. Review `sample.js` for a quick demo and to check everything is working

## Api

The api is very short. The source is very short too. At this stage the best place to learn about the package is via sample.js.

- `db.set` to store a entity in the database
- `db.unset` to remove a entity from the database
- `db.link` to link two entities
- `db.unlink` to unlink two entities
- `db.search` to get an entity from the database using a predicate function
- `db.query` to run a sql query against the database
- `db.walk` to run a graph traversal

## Queries

The `query()` function supports almost all of SQL-99 including temp tables, all join types, rollup, cube, and grouping sets, In addition it supports use of a new 'link' statement which makes traversal of many-to-many relationship tables cleaner. See sample.js for more information.

The `search()` function provides a simple way to quickly grab any entity from the database using a javascript function. To get all person entities who with the firstname "Barry" simple type `db.search(person => person.firstname == "Barry")`.

The `walk()` function offers a fluid syntax for quickly traversing stored data like a graph. Available steps are `all()`, `group()`, `map()`, `filter()`, `label()`, and `loop()`.

## Version History

- 0.2 Initial release
- 0.3 Implemented db.unlink. Implemented the sql link shorthand. Bug fixes.
- 0.4 Finished implementing the full suite of walk() functions. Untested.

## High Level Todos
- Write tests
- Write documentation
- Discuss performance optimisations