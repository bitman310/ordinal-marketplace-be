import * as Bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import axios from "axios";
import {
  OPENAPI_UNISAT_URL,
  OPENAPI_UNISAT_TOKEN,
  SIGNATURE_SIZE,
  ADMIN_PAYMENT_ADDRESS,
} from "../config/config";
import { IUtxo } from "../types/types";

Bitcoin.initEccLib(ecc);
const network = Bitcoin.networks.testnet;

// Get Inscription UTXO
const getInscriptionWithUtxo = async (inscriptionId: string) => {
  try {
    const url = `${OPENAPI_UNISAT_URL}/v1/indexer/inscription/info/${inscriptionId}`;

    console.log("url api key =>", url, OPENAPI_UNISAT_TOKEN);
    const config = {
      headers: {
        Authorization: `Bearer ${OPENAPI_UNISAT_TOKEN}`,
      },
    };

    const res = await axios.get(url, config);

    if (res.data.code === -1) throw "Invalid inscription id";

    return {
      address: res.data.data.address,
      contentType: res.data.data.contentType,
      inscriptionId: inscriptionId,
      inscriptionNumber: res.data.data.inscriptionNumber,
      txid: res.data.data.utxo.txid,
      value: res.data.data.utxo.satoshi,
      vout: res.data.data.utxo.vout,
      scriptpubkey: res.data.data.utxo.scriptPk,
    };
  } catch (error) {
    console.log(
      `Ordinal api is not working now, please try again later Or invalid inscription id ${inscriptionId}`
    );
    throw "Invalid inscription id";
  }
};

// Get BTC UTXO
const getBtcUtxoByAddress = async (address: string) => {
  const url = `${OPENAPI_UNISAT_URL}/v1/indexer/address/${address}/utxo-data`;

  const config = {
    headers: {
      Authorization: `Bearer ${OPENAPI_UNISAT_TOKEN}`,
    },
  };

  let cursor = 0;
  const size = 5000;
  const utxos: IUtxo[] = [];

  while (1) {
    const res = await axios.get(url, { ...config, params: { cursor, size } });

    if (res.data.code === -1) throw "Invalid Address";

    utxos.push(
      ...(res.data.data.utxo as any[]).map((utxo) => {
        return {
          scriptpubkey: utxo.scriptPk,
          txid: utxo.txid,
          value: utxo.satoshi,
          vout: utxo.vout,
        };
      })
    );

    cursor += res.data.data.utxo.length;

    if (cursor === res.data.data.total) break;
  }

  return utxos;
};

// Get Current Network Fee
const getFeeRate = async () => {
  try {
    const url = `https://mempool.space/testnet/api/v1/fees/recommended`;

    const res = await axios.get(url);

    console.log("res.data ======================= ")
    console.log(res.data)

    return res.data.fastestFee;
  } catch (error) {
    console.log("Ordinal api is not working now. Try again later");
    return -1;
  }
};

// Calc Tx Fee
const calculateTxFee = (psbt: Bitcoin.Psbt, feeRate: number) => {
  const tx = new Bitcoin.Transaction();

  for (let i = 0; i < psbt.txInputs.length; i++) {
    const txInput = psbt.txInputs[i];
    tx.addInput(txInput.hash, txInput.index, txInput.sequence);
    tx.setWitness(i, [Buffer.alloc(SIGNATURE_SIZE)]);
  }

  for (let txOutput of psbt.txOutputs) {
    tx.addOutput(txOutput.script, txOutput.value);
  }
  tx.addOutput(psbt.txOutputs[0].script, psbt.txOutputs[0].value);
  tx.addOutput(psbt.txOutputs[0].script, psbt.txOutputs[0].value);

  console.log("virtualSize ++++++++++++++++ ==============", tx.virtualSize())

  return tx.virtualSize() * feeRate;
};

// export const generateOfferPSBT = async (
//   inscriptionId: string,
//   brcInscriptionId: string,
//   fee_brcInscriptionId: string,
//   buyerPubkey: string,
//   buyerAddress: string,
//   sellerPubkey: string,
//   sellerAddress: string
// ) => {
  
//   const sellerInscriptionsWithUtxo = await getInscriptionWithUtxo(
//     inscriptionId
//   );
//   const sellerScriptpubkey = Buffer.from(
//     sellerInscriptionsWithUtxo.scriptpubkey,
//     "hex"
//   );
//   const buyerInscriptionWithUtxo = await getInscriptionWithUtxo(
//     brcInscriptionId
//   );
//   const buyerScriptpubkey = Buffer.from(
//     buyerInscriptionWithUtxo.scriptpubkey,
//     "hex"
//   );
//   const fee_buyerInscriptionWithUtxo = await getInscriptionWithUtxo(
//     fee_brcInscriptionId
//   );
//   const fee_buyerScriptpubkey = Buffer.from(
//     fee_buyerInscriptionWithUtxo.scriptpubkey,
//     "hex"
//   );

