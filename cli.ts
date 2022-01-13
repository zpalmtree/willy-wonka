#!/usr/bin/env node
import { program } from 'commander';
import * as anchor from '@project-serum/anchor';
import { Idl, Program, ProgramAccount } from "@project-serum/anchor";
import fs from "fs/promises";
import {MintLayout, Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, AccountInfo} from '@solana/spl-token';
import {
    Blockhash,
    Commitment,
    Connection, FeeCalculator,
    Keypair,
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY, Transaction,
    TransactionInstruction,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import fetch from 'node-fetch';

program.version("0.1.0");

const candyMachineV1 = new PublicKey(
    'cndyAnrLdpjq1Ssp1z8xxDsB8dxe7u4HL5Nxi2K5WXZ',
);

const candyMachineV2 = new PublicKey(
    'cndy3Z4yapfJBmL3ShUp5exZKqR3z33thTzeNMm2gRZ'
);

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
    'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
);

export const MAX_NAME_LENGTH = 32;
export const MAX_URI_LENGTH = 200;
export const MAX_SYMBOL_LENGTH = 10;
export const MAX_CREATOR_LEN = 32 + 1 + 1;
export const MAX_CREATOR_LIMIT = 5;

const CONFIG_ARRAY_START =
  32 + // authority
  4 +
  6 + // uuid + u32 len
  4 +
  10 + // u32 len + symbol
  2 + // seller fee basis points
  1 +
  4 +
  5 * 34 + // optional + u32 len + actual vec
  8 + //max supply
  1 + //is mutable
  1 + // retain authority
  4; // max number of lines;

const CONFIG_ARRAY_START_V2 =
  8 + // key
  32 + // authority
  32 + //wallet
  33 + // token mint
  4 +
  6 + // uuid
  8 + // price
  8 + // items available
  9 + // go live
  10 + // end settings
  4 +
  MAX_SYMBOL_LENGTH + // u32 len + symbol
  2 + // seller fee basis points
  4 +
  MAX_CREATOR_LIMIT * MAX_CREATOR_LEN + // optional + u32 len + actual vec
  8 + //max supply
  1 + // is mutable
  1 + // retain authority
  1 + // option for hidden setting
  4 +
  MAX_NAME_LENGTH + // name length,
  4 +
  MAX_URI_LENGTH + // uri length,
  32 + // hash
  4 + // max number of lines;
  8 + // items redeemed
  1 + // whitelist option
  1 + // whitelist mint mode
  1 + // allow presale
  9 + // discount price
  32 + // mint key for whitelist
  1 +
  32 +
  1; // gatekeeper

export const CONFIG_LINE_SIZE_V2 = 4 + 32 + 4 + 200;
export const CONFIG_LINE_SIZE = 4 + 32 + 4 + 200;

function formatSOL(amount: number) {
    return `${(amount / LAMPORTS_PER_SOL).toFixed(2)} SOL`;
}

function unpackConfigItemV1(i: number, data: Buffer): [string, string] {
    const thisSlice = data.slice(
        CONFIG_ARRAY_START + 4 + CONFIG_LINE_SIZE * i,
        CONFIG_ARRAY_START + 4 + CONFIG_LINE_SIZE * (i + 1),
    );

    const name = fromUTF8Array([...thisSlice.slice(4, 36)]);
    const uri = fromUTF8Array([...thisSlice.slice(40, 240)]);

    return [
        name.replace(/\u0000/g, ''),
        uri.replace(/\u0000/g, ''),
    ];
}

function unpackConfigItemV2(i: number, data: Buffer): [string, string] {
    const thisSlice = data.slice(
        CONFIG_ARRAY_START_V2 + 4 + CONFIG_LINE_SIZE_V2 * i,
        CONFIG_ARRAY_START_V2 + 4 + CONFIG_LINE_SIZE_V2 * (i + 1),
    );

    const name = fromUTF8Array([...thisSlice.slice(2, 34)]);
    const uri = fromUTF8Array([...thisSlice.slice(40, 240)]);

    return [
        name.replace(/\u0000/g, ''),
        uri.replace(/\u0000/g, ''),
    ];
}

