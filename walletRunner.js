const { prvKey, prvKey_2, address, address_2 } = require("./Cardano/Keys/keys");
const Mint = require("./Cardano/Mint");
const { sendAllTokens, getProtocolParams } = require("./Cardano/Utils/Utils");
const ttl = 48450322 + 20000000 + 40000008;
const fs = require("fs");
const path = require("path");
const {
  Assets,
} = require("./Cardano/custom_modules/@emurgo/cardano-serialization-lib-nodejs/cardano_serialization_lib");

//console.log(address);
/* sendAllTokens(
  address,
  prvKey,
  "addr_test1qpujcmmsumgj6xpyknwlh4ga8y0t3vg5jtsw09s8v5xwpdta9xq2u7rwnp0q43xh8qku3prjv2yk9ex80p7368034uxs9fcr36"
); */ // senderBech32,    senderPrvKey,     reciverBech32
