const wasm = require("../custom_modules/@emurgo/cardano-serialization-lib-nodejs/cardano_serialization_lib");
//import { languageViews } from "./LanguageViews.mjs";
const { BlockFrost } = require("../BlockFrost/blockFrost");
/* import CoinSelection from "./CoinSelection.mjs";
import * as dotenv from "dotenv";
import { prvKey } from "../Wallet/keys.mjs"; */
const serverAddress = require("../Keys/keys").address;
const prvKey = require("../Keys/keys").prvKey;
const languageViews = require("./LanguageViews");

module.exports.toHex = function (bytes) {
  return Buffer.from(bytes, "hex").toString("hex");
};
module.exports.fromHex = function (hex) {
  return Buffer.from(hex, "hex");
};

module.exports.asciiToHex = function (ascii) {
  return Buffer.from(ascii, "utf-8").toString("hex");
};

module.exports.HextoAscii = function (Hex) {
  return Buffer.from(Hex, "hex").toString("utf-8");
};

initTx = async function (protocolParameters) {
  const txBuilder = wasm.TransactionBuilder.new(
    wasm.LinearFee.new(
      wasm.BigNum.from_str(protocolParameters.linearFee.minFeeA),
      wasm.BigNum.from_str(protocolParameters.linearFee.minFeeB)
    ),
    wasm.BigNum.from_str(protocolParameters.minUtxo),
    wasm.BigNum.from_str(protocolParameters.poolDeposit),
    wasm.BigNum.from_str(protocolParameters.keyDeposit),
    protocolParameters.maxValSize,
    protocolParameters.maxTxSize,
    protocolParameters.priceMem,
    protocolParameters.priceStep,
    wasm.LanguageViews.new(Buffer.from(languageViews, "hex"))
  );

  return txBuilder;
};

module.exports.initTx = initTx;

const amountToValue = (assets) => {
  const multiAsset = wasm.MultiAsset.new();
  //console.log(assets);
  const lovelace = assets.find((asset) => asset.unit === "lovelace");
  const policies = [
    ...new Set(
      assets
        .filter((asset) => asset.unit !== "lovelace")
        .map((asset) => asset.unit.slice(0, 56))
    ),
  ];
  //console.log(policies);
  policies.forEach((policy) => {
    const policyAssets = assets.filter(
      (asset) => asset.unit.slice(0, 56) === policy
    );
    const assetsValue = wasm.Assets.new();
    policyAssets.forEach((asset) => {
      assetsValue.insert(
        wasm.AssetName.new(Buffer.from(asset.unit.slice(56), "hex")),
        wasm.BigNum.from_str(asset.quantity)
      );
    });
    multiAsset.insert(
      wasm.ScriptHash.from_bytes(Buffer.from(policy, "hex")),
      assetsValue
    );
  });
  const value = wasm.Value.new(
    wasm.BigNum.from_str(lovelace ? lovelace.quantity : "0")
  );
  if (assets.length > 1 || !lovelace) value.set_multiasset(multiAsset);
  return value;
};

module.exports.amountToValue = amountToValue;

getUtxos = async (addr) => {
  const response = await BlockFrost.addressesUtxos(addr);

  let utxos = [];

  response.forEach((element) => {
    const value = amountToValue(element.amount);

    const input = wasm.TransactionInput.new(
      wasm.TransactionHash.from_bytes(Buffer.from(element.tx_hash, "hex")),
      element.tx_index
    );

    const output = wasm.TransactionOutput.new(
      wasm.Address.from_bech32(addr),
      value
    );

    const utxo = wasm.TransactionUnspentOutput.new(input, output);
    utxos.push(utxo);
  });
  return utxos;
};

