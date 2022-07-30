const sha256 = require('sha256');
const uuid = require('uuid').v1;

function MinerNodeBlockchain() {
    this.chain = [];
    this.pendingTransactions = [];
    this.networkNodes = [];
    this.transactioners = [];
    this.minerNodes = [];
    this.reducedPendingTransactions = [];

};


MinerNodeBlockchain.prototype.createNewBlock = function(nonce, previousBlockHash, hash) {
    const newBlock = {
        index: this.chain.length + 1,
        timestamp: Date.now(),
        transactions: this.pendingTransactions,
        nonce: nonce,
        hash: hash,
        previousBlockHash: previousBlockHash 
    };

    this.pendingTransactions = [];
    this.chain.push(newBlock); 

    return newBlock;
};
 

MinerNodeBlockchain.prototype.getLastBlock = function() {
    return this.chain[this.chain.length - 1];
};


MinerNodeBlockchain.prototype.createNewTransaction = function(amount, sender, recipient, nodeUrl, transactionID) {

    const newTransaction = {
        amount: amount,
        sender: sender,
        recipient: recipient,
        nodeUrl: nodeUrl,
        transactionID: transactionID 
    };

    return newTransaction;
};


MinerNodeBlockchain.prototype.addTransactionToPendingTransactions = function(transactionObj) {

    this.pendingTransactions.push(transactionObj);
    return this.getLastBlock()['index'] + 1;
};


MinerNodeBlockchain.prototype.hashBlock = function(previousBlockHash, currentBlockData, nonce) {
    const dataAsString = previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
    const hash = sha256(dataAsString);
    return hash;
};


MinerNodeBlockchain.prototype.proofOfWork = function(previousBlockHash, currentBlockData) {
    let nonce = 0;
    let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
    while (hash.substring(0, 4) !== '0000') {
        nonce++;
        hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
    }

    return nonce;
};


module.exports = MinerNodeBlockchain;