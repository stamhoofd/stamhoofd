# Stamhoofd structures

This repository contains all the data structures that are used to communicate with the Stamhoofd API and to store data in (encrypted) json files and in the database. Encoding, decoding and versioning is handled by the @simonbackx/simple-encoding library.

Structures are versioned so older clients remain compatible with newer backends. Before modifying this package, read the encoding, decoding, patching, and versioning documentation in the [Notion developer guide](https://app.notion.com/p/Getting-started-20cc403f36798075b190c84c2c21d1ec).
