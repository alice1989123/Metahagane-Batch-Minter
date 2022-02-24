const MintStone = require("./stone").MintAll;
const sendNFTsToMultiple = require("./Cardano/sendNFTs").sendNFTsToMultiple;
const mintRoyality = require("./Cardano/Mint").mintRoyality;
const burnRoyality = require("./Cardano/Mint").burnRoyality;
const MintJade = require("./jade").mintJade;
const registerMint = require("./Cardano/Utils/Utils").registerMint;
const sleep = require("./Cardano/Utils/Utils").sleep;

const ttl = 50864925 + 4000000;

async function royalities() {
  let royalitMintHash = await mintRoyality(
    ttl,
    0.1,
    "addr1q88604np2z4hkl9a78dhuxasnssrxzk5kz497yvw4wq7jjp7vt8s8tygau8fl40vg3t7gxdzkq7uxl8sqmaqqkdxca0sg9yp73"
  );

  await registerMint(`The mint of the Royality had hash ${royalitMintHash} `);
  await sleep(32000);
  const royalityBurnhash = await burnRoyality(ttl);
  await registerMint(`The burn of the Royality had hash ${royalitMintHash} `);
}
//royalities();

//burnRoyality(ttl);

MintJade();

//MintAll(Array.from(Array(15).keys()), 50864925 + 4000000, 1.6 * 25);
//sendNFTsToMultiple()
