Mint candy machine NFTs from your CLI. Use your preferred rpc provider. Avoid rage quitting because the candy machine GUI fails.

## Setup

* `yarn install`
* `yarn build`

## Running

* `yarn start search -k ~/.config/solana/id.json "Degen"`
* All machines will be written to `machines.json` and `machines.txt`.
* `machines.json` is programmatical output, `machines.txt` is user friendly output
* Matches will be at the start of the file and printed to the cli

### Search just V2 Candy Machines

* `yarn start search -k ~/.config/solana/id.json --no-v1 "Degen"`
