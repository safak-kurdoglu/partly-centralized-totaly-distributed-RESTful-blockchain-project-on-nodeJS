const sha256 = require('sha256');
const uuid = require('uuid').v1;

function TransactionNodeBlockchain() {
    this.chain = [];
    this.pendingTransactions = [];
    this.networkNodes = [];
    this.transactioners = [];
    this.minerNode = "";

};


TransactionNodeBlockchain.prototype.getLastBlock = function() {
    return this.chain[this.chain.length - 1]; 
};


TransactionNodeBlockchain.prototype.createNewTransaction = function(amount, sender, recipient, nodeUrl, transactionID) {

    const newTransaction = {
        amount: amount,
        sender: sender,
        recipient: recipient,
        nodeUrl: nodeUrl,
        transactionID: transactionID 
    }; 

    return newTransaction;
};


TransactionNodeBlockchain.prototype.addTransactionToPendingTransactions = function(transactionObj) {

    this.pendingTransactions.push(transactionObj);
    return this.getLastBlock()['index'] + 1;
};


module.exports = TransactionNodeBlockchain;