export function fromUTF8Array(data: number[]) {
    // array of bytes
    let str = '',
        i;

    for (i = 0; i < data.length; i++) {
        const value = data[i];

        if (value < 0x80) {
            str += String.fromCharCode(value);
        } else if (value > 0xbf && value < 0xe0) {
            str += String.fromCharCode(((value & 0x1f) << 6) | (data[i + 1] & 0x3f));
            i += 1;
        } else if (value > 0xdf && value < 0xf0) {
            str += String.fromCharCode(
                ((value & 0x0f) << 12) |
                ((data[i + 1] & 0x3f) << 6) |
                (data[i + 2] & 0x3f),
            );
            i += 2;
        } else {
            // surrogate pair
            const charCode =
                (((value & 0x07) << 18) |
                    ((data[i + 1] & 0x3f) << 12) |
                    ((data[i + 2] & 0x3f) << 6) |
                    (data[i + 3] & 0x3f)) -
                0x010000;

            str += String.fromCharCode(
                (charCode >> 10) | 0xd800,
                (charCode & 0x03ff) | 0xdc00,
            );
            i += 3;
        }
    }

    return str;
}

const getTokenWallet = async function (wallet: PublicKey, mint: PublicKey) {
    return (
        await PublicKey.findProgramAddress(
            [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
            ASSOCIATED_TOKEN_PROGRAM_ID,
        )
    )[0];
};

const getMetadata = async (
    mint: anchor.web3.PublicKey,
): Promise<anchor.web3.PublicKey> => {
    return (
        await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from('metadata'),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.toBuffer(),
            ],
            TOKEN_METADATA_PROGRAM_ID,
        )
    )[0];
};

const getMasterEdition = async (
    mint: anchor.web3.PublicKey,
): Promise<anchor.web3.PublicKey> => {
    return (
        await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from('metadata'),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.toBuffer(),
                Buffer.from('edition'),
            ],
            TOKEN_METADATA_PROGRAM_ID,
        )
    )[0];
};

export function createAssociatedTokenAccountInstruction(
    associatedTokenAddress: PublicKey,
    payer: PublicKey,
    walletAddress: PublicKey,
    splTokenMintAddress: PublicKey,
) {
    const keys = [
        {
            pubkey: payer,
            isSigner: true,
            isWritable: true,
        },
        {
            pubkey: associatedTokenAddress,
            isSigner: false,
            isWritable: true,
        },
        {
            pubkey: walletAddress,
            isSigner: false,
            isWritable: false,
        },
        {
            pubkey: splTokenMintAddress,
            isSigner: false,
            isWritable: false,
        },
        {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
        },
        {
            pubkey: TOKEN_PROGRAM_ID,
            isSigner: false,
            isWritable: false,
        },
        {
            pubkey: SYSVAR_RENT_PUBKEY,
            isSigner: false,
            isWritable: false,
        },
    ];
    return new TransactionInstruction({
        keys,
        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
        data: Buffer.from([]),
    });
}

interface BlockhashAndFeeCalculator {
    blockhash: Blockhash;
    feeCalculator: FeeCalculator;
}

async function loadCandyProgram(
    provider: anchor.Provider,
    programId: PublicKey) {

    const idl = await anchor.Program.fetchIdl(
        programId,
        provider,
    );

    if (!idl) {
        throw new Error(`Failed to fetch IDL for ${programId.toString()}!`);
    }

    const program = new anchor.Program(idl, programId, provider);

    return program;
}

