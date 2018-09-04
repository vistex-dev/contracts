const EthereumTx = require('ethereumjs-tx');

/*
 * Call a smart contract function from any keyset in which the caller has the
 *     private and public keys.
 * @param {string} senderPublicKey Public key in key pair.
 * @param {string} senderPrivateKey Private key in key pair.
 * @param {string} contractAddress Address of Solidity contract.
 * @param {string} data Data from the function's `getData` in web3.js.
 * @param {number} value Number of Ethereum wei sent in the transaction.
 * @return {Promise}
 */
function rawTransaction(
    senderPublicKey,
    senderPrivateKey,
    contractAddress,
    data,
    value
  ) {
    return new Promise((resolve, reject) => {
  
      const key = new Buffer(senderPrivateKey, 'hex');
      const nonce = web3.toHex(web3.eth.getTransactionCount(senderPublicKey));
  
      const gasPrice = web3.toHex(web3.eth.estimateGas({
        from: contractAddress
      }));
      const gasLimit = web3.toHex(5500000);
  
      const rawTx = {
          nonce,
          gasPrice,
          gasLimit,
          data,
          to: contractAddress,
          value: web3.toHex(value)
      };
  
      let tx = new EthereumTx(rawTx);
      tx.sign(key);
  
      const stx = '0x' + tx.serialize().toString('hex');
  
      web3.eth.sendRawTransaction(stx, (err, hash) => {
        if (err) {
          reject(err);
        } else {
          resolve(hash);
        }
      });
  
    });
  }

module.exports = {
  rawTransaction
};