module.exports.sendAda = async function (address, lovelaces) {
  const protocolParameters = await getProtocolParams();

  const reciverAddress = wasm.Address.from_bech32(address);

  const txBuilder = await initTx(protocolParameters);
  const utxos = await getUtxos(serverAddress);
  const value = wasm.Value.new(wasm.BigNum.from_str(`${lovelaces}`));
  const outPut = wasm.TransactionOutput.new(reciverAddress, value);
  const outputs = wasm.TransactionOutputs.new();
  outputs.add(outPut);

  CoinSelection.setProtocolParameters(
    protocolParameters.minUtxo,
    protocolParameters.linearFee.minFeeA,
    protocolParameters.linearFee.minFeeB,
    protocolParameters.maxTxSize
  );
  const inputs = await CoinSelection.randomImprove(utxos, outputs);

  inputs.input.forEach((utxo) => {
    //console.log(utxo);
    const input = utxo.input();
    //console.log(input.address(), input, input.value());
    txBuilder.add_input(
      wasm.Address.from_bech32(serverAddress),
      input,
      utxo.output().amount()
    );
  });

  txBuilder.add_output(outPut);

  txBuilder.add_change_if_needed(wasm.Address.from_bech32(serverAddress));

  const txBody = txBuilder.build();

  const tx = wasm.Transaction.new(txBody, wasm.TransactionWitnessSet.new());

  try {
    const txHash = wasm.hash_transaction(tx.body());
    const witnesses = tx.witness_set();

    const vkeysWitnesses = wasm.Vkeywitnesses.new();
    const vkeyWitness = wasm.make_vkey_witness(txHash, prvKey);
    vkeysWitnesses.add(vkeyWitness);
    witnesses.set_vkeys(vkeysWitnesses);

    const transaction = wasm.Transaction.new(
      tx.body(),
      witnesses,
      tx.auxiliary_data() // transaction metadata
    );

    try {
      const CBORTx = Buffer.from(transaction.to_bytes(), "hex").toString("hex");
      const submitionHash = await BlockFrost.txSubmit(CBORTx);
      console.log(`tx Submited tiwh txHas ${submitionHash}`);
      return submitionHash;
    } catch (e) {
      console.log(e);
    }
  } catch (error) {
    console.log(error);
    return { error: error.info || error.toString() };
  }
};

module.exports.getUtxos = getUtxos;

module.exports.valueToAssets = (value) => {
  const assets = [];
  assets.push({ unit: "lovelace", quantity: value.coin().to_str() });
  if (value.multiasset()) {
    const multiAssets = value.multiasset().keys();
    for (let j = 0; j < multiAssets.len(); j++) {
      const policy = multiAssets.get(j);
      const policyAssets = value.multiasset().get(policy);
      const assetNames = policyAssets.keys();
      for (let k = 0; k < assetNames.len(); k++) {
        const policyAsset = assetNames.get(k);
        const quantity = policyAssets.get(policyAsset);
        const asset =
          Buffer.from(policy.to_bytes(), "hex").toString("hex") +
          Buffer.from(policyAsset.name(), "hex").toString("hex");
        assets.push({
          unit: asset,
          quantity: quantity.to_str(),
        });
      }
    }
  }
  return assets;
};