async function searchCandyMachine(
    programId: PublicKey,
    keypair: Keypair,
    connection: Connection,
    walletWrapper: anchor.Wallet,
    provider: anchor.Provider,
    pattern: string,
    candyVersion: number) {

    const candyProgram = await loadCandyProgram(
        provider,
        programId,
    );

    const candyMachines = await candyProgram.account.candyMachine.all();

    const configPublicKeys = candyMachines.map(candyMachine => candyMachine?.account?.config ? candyMachine.account.config : candyMachine.publicKey);

    let configBuffers : any[] = [];
    let configsFetched = 0;
    const chunkSize = 99;

    console.log(`Found ${configPublicKeys.length} V${candyVersion} candy machines...`);

    while (configsFetched < configPublicKeys.length) {
        console.log(`Fetching configs ${configsFetched} through ${configsFetched + chunkSize}`);

        const accountsToFetch = configPublicKeys.slice(configsFetched, configsFetched + chunkSize);

        while (true) {
            try {
                const nextConfigBuggers = await connection.getMultipleAccountsInfo(accountsToFetch);

                configsFetched += chunkSize;

                for (const config of nextConfigBuggers) {
                    if (config?.data) {
                        configBuffers.push(config.data);
                    }
                }

                break;
            } catch (err) {
                console.log((err as any).toString());
                continue;
            }
        }
    }

    const configMap = configBuffers.reduce((map, data) => {
        try {
            const field = candyVersion === 1
                ? 'Config'
                : 'CandyMachine';

            const config: any = candyProgram.coder.accounts.decode(field, data);

            const existing = map.get(`${config.authority.toString()}-${config.data.uuid}`);

            if (existing) {
                console.log('Duplicate candy machine!');
                return map;
            }

            map.set(`${config.authority.toString()}-${config.data.uuid}`, data);
        } catch (err) {
            console.log('Error decoding config data: ' + err);
        }

        return map;
    }, new Map());

    const data = [];

    const unpackFunc = candyVersion === 2
        ? unpackConfigItemV2
        : unpackConfigItemV1;

    for (let candyMachine of candyMachines) {
        const numberOfItems = candyMachine.account.data.itemsAvailable.toString();
        const price = candyMachine.account.data.price.toString();
        const date = candyMachine.account.data.goLiveDate
            ? new Date(candyMachine.account.data.goLiveDate.toString() * 1000)
            : 'Not Set';

        const config = configMap.get(`${candyMachine.account.authority.toString()}-${candyMachine.account.data.uuid}`);

        if (!config) {
            continue;
        }

        let obj: any;

        for (let i = 0; i < numberOfItems; i++) {
            const [name, uri] = unpackFunc(i, config);

            obj = {
                candyAddress: candyMachine.publicKey.toString(),
                exampleItem: name,
                exampleMetadata: uri,
                match: false,
                candyMachineVersion: candyVersion,
                items: numberOfItems,
                price: formatSOL(price),
                date,
                candyConfig: undefined,
                treasury: undefined,
                gatekeeper: false,
            };

            if (name.match(new RegExp(`.*${pattern}.*`, 'i'))) {
                console.log(`Match!`);
                console.log(`Name: ${name}`);
                console.log(`Uri: ${uri}`);

                let loadedCandyMachine: any;

                try {
                    loadedCandyMachine = await candyProgram.account.candyMachine.fetch(
                        candyMachine.publicKey,
                    );
                } catch (err) {
                    console.log('Failed to fetch candy machine data!\n');
                    break;
                }

                obj.candyConfig = candyVersion === 1
                    ? loadedCandyMachine.config.toString()
                    : loadedCandyMachine.authority.toString();

                obj.match = true;
                obj.treasury = loadedCandyMachine.wallet.toString();
                obj.gatekeeper = loadedCandyMachine.data.gatekeeper !== undefined && loadedCandyMachine.data.gatekeeper !== null;

                const whitelist = loadedCandyMachine.data.whitelistMintSettings;

                if (whitelist) {
                    obj.whitelist = {
                        mintToken: whitelist.mint.toString(),
                        presale: whitelist.presale,
                    }

                    if (whitelist.discountPrice) {
                        obj.whitelist.discountPrice = formatSOL(whitelist.discountPrice);
                    }
                }

                if (true) {
                    let env = `\nREACT_APP_CANDY_MACHINE_ID=${obj.candyAddress}\n\n\n`;

                    console.log(env);
                }

                break;
            } else {
                obj.match = false;
            }
        }

        data.push(obj);
    }

    return {
        data,
        count: candyMachines.length,
    };
}

async function writeData(filename: string, data: any[]) {
    let output = '';

    let stars = '*'.repeat(20);

    for (const item of data) {
        if (!item.match) {
            continue;
        }

        let line = '';

        line += `${stars}\n\n`;

        line += `Name: ${item.exampleItem}\n`;
        line += `Example Item: ${item.exampleMetadata}\n`;
        line += `Item Price: ${item.price}\n`;
        line += `Item Count: ${item.items}\n`;
        line += `Mint Date: ${item.date}\n\n`;

        line += `Candy Machine Version: ${item.candyMachineVersion}\n`;
        line += `Captcha Protected: ${item.gatekeeper}\n`;

        if (item.whitelist) {
            line += `Presale: ${item.whitelist.presale}\n`;
            line += `Whitelist Token: ${item.whitelist.mintToken}\n`;

            if (item.whitelist.discountPrice) {
                line += `Whitelist Discount Price: ${item.whitelist.discountPrice}\n`;
            }
        }

        let env = `\nREACT_APP_CANDY_MACHINE_ID=${item.candyAddress}`;

        line += `${env}\n\n`;

        output += line;
    }

    output += `${stars}`;

    await fs.writeFile(filename, output, { encoding: 'utf8' });
}

