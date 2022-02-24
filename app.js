const { prvKey, prvKey_2, address, address_2 } = require("./Cardano/Keys/keys");
const Mint = require("./Cardano/Mint");
const { sendAllTokens, getProtocolParams } = require("./Cardano/Utils/Utils");
const ttl = 48450322 + 20000000 + 40000008;
const fs = require("fs");
const path = require("path");
const {
  Assets,
} = require("./Cardano/custom_modules/@emurgo/cardano-serialization-lib-nodejs/cardano_serialization_lib");
//const { BlockFrost } = require("./Cardano/blockFrost");

/* TxConfirmed(); TODO: Implement confirmation

async function TxConfirmed(hash) {
  console.log(BlockFrost);
} */

function registerMint(hashAndBatch) {
  const logPath = path.join(__dirname, "/Minting.log.txt");
  fs.open(logPath, "a", 666, function (e, id) {
    fs.write(id, hashAndBatch + "\n", null, "utf8", function () {
      fs.close(id, function () {
        console.log("logFile is updated");
      });
    });
  });
}

function registerTotalAssets(data) {
  fs.writeFile("./totalAssets.txt", JSON.stringify(data), (err) => {
    if (err) {
      console.error(err);
      return;
    }
    //file written successfully
  });
}

function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}
const materialsURL = [
  [
    "charcoal",
    "QmRxLPC7YwHbWp5cMxRoU8JxvfHdwc9Lrv5o5tRu6yRgJx",
    "material-raw",
  ],
  [
    "gemstones",
    "QmZt9jpHEawzzJZkQ5gWntL3Fn74JPJLm85Ed7rEYuoM9H",
    "material-raw",
  ],
  [
    "goldcoin",
    "QmQrdCZsCQL1mBEEv9ZV9fANCzdicvwTL7TxxVG81mbrMK",
    "material-raw",
  ],
  [
    "ironore",
    "QmTdUD1TUpkjJQBj6DJmd9XaAJZy76z63rvteanrdhfFXY ",
    "material-raw",
  ],
  [
    "ironsands",
    "QmPhz8SS2kbWjUzw5imsZqVyxvd4MfoKctTHgsXcJ34u8Z",
    "material-raw",
  ],
  ["leather", "QmR8zcgemdKS96adBvkpzKNCfhZ9CfsyDyut7nuvUTo3WS", "material-raw"],
  ["oakwood", "Qmc6wzJAJZXneS1V5eUuir4wfFAbFxTJUZZBeuxZQ92jcW", "material-raw"],
  [
    "silvercoin",
    "QmaJJg732YyE6Eqq1vDZAqueKA2eEhpVFTFcNtLGEnni1Y",
    "material-raw",
  ],
];
const assetsToBeMinted = {
  charcoal: 700,
  gemstones: 2,
  goldcoin: 1,
  ironore: 150,
  ironsands: 100,
  oakwood: 25,
  leather: 20,
  silvercoin: 2,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const assetsGenerator = function (baseName) {
  const rawmetadataBuilder = function (src) {
    return {
      description: "An official NFT of the Metahagane-CNFT game.",
      type: "materialRaw",
      files: [
        {
          mediaType: "image/png",
          src: `ipfs://${src}`,
        },
      ],

      image: `ipfs://${src}`,
      mediaType: "image/png",
    };
  };

  //console.log(materialsURL);
  //console.log(rawmetadata);

  let assetsWithMetadata = [];
  for (let i = 1; i < assetsToBeMinted[baseName] + 1; i++) {
    const rawmetadata = rawmetadataBuilder(
      materialsURL.filter((x) => x[0] == baseName)[0][1]
    );
    //console.log(rawmetadata.files);
    let metadata = {};
    const name_ = `${baseName}${i}`;
    rawmetadata.name = `${
      baseName.charAt(0).toUpperCase() + baseName.slice(1)
    } #${i}`;

    const asset = { name: name_, quantity: "1" };
    metadata[name_] = rawmetadata;

    //console.log([asset, metadata]);
    assetsWithMetadata.push([asset, metadata]);
    /*  assetsWithMetadata = assetsWithMetadata.map((x) => {
      x[1][x[0].name].files = [x[1][x[0].name].files];
      return [x[0], x[1]];
    }); */
  }
  return assetsWithMetadata;
};

const assetGeneratorTest = function () {
  Object.entries(assetsToBeMinted).forEach((x) =>
    console.log(
      assetsGenerator(x[0])[assetsGenerator(x[0]).length - 1][1][
        assetsGenerator(x[0])[assetsGenerator(x[0]).length - 1][0].name
      ]
    )
  );
};
//assetGeneratorTest();
//console.log(assetsGenerator("gemstones")[0], assetsGenerator("gemstones")[0]);

let totalAssets = [];
Object.entries(assetsToBeMinted).forEach((x) => {
  const assets = assetsGenerator(x[0]);
  totalAssets = [...assets, ...totalAssets];
}); /* 
let randomSequence = [];
for (let i = 0; i < totalAssets.length; i++) {
  randomSequence = [i, ...randomSequence];
}
console.log(randomSequence[998]);
fs.writeFile(
  "./randomsequence.txt",
  JSON.stringify(shuffle(randomSequence)),
  (x) => console.log(x)
);*/

const totalNumberOfBatches = totalAssets.length / 25;
const randomSequence = JSON.parse(
  Buffer.from(
    fs.readFileSync("./randomsequence.txt", (e, data) => {}),
    "utf-8"
  ).toString()
);

let suffledAssets = [];

randomSequence.forEach((x) => suffledAssets.push(totalAssets[x]));
//console.log(suffledAssets);
async function MintBatch(i) {
  const metaDataBuilder = function () {
    const metadata = {};
    const helper = suffledAssets.map((x) => x[1]).slice(i * 25, (i + 1) * 25);
    helper.forEach(
      (help) =>
        (metadata[Object.entries(help)[0][0]] = Object.entries(help)[0][1])
    );
    return metadata;
  };
  const assets = {
    assets: suffledAssets.map((x) => x[0]).slice(i * 25, (i + 1) * 25),
    metadatas: metaDataBuilder(),
  };
  console.log(assets);
  try {
    const hash = await Mint(
      assets,
      ttl,
      "721",
      "addr_test1qpt5akr98022xddld4he0rf7s603f04uv5ammywkvrk9p5fwx27w0tclpgyvut0nzqmvyxu5dnuw03rx42rup8q4qaqq2l70ns",
      1600000 * 25
    );

    registerMint(`batch number ${i} has been donde with hash ${hash}`);

    await sleep(240000);
  } catch (e) {
    console.log(e);
    const error = `${e}`;
    registerMint(
      `there was the following error ${error} while minting the ${i}-batch`
    );
  }
}
async function MintAll() {
  for (let batch of [
    1, 3, 4, 5, 8, 9, 10, 13, 14, 15, 16, 18, 19, 22, 33, 34, 35, 36, 37, 38,
    39,
  ]) {
    await MintBatch(batch);
  }
}

//console.log(address_2);
/* sendAllTokens(
  address_2,
  prvKey_2,
  "addr_test1qpujcmmsumgj6xpyknwlh4ga8y0t3vg5jtsw09s8v5xwpdta9xq2u7rwnp0q43xh8qku3prjv2yk9ex80p7368034uxs9fcr36"
); */
/* try {
  MintAll();
} catch (e) {
  console.log(e);
} */

/* Mint(
  {
    assets: [{ name: `test`, quantity: "1" }],
    metadata: "testMetadata",
  },
  52968181 + 200000,
  "721",
  "addr_test1qpujcmmsumgj6xpyknwlh4ga8y0t3vg5jtsw09s8v5xwpdta9xq2u7rwnp0q43xh8qku3prjv2yk9ex80p7368034uxs9fcr36",
  20000000
); */

MintAll();