module.exports.sendAllTokens = async (address) => {
  const addressdetails = await BlockFrost.addresses(serverAddress);
  const Balance = addressdetails.amount;
  //console.log(Balance);
  const totalValue = amountToValue(Balance);
  const nonAdaTokens = totalValue.multiasset();
  const reciverAddress = wasm.Address.from_bech32(address);
  const protocolParameters = await getProtocolParams();

  const txBuilder = await initTx(protocolParameters);
  const utxos = await getUtxos(serverAddress);

  //let value = wasm.Value.new(wasm.BigNum.from_str("0"));
  utxos.forEach((utxo) => {
    //console.log(utxo);
    const input = utxo.input();
    //console.log(input.address(), input, input.value());
    txBuilder.add_input(
      wasm.Address.from_bech32(serverAddress),
      input,
      utxo.output().amount()
    );
  });

  const checkValue = wasm.Value.new(wasm.BigNum.from_str("0"));
  checkValue.set_multiasset(nonAdaTokens);
  const minADA = wasm.min_ada_required(
    checkValue,
    wasm.BigNum.from_str(protocolParameters.minUtxo)
  );

  const value = wasm.Value.new(minADA);
  value.set_multiasset(nonAdaTokens);
  wasm.TransactionOutput.new(reciverAddress, value);
  txBuilder.add_output(wasm.TransactionOutput.new(reciverAddress, value));
  txBuilder.add_change_if_needed(wasm.Address.from_bech32(serverAddress));

  const txBody = txBuilder.build();

  const tx = wasm.Transaction.new(txBody, wasm.TransactionWitnessSet.new());

  //console.log(inputs);
  try {
    const txHash = wasm.hash_transaction(tx.body());
    const witnesses = tx.witness_set();

    const vkeysWitnesses = wasm.Vkeywitnesses.new();
    const vkeyWitness = wasm.make_vkey_witness(txHash, prvKey);
    vkeysWitnesses.add(vkeyWitness);
    witnesses.set_vkeys(vkeysWitnesses);
    const transaction = wasm.Transaction.new(
      tx.body(),
      witnesses,
      tx.auxiliary_data() // transaction metadata
    );

    try {
      const CBORTx = Buffer.from(transaction.to_bytes(), "hex").toString("hex");
      const submitionHash = await BlockFrost.txSubmit(CBORTx);
      console.log(`tx Submited tiwh txHas ${submitionHash}`);
      return submitionHash;
    } catch (e) {
      console.log(e);
    }
  } catch (error) {
    console.log(error);
    return { error: error.info || error.toString() };
  }
};

module.exports.burnRoyality = async function (policy) {
  const protocolParameters = await getProtocolParams();
  const NFTAmount = [{ unit: policy, quantity: "1" }];
  let NFTValue = amountToValue(NFTAmount);
  NFTValue = NFTValue.checked_add(
    wasm.Value.new(wasm.BigNum.from_str("2000000"))
  );
  const ServerAddress = wasm.Address.from_bech32(ServerAddress);

  const txBuilder = await initTx(protocolParameters);
  const utxos = await getUtxos(ServerAddress);
  const outPut = wasm.TransactionOutput.new(ServerAddress, NFTValue);

  const outputs = wasm.TransactionOutputs.new();
  //console.log(outputs);
  outputs.add(outPut);

  CoinSelection.setProtocolParameters(
    protocolParameters.minUtxo,
    protocolParameters.linearFee.minFeeA,
    protocolParameters.linearFee.minFeeB,
    protocolParameters.maxTxSize
  );
  //console.log(outputs);
  const inputs = await CoinSelection.randomImprove(utxos, outputs);
  //console.log(inputs);
  // TODO: Continue here
  inputs.input.forEach((utxo) => {
    //console.log(utxo);
    const input = utxo.input();
    //console.log(input.address(), input, input.value());
    txBuilder.add_input(
      wasm.Address.from_bech32(ServerAddress),
      input,
      utxo.output().amount()
    );
  });
  txBuilder.add_output(outPut);
  txBuilder.add_change_if_needed(wasm.Address.from_bech32(ServerAddress));

  const txBody = txBuilder.build();

  const tx = wasm.Transaction.new(txBody, wasm.TransactionWitnessSet.new());

  //console.log(inputs);

  try {
    const txHash = wasm.hash_transaction(tx.body());
    const witnesses = tx.witness_set();

    const vkeysWitnesses = wasm.Vkeywitnesses.new();
    const vkeyWitness = wasm.make_vkey_witness(txHash, prvKey);
    vkeysWitnesses.add(vkeyWitness);
    witnesses.set_vkeys(vkeysWitnesses);
    const transaction = wasm.Transaction.new(
      tx.body(),
      witnesses,
      tx.auxiliary_data() // transaction metadata
    );

    try {
      const CBORTx = Buffer.from(transaction.to_bytes(), "hex").toString("hex");
      const submitionHash = await BlockFrost.txSubmit(CBORTx);
      console.log(`tx Submited tiwh txHas ${submitionHash}`);
      return submitionHash;
    } catch (e) {
      console.log(e);
    }
  } catch (error) {
    console.log(error);
    return { error: error.info || error.toString() };
  }
};