program.command("search")
    .argument('<pattern>', "The pattern used to identify candy machine configs")
    .option('-k, --keypair <path>', 'Solana wallet')
    .option('--no-v1', 'Exclude v1 candy machines', false)
    .option('--no-v2', 'Exclude v2 candy machines', false)
    .action(async (pattern, options) => {
        const { keypair, v1, v2 } = options;

        const res = await fetch('https://letsalllovelain.com/solananode/');
        const { node } = (await res.json()) as any;

        const key = await fs.readFile(keypair, { encoding: 'utf-8' });

        const walletKey = anchor.web3.Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(key)),
        );

        const walletWrapper = new anchor.Wallet(walletKey);

        const connection = new anchor.web3.Connection(node);
        const provider = new anchor.Provider(connection, walletWrapper, {
            preflightCommitment: 'recent',
        });

        let v1Machines: any = {
            count: 0,
            data: [],
        };

        let v2Machines: any = {
            count: 0,
            data: [],
        };

        if (v1) {
            v1Machines = await searchCandyMachine(
                candyMachineV1,
                keypair,
                connection,
                walletWrapper,
                provider,
                pattern,
                1,
            );
        }

        if (v2) {
            v2Machines = await searchCandyMachine(
                candyMachineV2,
                keypair,
                connection,
                walletWrapper,
                provider,
                pattern,
                2,
            );
        }

        const sorted = await v1Machines.data.concat(v2Machines.data).sort(sortData);

        await writeData('machines.txt', sorted);

        await fs.writeFile('machines.json', JSON.stringify(sorted, null, 4), { encoding: 'utf8' });
    });

function sortData(a: any, b: any) {
    const aNum = Number(a.match);
    const bNum = Number(b.match);

    if (aNum !== bNum) {
        return bNum - aNum;
    }

    if (a.candyMachineVersion !== b.candyMachineVersion) {
        return b.candyMachineVersion - a.candyMachineVersion;
    }

    if (a.exampleItem !== b.exampleItem) {
        return a.exampleItem.localeCompare(b.exampleItem);
    }

    return b.price.localeCompare(a.price.localeCompare);
}

program.command("wen")
    .argument('<candy-machine>', "Candy machine account to fetch")
    .option('-k, --keypair <path>', 'Solana wallet')
    .option('-u, --url <url>', 'rpc url e.g. https://api.devnet.solana.com')
    .action(async (candyMachinePublicKeyString, options) => {
        const { keypair, url } = options;
        const candyMachinePublicKey = new anchor.web3.PublicKey(candyMachinePublicKeyString);

        const key = await fs.readFile(keypair, { encoding: 'utf-8' });

        const walletKey = anchor.web3.Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(key)),
        );

        const connection = new anchor.web3.Connection(url);
        const walletWrapper = new anchor.Wallet(walletKey);
        const provider = new anchor.Provider(connection, walletWrapper, {
            preflightCommitment: 'recent',
        });

        const candyV1Program = await loadCandyProgram(provider, candyMachineV1);

        const candyMachine : any = await candyV1Program.account.candyMachine.fetch(
            candyMachinePublicKey
        );

        if (candyMachine) {
            if (candyMachine.data.goLiveDate) {
                const date = new Date(candyMachine.data.goLiveDate.toNumber() * 1000);
                console.log(date.toString());
            } else {
                console.log(`Candy machine ${candyMachinePublicKeyString} does noot have live date`);
            }
        } else {
            console.error(`Candy machine ${candyMachinePublicKeyString} doesn't exist`);
        }
    });