//   const psbt = new Bitcoin.Psbt({ network: network });
//   console.log("Create psbt", psbt);
//   // Add Inscription Input
//   psbt.addInput({
//     hash: sellerInscriptionsWithUtxo.txid,
//     index: sellerInscriptionsWithUtxo.vout,
//     witnessUtxo: {
//       value: sellerInscriptionsWithUtxo.value,
//       script: sellerScriptpubkey,
//     },
//     tapInternalKey: Buffer.from(sellerPubkey, "hex").slice(1, 33),
//   });

//   console.log("Input 1", psbt);

//   psbt.addInput({
//     hash: buyerInscriptionWithUtxo.txid,
//     index: buyerInscriptionWithUtxo.vout,
//     witnessUtxo: {
//       value: buyerInscriptionWithUtxo.value,
//       script: buyerScriptpubkey,
//     },
//     tapInternalKey: Buffer.from(buyerPubkey, "hex").slice(1, 33),
//   });

//   console.log("Input 2", psbt);

//   psbt.addInput({
//     hash: fee_buyerInscriptionWithUtxo.txid,
//     index: fee_buyerInscriptionWithUtxo.vout,
//     witnessUtxo: {
//       value: fee_buyerInscriptionWithUtxo.value,
//       script: fee_buyerScriptpubkey,
//     },
//     tapInternalKey: Buffer.from(buyerPubkey, "hex").slice(1, 33),
//   });

//   console.log("Input 3", psbt);

//   psbt.addOutput({
//     address: buyerAddress,
//     value: sellerInscriptionsWithUtxo.value,
//   });

//   console.log("Output 1", psbt);

//   psbt.addOutput({
//     address: sellerAddress,
//     value: buyerInscriptionWithUtxo.value,
//   });

//   console.log("Output 2", psbt);


//   psbt.addOutput({
//     address: ADMIN_PAYMENT_ADDRESS,
//     value: fee_buyerInscriptionWithUtxo.value,
//   });

//   console.log("Output 3", psbt);


//   const btcUtxos = await getBtcUtxoByAddress(sellerAddress as string);
//   const feeRate = await getFeeRate();
//   let amount = 0;

//   for (const utxo of btcUtxos) {
//     const fee = calculateTxFee(psbt, feeRate);

//     if (amount < fee && utxo.value > 10000) {
//       amount += utxo.value;

//       psbt.addInput({
//         hash: utxo.txid,
//         index: utxo.vout,
//         witnessUtxo: {
//           value: utxo.value,
//           script: Buffer.from(utxo.scriptpubkey as string, "hex"),
//         },
//         tapInternalKey: Buffer.from(sellerPubkey, "hex").slice(1, 33),
//         sighashType: Bitcoin.Transaction.SIGHASH_ALL,
//       });
//       console.log("Input fee", psbt);

//     }
//   }

//   const fee = calculateTxFee(psbt, feeRate);

//   console.log("Input fee",fee, feeRate);

//   if (amount < fee)
//     throw "You do not have enough bitcoin in your wallet";

//   psbt.addOutput({
//     address: sellerAddress as string,
//     value: amount - fee,
//   });

//   console.log("Input fee", psbt);

//   return psbt;
// };