getProtocolParams = async () => {
  try {
    const latest_block = await BlockFrost.blocksLatest();
    const p = await BlockFrost.epochsParameters(latest_block.epoch);
    return {
      linearFee: {
        minFeeA: p.min_fee_a.toString(),
        minFeeB: p.min_fee_b.toString(),
      },
      minUtxo: "1000000", //p.min_utxo, minUTxOValue protocol paramter has been removed since Alonzo HF. Calulation of minADA works differently now, but 1 minADA still sufficient for now
      poolDeposit: p.pool_deposit,
      keyDeposit: p.key_deposit,
      coinsPerUtxoWord: "34482",
      maxValSize: 5000,
      priceMem: 5.77e-2,
      priceStep: 7.21e-5,
      maxTxSize: p.max_tx_size,
      slot: latest_block.slot,
    };
  } catch (e) {
    console.log(e);
  }
};

module.exports.getProtocolParams = getProtocolParams;

async function getWalletBalance(addr) {
  try {
    const Balance = await BlockFrost.addresses(addr);
    return Balance;
    //console.log(Balance);
  } catch (e) {
    console.log(e);
  }
}

module.exports.getWalletBalance = getWalletBalance;

async function submitTx(transaction) {
  try {
    const CBORTx = Buffer.from(transaction.to_bytes(), "hex").toString("hex");
    const submitionHash = await BlockFrost.txSubmit(CBORTx);
    console.log(`tx Submited tiwh txHas ${submitionHash}`);
    return submitionHash;
  } catch (e) {
    console.log(e);
  }
}

module.exports.submitTx = submitTx;

module.exports.sendAllTokens = async function (
  senderBech32,
  senderPrvKey,
  reciver
) {
  //we must provide sender prvKeyBech32 , and reciver addressBech32

  const shelleySenderAddress = wasm.Address.from_bech32(senderBech32);
  const shelleyReciverAddress = wasm.Address.from_bech32(reciver);
  const walletBalance = await getWalletBalance(senderBech32);

  const totalMultiAssets = walletBalance.amount.filter(
    (x) => x.unit !== "lovelace"
  );
  //console.log(totalMultiAssets);

  const value = await amountToValue(totalMultiAssets);

  const protocolParameters = await getProtocolParams();

  //console.log(protocolParameters.minUtxo);

  const minAda = wasm.min_ada_required(
    value,
    wasm.BigNum.from_str(protocolParameters.minUtxo)
  );

  value.set_coin(minAda);

  const outPut = wasm.TransactionOutput.new(shelleyReciverAddress, value);

  const outPuts = wasm.TransactionOutputs.new();
  outPuts.add(outPut);

  const txBuilder = await initTx(protocolParameters);

  const utxos = await getUtxos(senderBech32);

  const selection = utxos;
  selection.forEach((input) => {
    txBuilder.add_input(
      wasm.Address.from_bech32(reciver),
      input.input(),
      input.output().amount()
    );
  });

  txBuilder.add_output(outPut);

  txBuilder.set_ttl(protocolParameters.slot + 1000);

  txBuilder.add_change_if_needed(shelleySenderAddress);

  const tx = txBuilder.build();

  const txHash = wasm.hash_transaction(tx);
  const witnesses = wasm.TransactionWitnessSet.new();

  const vkeysWitnesses = wasm.Vkeywitnesses.new();
  const vkeyWitness = wasm.make_vkey_witness(txHash, senderPrvKey);
  vkeysWitnesses.add(vkeyWitness);
  witnesses.set_vkeys(vkeysWitnesses);
  const transaction = wasm.Transaction.new(tx, witnesses);

  await submitTx(transaction);
};
