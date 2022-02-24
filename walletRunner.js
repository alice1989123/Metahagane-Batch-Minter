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
sendAllTokens(
  address,
  prvKey,
  "addr_test1qpt5akr98022xddld4he0rf7s603f04uv5ammywkvrk9p5fwx27w0tclpgyvut0nzqmvyxu5dnuw03rx42rup8q4qaqq2l70ns"
); // senderBech32,    senderPrvKey,     reciverBech32
