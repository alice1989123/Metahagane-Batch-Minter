const wasm = require("../custom_modules/@emurgo/cardano-serialization-lib-nodejs/cardano_serialization_lib");
const dotenv = require("dotenv").config();

const walletKey = process.env.WALLET_KEY;
const walletKey_2 = process.env.WALLET_KEY_2;
const network = process.env.TESTNET
  ? wasm.NetworkInfo.testnet().network_id()
  : wasm.NetworkInfo.mainnet().network_id();

function getAddressPrvKeys(ed25519_bip32) {
  function harden(num) {
    return 0x80000000 + num;
  }
  /* const walletKey = wasm.Bip32PrivateKey.generate_ed25519_bip32().to_bech32();
console.log(walletKey); */

  const rootKey = wasm.Bip32PrivateKey.from_bech32(ed25519_bip32);
  const accountKey = rootKey
    .derive(harden(1852)) // purpose
    .derive(harden(1815)) // coin type
    .derive(harden(0)); // account #0

  const utxoPubKey = accountKey
    .derive(0) // external
    .derive(0)
    .to_public();

  const stakeKey = accountKey
    .derive(2) // chimeric
    .derive(0)
    .to_public();

  const baseAddr = wasm.BaseAddress.new(
    network,
    wasm.StakeCredential.from_keyhash(utxoPubKey.to_raw_key().hash()),
    wasm.StakeCredential.from_keyhash(stakeKey.to_raw_key().hash())
  );

  const prvKey = accountKey
    .derive(0) // external
    .derive(0)
    .to_raw_key();

  const address = baseAddr.to_address().to_bech32();

  return [address, prvKey];
}

module.exports.prvKey = getAddressPrvKeys(walletKey)[1];
module.exports.address = getAddressPrvKeys(walletKey)[0];
module.exports.prvKey_2 = getAddressPrvKeys(walletKey_2)[1];
module.exports.address_2 = getAddressPrvKeys(walletKey_2)[0];

//console.log(getAddressPrvKeys(walletKey)[0], getAddressPrvKeys(walletKey_2)[0]);