export const generateOfferPSBT = async (
  inscriptionId: string,
  offerValue: any,
  marketplaceFee: any,
  buyerPubkey: string,
  buyerAddress: string,
  sellerPubkey: string,
  sellerAddress: string
) => {
  
  const sellerInscriptionsWithUtxo = await getInscriptionWithUtxo(
    inscriptionId
  );
  const sellerScriptpubkey = Buffer.from(
    sellerInscriptionsWithUtxo.scriptpubkey,
    "hex"
  );

  const psbt = new Bitcoin.Psbt({ network: network });
  console.log("Create psbt", psbt);
  // Add Inscription Input
  psbt.addInput({
    hash: sellerInscriptionsWithUtxo.txid,
    index: sellerInscriptionsWithUtxo.vout,
    witnessUtxo: {
      value: sellerInscriptionsWithUtxo.value,
      script: sellerScriptpubkey,
    },
    tapInternalKey: Buffer.from(sellerPubkey, "hex").slice(1, 33),
  });

  console.log("Input 1", psbt.data.inputs);

  psbt.addOutput({
    address: buyerAddress,
    value: sellerInscriptionsWithUtxo.value,
  });

  console.log("Output 1", psbt);

  let realOfferValue = Math.round(offerValue * 10 ** 8);

  let offerSatoshi = parseInt(Math.round((realOfferValue * (100 - marketplaceFee)) / 100).toString());
  console.log("offerSatoshi", offerSatoshi);

  psbt.addOutput({
    address: sellerAddress,
    value: offerSatoshi,
  });

  console.log("Output 2", psbt);

  console.log("realOfferValue", realOfferValue);
  console.log("marketplaceFee", marketplaceFee);
  let feeSatoshi = parseInt(Math.round((realOfferValue * marketplaceFee) / 100).toString());
  console.log("feeSatoshi", feeSatoshi);

  console.log("address ===========", ADMIN_PAYMENT_ADDRESS);
  console.log("value ===========", feeSatoshi);

  psbt.addOutput({
    address: ADMIN_PAYMENT_ADDRESS,
    value: feeSatoshi,
  });

  console.log("Output 3", psbt.data.outputs[0]);

  const buyerBtcUtxos = await getBtcUtxoByAddress(buyerAddress as string);
  let buyerAmount = 0;
  for (const butxo of buyerBtcUtxos) {

    if (buyerAmount < realOfferValue ) {
      buyerAmount += butxo.value;

      psbt.addInput({
        hash: butxo.txid,
        index: butxo.vout,
        witnessUtxo: {
          value: butxo.value,
          script: Buffer.from(butxo.scriptpubkey as string, "hex"),
        },
        tapInternalKey: Buffer.from(buyerPubkey, "hex").slice(1, 33),
        sighashType: Bitcoin.Transaction.SIGHASH_ALL,
      });
      console.log("Input offerValue", psbt);

    }
  }

  const sellerBtcUtxos = await getBtcUtxoByAddress(sellerAddress as string);
  const feeRate = await getFeeRate();
  let sellerAmount = 0;

  // for (const utxo of sellerBtcUtxos) {
  //   const fee = calculateTxFee(psbt, feeRate);

  //   if (sellerAmount < fee && utxo.value > 10000) {
  //     sellerAmount += utxo.value;

  //     psbt.addInput({
  //       hash: utxo.txid,
  //       index: utxo.vout,
  //       witnessUtxo: {
  //         value: utxo.value,
  //         script: Buffer.from(utxo.scriptpubkey as string, "hex"),
  //       },
  //       tapInternalKey: Buffer.from(sellerPubkey, "hex").slice(1, 33),
  //       sighashType: Bitcoin.Transaction.SIGHASH_ALL,
  //     });
  //     console.log("Input fee", psbt);

  //   }
  // }

  const fee = calculateTxFee(psbt, feeRate);

  console.log("Input fee", fee, feeRate);
  console.log("sellerAmount ==================", sellerAmount);

  if (buyerAmount < fee)
    throw "You do not have enough bitcoin in your wallet";

  psbt.addOutput({
    address: buyerAddress as string,
    value: buyerAmount - fee,
  });

  console.log("psbt====================", psbt);

  return psbt;
};

const postData = async (
  url: string,
  json: any,
  content_type = "text/plain",
  apikey = ""
): Promise<string | undefined> => {
  try {
    const headers: any = {};
    if (content_type) headers["Content-Type"] = content_type;
    if (apikey) headers["X-Api-Key"] = apikey;
    const res = await axios.post(url, json, {
      headers,
    });
    return res.data as string;
  } catch (err: any) {
    console.log('Push Transaction Error')
    console.log(err.response.data)
  }
}

export const combinePsbt = async (
  hexedPsbt: string,
  signedHexedPsbt1: string,
  signedHexedPsbt2?: string
) => {
  try {
    const psbt = Bitcoin.Psbt.fromHex(hexedPsbt);
    const signedPsbt1 = Bitcoin.Psbt.fromHex(signedHexedPsbt1);
    
    if (signedHexedPsbt2) {
      const signedPsbt2 = Bitcoin.Psbt.fromHex(signedHexedPsbt2);

      psbt.combine(signedPsbt1, signedPsbt2);
    } else {
      psbt.combine(signedPsbt1);
    }

    const tx = psbt.extractTransaction(true);

    console.log("Make TX===================");

    // psbt.setMaximumFeeRate(5000);

    const txHex = tx.toHex();
    console.log(txHex);

    const txId = await pushRawTx(txHex);

    return txId;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const pushRawTx = async (rawTx: string) => {
  const txid = await postData(
    `https://mempool.space/testnet/api/tx`,
    rawTx
  );
  console.log("pushed txid", txid);
  return txid;
};
