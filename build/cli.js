#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAssociatedTokenAccountInstruction = exports.fromUTF8Array = exports.CONFIG_LINE_SIZE = exports.CONFIG_LINE_SIZE_V2 = exports.MAX_CREATOR_LIMIT = exports.MAX_CREATOR_LEN = exports.MAX_SYMBOL_LENGTH = exports.MAX_URI_LENGTH = exports.MAX_NAME_LENGTH = void 0;
const commander_1 = require("commander");
const anchor = __importStar(require("@project-serum/anchor"));
const promises_1 = __importDefault(require("fs/promises"));
const spl_token_1 = require("@solana/spl-token");
const web3_js_1 = require("@solana/web3.js");
commander_1.program.version("0.1.0");
const candyMachineV1 = new web3_js_1.PublicKey('cndyAnrLdpjq1Ssp1z8xxDsB8dxe7u4HL5Nxi2K5WXZ');
const candyMachineV2 = new web3_js_1.PublicKey('cndy3Z4yapfJBmL3ShUp5exZKqR3z33thTzeNMm2gRZ');
const TOKEN_METADATA_PROGRAM_ID = new web3_js_1.PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
exports.MAX_NAME_LENGTH = 32;
exports.MAX_URI_LENGTH = 200;
exports.MAX_SYMBOL_LENGTH = 10;
exports.MAX_CREATOR_LEN = 32 + 1 + 1;
exports.MAX_CREATOR_LIMIT = 5;
const CONFIG_ARRAY_START = 32 + // authority
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
const CONFIG_ARRAY_START_V2 = 8 + // key
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
    exports.MAX_SYMBOL_LENGTH + // u32 len + symbol
    2 + // seller fee basis points
    4 +
    exports.MAX_CREATOR_LIMIT * exports.MAX_CREATOR_LEN + // optional + u32 len + actual vec
    8 + //max supply
    1 + // is mutable
    1 + // retain authority
    1 + // option for hidden setting
    4 +
    exports.MAX_NAME_LENGTH + // name length,
    4 +
    exports.MAX_URI_LENGTH + // uri length,
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
exports.CONFIG_LINE_SIZE_V2 = 4 + 32 + 4 + 200;
exports.CONFIG_LINE_SIZE = 4 + 32 + 4 + 200;
function formatSOL(amount) {
    return `${(amount / web3_js_1.LAMPORTS_PER_SOL).toFixed(2)} SOL`;
}
function unpackConfigItemV1(i, data) {
    const thisSlice = data.slice(CONFIG_ARRAY_START + 4 + exports.CONFIG_LINE_SIZE * i, CONFIG_ARRAY_START + 4 + exports.CONFIG_LINE_SIZE * (i + 1));
    const name = fromUTF8Array([...thisSlice.slice(4, 36)]);
    const uri = fromUTF8Array([...thisSlice.slice(40, 240)]);
    return [
        name.replace(/\u0000/g, ''),
        uri.replace(/\u0000/g, ''),
    ];
}
function unpackConfigItemV2(i, data) {
    const thisSlice = data.slice(CONFIG_ARRAY_START_V2 + 4 + exports.CONFIG_LINE_SIZE_V2 * i, CONFIG_ARRAY_START_V2 + 4 + exports.CONFIG_LINE_SIZE_V2 * (i + 1));
    const name = fromUTF8Array([...thisSlice.slice(2, 34)]);
    const uri = fromUTF8Array([...thisSlice.slice(40, 240)]);
    return [
        name.replace(/\u0000/g, ''),
        uri.replace(/\u0000/g, ''),
    ];
}
function fromUTF8Array(data) {
    // array of bytes
    let str = '', i;
    for (i = 0; i < data.length; i++) {
        const value = data[i];
        if (value < 0x80) {
            str += String.fromCharCode(value);
        }
        else if (value > 0xbf && value < 0xe0) {
            str += String.fromCharCode(((value & 0x1f) << 6) | (data[i + 1] & 0x3f));
            i += 1;
        }
        else if (value > 0xdf && value < 0xf0) {
            str += String.fromCharCode(((value & 0x0f) << 12) |
                ((data[i + 1] & 0x3f) << 6) |
                (data[i + 2] & 0x3f));
            i += 2;
        }
        else {
            // surrogate pair
            const charCode = (((value & 0x07) << 18) |
                ((data[i + 1] & 0x3f) << 12) |
                ((data[i + 2] & 0x3f) << 6) |
                (data[i + 3] & 0x3f)) -
                0x010000;
            str += String.fromCharCode((charCode >> 10) | 0xd800, (charCode & 0x03ff) | 0xdc00);
            i += 3;
        }
    }
    return str;
}
exports.fromUTF8Array = fromUTF8Array;
const getTokenWallet = function (wallet, mint) {
    return __awaiter(this, void 0, void 0, function* () {
        return (yield web3_js_1.PublicKey.findProgramAddress([wallet.toBuffer(), spl_token_1.TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()], spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID))[0];
    });
};
const getMetadata = (mint) => __awaiter(void 0, void 0, void 0, function* () {
    return (yield anchor.web3.PublicKey.findProgramAddress([
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
    ], TOKEN_METADATA_PROGRAM_ID))[0];
});
const getMasterEdition = (mint) => __awaiter(void 0, void 0, void 0, function* () {
    return (yield anchor.web3.PublicKey.findProgramAddress([
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
        Buffer.from('edition'),
    ], TOKEN_METADATA_PROGRAM_ID))[0];
});
function createAssociatedTokenAccountInstruction(associatedTokenAddress, payer, walletAddress, splTokenMintAddress) {
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
            pubkey: web3_js_1.SystemProgram.programId,
            isSigner: false,
            isWritable: false,
        },
        {
            pubkey: spl_token_1.TOKEN_PROGRAM_ID,
            isSigner: false,
            isWritable: false,
        },
        {
            pubkey: web3_js_1.SYSVAR_RENT_PUBKEY,
            isSigner: false,
            isWritable: false,
        },
    ];
    return new web3_js_1.TransactionInstruction({
        keys,
        programId: spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID,
        data: Buffer.from([]),
    });
}
exports.createAssociatedTokenAccountInstruction = createAssociatedTokenAccountInstruction;
function loadCandyProgram(provider, programId) {
    return __awaiter(this, void 0, void 0, function* () {
        const idl = yield anchor.Program.fetchIdl(programId, provider);
        if (!idl) {
            throw new Error(`Failed to fetch IDL for ${programId.toString()}!`);
        }
        const program = new anchor.Program(idl, programId, provider);
        return program;
    });
}
function searchCandyMachine(programId, keypair, connection, walletWrapper, provider, pattern, candyVersion) {
    return __awaiter(this, void 0, void 0, function* () {
        const candyProgram = yield loadCandyProgram(provider, programId);
        const candyMachines = yield candyProgram.account.candyMachine.all();
        const configPublicKeys = candyMachines.map(candyMachine => { var _a; return ((_a = candyMachine === null || candyMachine === void 0 ? void 0 : candyMachine.account) === null || _a === void 0 ? void 0 : _a.config) ? candyMachine.account.config : candyMachine.publicKey; });
        let configBuffers = [];
        let configsFetched = 0;
        const chunkSize = 99;
        console.log(`Found ${configPublicKeys.length} V${candyVersion} candy machines...`);
        while (configsFetched < configPublicKeys.length) {
            console.log(`Fetching configs ${configsFetched} through ${configsFetched + chunkSize}`);
            const accountsToFetch = configPublicKeys.slice(configsFetched, configsFetched + chunkSize);
            while (true) {
                try {
                    const nextConfigBuggers = yield connection.getMultipleAccountsInfo(accountsToFetch);
                    configsFetched += chunkSize;
                    for (const config of nextConfigBuggers) {
                        if (config === null || config === void 0 ? void 0 : config.data) {
                            configBuffers.push(config.data);
                        }
                    }
                    break;
                }
                catch (err) {
                    console.log(err.toString());
                    continue;
                }
            }
        }
        const configMap = configBuffers.reduce((map, data) => {
            try {
                const field = candyVersion === 1
                    ? 'Config'
                    : 'CandyMachine';
                const config = candyProgram.coder.accounts.decode(field, data);
                const existing = map.get(`${config.authority.toString()}-${config.data.uuid}`);
                if (existing) {
                    console.log('Duplicate candy machine!');
                    return map;
                }
                map.set(`${config.authority.toString()}-${config.data.uuid}`, data);
            }
            catch (err) {
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
            let obj;
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
                    const loadedCandyMachine = yield candyProgram.account.candyMachine.fetch(candyMachine.publicKey);
                    obj.candyConfig = loadedCandyMachine.authority.toString();
                    obj.match = true;
                    obj.treasury = loadedCandyMachine.wallet.toString();
                    obj.gatekeeper = loadedCandyMachine.data.gatekeeper !== null;
                    if (price <= 0.01 * web3_js_1.LAMPORTS_PER_SOL && date.valueOf() < new Date().valueOf() && !obj.gatekeeper) {
                        const env = `\nREACT_APP_CANDY_MACHINE_CONFIG=${obj.candyConfig}\n` +
                            `REACT_APP_CANDY_MACHINE_ID=${obj.candyAddress}\n` +
                            `REACT_APP_TREASURY_ADDRESS=${obj.treasury}\n` +
                            `REACT_APP_SOLANA_NETWORK=mainnet-beta\n` +
                            `REACT_APP_SOLANA_RPC_HOST=https://spring-crimson-shape.solana-mainnet.quiknode.pro/101d753db4b4b167756067e5dbeabb4fad28adb3/\n`;
                        console.log(env);
                    }
                    break;
                }
                else {
                    obj.match = false;
                }
            }
            data.push(obj);
        }
        return {
            data,
            count: candyMachines.length,
        };
    });
}
commander_1.program.command("search")
    .argument('<pattern>', "The pattern used to identify candy machine configs")
    .option('-k, --keypair <path>', 'Solana wallet')
    .option('-u, --url <url>', 'rpc url e.g. https://api.devnet.solana.com', 'https://spring-crimson-shape.solana-mainnet.quiknode.pro/101d753db4b4b167756067e5dbeabb4fad28adb3/')
    .option('--no-v1', 'Exclude v1 candy machines', false)
    .option('--no-v2', 'Exclude v2 candy machines', false)
    .action((pattern, options) => __awaiter(void 0, void 0, void 0, function* () {
    const { keypair, url, v1, v2 } = options;
    const key = yield promises_1.default.readFile(keypair, { encoding: 'utf-8' });
    const walletKey = anchor.web3.Keypair.fromSecretKey(new Uint8Array(JSON.parse(key)));
    const walletWrapper = new anchor.Wallet(walletKey);
    const connection = new anchor.web3.Connection(url);
    const provider = new anchor.Provider(connection, walletWrapper, {
        preflightCommitment: 'recent',
    });
    let v1Machines = {
        count: 0,
        data: [],
    };
    let v2Machines = {
        count: 0,
        data: [],
    };
    if (v1) {
        v1Machines = yield searchCandyMachine(candyMachineV1, keypair, connection, walletWrapper, provider, pattern, 1);
    }
    if (v2) {
        v2Machines = yield searchCandyMachine(candyMachineV2, keypair, connection, walletWrapper, provider, pattern, 2);
    }
    const sorted = yield v1Machines.data.concat(v2Machines.data).sort(sortData);
    yield promises_1.default.writeFile('machines.json', JSON.stringify(sorted, null, 4), { encoding: 'utf8' });
}));
function sortData(a, b) {
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
commander_1.program.command("wen")
    .argument('<candy-machine>', "Candy machine account to fetch")
    .option('-k, --keypair <path>', 'Solana wallet')
    .option('-u, --url <url>', 'rpc url e.g. https://api.devnet.solana.com')
    .action((candyMachinePublicKeyString, options) => __awaiter(void 0, void 0, void 0, function* () {
    const { keypair, url } = options;
    const candyMachinePublicKey = new anchor.web3.PublicKey(candyMachinePublicKeyString);
    const key = yield promises_1.default.readFile(keypair, { encoding: 'utf-8' });
    const walletKey = anchor.web3.Keypair.fromSecretKey(new Uint8Array(JSON.parse(key)));
    const connection = new anchor.web3.Connection(url);
    const walletWrapper = new anchor.Wallet(walletKey);
    const provider = new anchor.Provider(connection, walletWrapper, {
        preflightCommitment: 'recent',
    });
    const candyV1Program = yield loadCandyProgram(provider, candyMachineV1);
    const candyMachine = yield candyV1Program.account.candyMachine.fetch(candyMachinePublicKey);
    if (candyMachine) {
        if (candyMachine.data.goLiveDate) {
            const date = new Date(candyMachine.data.goLiveDate.toNumber() * 1000);
            console.log(date.toString());
        }
        else {
            console.log(`Candy machine ${candyMachinePublicKeyString} does noot have live date`);
        }
    }
    else {
        console.error(`Candy machine ${candyMachinePublicKeyString} doesn't exist`);
    }
}));
commander_1.program.command("mint")
    .argument('<candy-machine>', "Candy machine account to mint for")
    .option('-k, --keypair <path>', 'Solana wallet')
    .option('-u, --url <url>', 'rpc url e.g. https://api.devnet.solana.com')
    .action((candyMachinePublicKeyString, options) => __awaiter(void 0, void 0, void 0, function* () {
    const { keypair, url } = options;
    const candyMachinePublicKey = new anchor.web3.PublicKey(candyMachinePublicKeyString);
    const key = yield promises_1.default.readFile(keypair, { encoding: 'utf-8' });
    const walletKey = anchor.web3.Keypair.fromSecretKey(new Uint8Array(JSON.parse(key)));
    const connection = new anchor.web3.Connection(url);
    const walletWrapper = new anchor.Wallet(walletKey);
    const provider = new anchor.Provider(connection, walletWrapper, {
        preflightCommitment: 'recent',
    });
    const candyV1Program = yield loadCandyProgram(provider, candyMachineV1);
    const candyMachine = yield candyV1Program.account.candyMachine.fetch(candyMachinePublicKey);
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
    const metadata = yield getMetadata(mint.publicKey);
    const masterEdition = yield getMasterEdition(mint.publicKey);
    const config = candyMachine.config;
    const token = yield getTokenWallet(walletKey.publicKey, mint.publicKey);
    const mintNFT = () => __awaiter(void 0, void 0, void 0, function* () {
        return yield candyV1Program.rpc.mintNft({
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
                tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
                systemProgram: web3_js_1.SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            },
            signers: [mint, walletKey],
            instructions: [
                anchor.web3.SystemProgram.createAccount({
                    fromPubkey: walletKey.publicKey,
                    newAccountPubkey: mint.publicKey,
                    space: spl_token_1.MintLayout.span,
                    lamports: yield provider.connection.getMinimumBalanceForRentExemption(spl_token_1.MintLayout.span),
                    programId: spl_token_1.TOKEN_PROGRAM_ID,
                }),
                spl_token_1.Token.createInitMintInstruction(spl_token_1.TOKEN_PROGRAM_ID, mint.publicKey, 0, walletKey.publicKey, walletKey.publicKey),
                createAssociatedTokenAccountInstruction(token, walletKey.publicKey, walletKey.publicKey, mint.publicKey),
                spl_token_1.Token.createMintToInstruction(spl_token_1.TOKEN_PROGRAM_ID, mint.publicKey, token, walletKey.publicKey, [], 1),
            ],
        });
    });
    const fiveHundredMs = 500;
    const intervalId = setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
        currentTimestamp = Date.now();
        const millisecondsUntilDrop = liveDateMillisecondTimestamp - currentTimestamp;
        console.log("Time until drop:", millisecondsUntilDrop / 60000, "minutes");
        if (currentTimestamp - fiveHundredMs >= liveDateMillisecondTimestamp) {
            console.log("Five ms until the drop");
            try {
                const tx = yield mintNFT();
                console.log(`Success! Tx: ${tx}`);
            }
            catch (e) {
                console.log(e);
                console.log("Let's try again");
            }
        }
    }), 500);
}));
commander_1.program.parse(process.argv);