program.command("mint")
    .argument('<candy-machine>', "Candy machine account to mint for")
    .option('-k, --keypair <path>', 'Solana wallet')
    .option('-u, --url <url>', 'rpc url e.g. https://api.devnet.solana.com')
    .action(async (candyMachinePublicKeyString, options) => {
        const { keypair, url } = options;
        const candyMachinePublicKey = new anchor.web3.PublicKey(candyMachinePublicKeyString);
        const key = await fs.readFile(keypair, { encoding: 'utf-8' });

        const walletKey = anchor.web3.Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(key)),
        );

        const connection = new anchor.web3.Connection(url);
        const walletWrapper = new anchor.Wallet(walletKey);
        const provider = new anchor.Provider(connection, walletWrapper, {
            preflightCommitment: 'recent',
        });
        const candyV1Program = await loadCandyProgram(provider, candyMachineV1);

        const candyMachine : any = await candyV1Program.account.candyMachine.fetch(
            candyMachinePublicKey
        );

        if (!candyMachine.data.goLiveDate) {
            console.error(`Candy machine ${candyMachinePublicKeyString} does not have live date yet`);
            return;
        }

        const liveDateMillisecondTimestamp = candyMachine.data.goLiveDate.toNumber() * 1000;
        const liveDate = new Date(liveDateMillisecondTimestamp);
        console.log(`Candy machine live date: ${liveDate.toString()}`);
        let currentTimestamp = Date.now();
        const todayDate = new Date();
        console.log(`Today's date: ${todayDate.toString()}`);

        const itemsAvailable = candyMachine.data.itemsAvailable;
        console.log(`Items available: ${itemsAvailable}`);
        const itemsRedeemed = candyMachine.itemsRedeemed;
        console.log(`Items redeemed: ${itemsRedeemed}`);

        if (itemsRedeemed >= itemsAvailable) {
            console.log("All items have been redeemed");
            return;
        }

        const mint = anchor.web3.Keypair.generate();
        const metadata = await getMetadata(mint.publicKey);
        const masterEdition = await getMasterEdition(mint.publicKey);
        const config : anchor.web3.PublicKey = candyMachine.config;
        const token = await getTokenWallet(walletKey.publicKey, mint.publicKey);
        const mintNFT = async () : Promise<string> => {
            return await candyV1Program.rpc.mintNft({
                accounts: {
                    config: config,
                    candyMachine: candyMachinePublicKey,
                    payer: walletKey.publicKey,
                    //@ts-ignore
                    wallet: candyMachine.wallet,
                    mint: mint.publicKey,
                    metadata,
                    masterEdition,
                    mintAuthority: walletKey.publicKey,
                    updateAuthority: walletKey.publicKey,
                    tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                    clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
                },
                signers: [mint, walletKey],
                instructions: [
                    anchor.web3.SystemProgram.createAccount({
                        fromPubkey: walletKey.publicKey,
                        newAccountPubkey: mint.publicKey,
                        space: MintLayout.span,
                        lamports: await provider.connection.getMinimumBalanceForRentExemption(
                            MintLayout.span,
                        ),
                        programId: TOKEN_PROGRAM_ID,
                    }),
                    Token.createInitMintInstruction(
                        TOKEN_PROGRAM_ID,
                        mint.publicKey,
                        0,
                        walletKey.publicKey,
                        walletKey.publicKey,
                    ),
                    createAssociatedTokenAccountInstruction(
                        token,
                        walletKey.publicKey,
                        walletKey.publicKey,
                        mint.publicKey,
                    ),
                    Token.createMintToInstruction(
                        TOKEN_PROGRAM_ID,
                        mint.publicKey,
                        token,
                        walletKey.publicKey,
                        [],
                        1,
                    ),
                ],
            });
        }

        const fiveHundredMs = 500;
        const intervalId = setInterval(async () => {
            currentTimestamp = Date.now();
            const millisecondsUntilDrop = liveDateMillisecondTimestamp - currentTimestamp;
            console.log("Time until drop:", millisecondsUntilDrop / 60000, "minutes");
            if (currentTimestamp - fiveHundredMs >= liveDateMillisecondTimestamp) {
                console.log("Five ms until the drop");
                try {
                    const tx = await mintNFT();
                    console.log(`Success! Tx: ${tx}`);
                } catch (e) {
                    console.log(e);
                    console.log("Let's try again");
                }
            }
        }, 500);
    });

program.parse(process.argv);
