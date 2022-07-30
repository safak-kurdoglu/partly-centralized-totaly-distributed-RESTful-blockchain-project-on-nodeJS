const express = require('express');
const app = express();
const port = process.argv[2];
const bodyParser = require('body-parser');
const rp = require('request-promise');
const TransactionBlockchain = require('./TransactionNodeBlockchain');


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


const blockchain = new TransactionBlockchain();


app.get('/blockchain', function(req, res) {
    res.send(blockchain); 
});


// register a node and broadcast it the network
app.post('/register-and-broadcast-node', function(req, res) {
    const newNodeUrl = req.body.newNodeUrl; 
    if (blockchain.networkNodes.indexOf(newNodeUrl) == -1) blockchain.networkNodes.push(newNodeUrl);
 
    const regNodesPromises = []; 
    blockchain.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/register-node',
            method: 'POST',
            body: { newNodeUrl: newNodeUrl },
            json: true
        };

        regNodesPromises.push(rp(requestOptions));
    });

    Promise.all(regNodesPromises).then(data => {
        const bulkRegisterOptions = {
            uri: newNodeUrl + '/register-nodes-bulk',
            method: 'POST',
            body: { allNetworkNodes: [ ...blockchain.networkNodes, req.protocol + '://' + req.get('host') ] },
            json: true
        };

        return rp(bulkRegisterOptions);
    })
    .then(data => {
        res.json({ note: 'New node registered with network successfully.' });
    });
});


// register a node with the network
app.post('/register-node', function(req, res) {
  const newNodeUrl = req.body.newNodeUrl;  
  const nodeNotAlreadyPresent = blockchain.networkNodes.indexOf(newNodeUrl) == -1;
  const notCurrentNode = req.protocol + '://' + req.get('host') !== newNodeUrl; 
  if (nodeNotAlreadyPresent && notCurrentNode) blockchain.networkNodes.push(newNodeUrl); 
  res.json({ note: 'New node registered successfully.' });
});


// register multiple nodes at once 
app.post('/register-nodes-bulk', function(req, res) {
    const allNetworkNodes = req.body.allNetworkNodes;
    allNetworkNodes.forEach(networkNodeUrl => {
        const nodeNotAlreadyPresent = blockchain.networkNodes.indexOf(networkNodeUrl) == -1;
        const notCurrentNode = req.protocol + '://' + req.get('host') !== networkNodeUrl;
        if (nodeNotAlreadyPresent && notCurrentNode) blockchain.networkNodes.push(networkNodeUrl);
    });
    res.json({ note: 'Bulk registration successful.' });
});

 
app.post('/register-node-to-miner-node', function(req, res) { 
    blockchain.minerNode = req.body.minerNodeUrl;
    const requestPromises = []; 
    const requestOption = {
        uri: req.body.minerNodeUrl + '/register-transaction-node', 
        method: 'POST', 
        body: { newtTansactionNodeUrl: req.protocol + '://' + req.get('host')}, 
        json: true
    }; 
    requestPromises.push(rp(requestOption)); 
 
    Promise.all(requestPromises).then(data => {
    res.json({ note: 'New node registered to miner node successfully.'})
    });
    
});


app.post('/register-new-transactioner', function(req, res) {
    blockchain.transactioners.push(req.body.newTransactioner);
    res.json("new transactioner registered successfully");
});


app.post('/receive-first-block', function(req, res) {
    blockchain.chain.push(req.body.firstBlock);
    res.json("First block registered successfully");
});


app.post('/transaction-broadcast', function(req, res) {
    //getting the transactioner's registered money from all of the nodes on network.
    const requestPromises = [];
    blockchain.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/send-the-transactioner-money',
            method: 'POST',
            body: {ID : req.body.sender},
           json: true
        };

    requestPromises.push(rp(requestOptions));
    });

    //data is array, each elements represents the money each node have registered for the transactioner.
    Promise.all(requestPromises).then(data => {

        //Here, selecting the most repeated money as confirmed so that some hacked or change node datas will not effect.
        var l = data.length-1;
        var maxRepeat = 0;
        var confirmedMoney;
        for(var i=0; i < l; i++){
            repeat = 0;
            while( i < l && data[i].a === data[i+1].a ){
                repeat++;
                if(repeat > maxRepeat){ 
                    maxRepeat = repeat;
                    confirmedMoney = data[i];   
                }
                i++;
            }
        }
        
        if (confirmedMoney < req.body.amountToSend)
            res.json({ note: 'transactioners amount is not enough for this transaction.'});

        else{
            //here every node created transaction, signed the transaction by it's url and added to the pending transactions.  
            //So at mining time, this all same transactions will be decreased to one and the first node that send the transaction to the miner node will take the mining reward.
            const newTransaction = blockchain.createNewTransaction(req.body.amountToSend, req.body.sender, req.body.recipient, req.protocol + '://' + req.get('host'), req.body.transactionID);
            blockchain.addTransactionToPendingTransactions(newTransaction);

            const requestPromises = [];
            const requestOptions = 
                {
                    uri: blockchain.minerNode + '/register-transaction-to-miner-node',
                    method: 'POST',
                    body: {newTransaction : newTransaction},
                    json: true
                }
            
            requestPromises.push(rp(requestOptions));
   
            Promise.all(requestPromises).then(data => {
                res.json({ note: 'Transaction created and registered to miner node successfully.' });
            });
        } 
    }); 

});


app.post('/send-the-transactioner-money', function(req, res) {
    res.json(blockchain.transactioners.find(transactioner => transactioner.ID === req.body.ID).money);
});


app.get('/empty-pending-transactions', function(req, res) {
    blockchain.pendingTransactions = [];
    res.json("pending transactions deleted.");
});



app.post('/receive-new-block', function(req, res) {
    const newBlock = req.body.newBlock;
    const lastBlock = blockchain.getLastBlock(); 
    const correctHash = lastBlock.hash === newBlock.previousBlockHash; 
    const correctIndex = lastBlock['index'] + 1 === newBlock['index'];
 
    if (correctHash && correctIndex) {
        blockchain.chain.push(newBlock);
        res.json({
            note: 'New block received and accepted.',
            newBlock: newBlock
        });
    } else {
        res.json({
            note: 'New block rejected.',
            newBlock: newBlock
        });
    }
});


app.post('/register-mining-reward-transaction', function(req, res) {
    blockchain.addTransactionToPendingTransactions(req.body.rewardingTransaction);
    res.json("new rewarding transaction registered.");
});



app.post('/update-transactioners-data', function(req, res) {
    const senderIndex = blockchain.transactioners.findIndex(transactioner => transactioner.ID === req.body.transactionUpdateData.sender);
    const recipientIndex = blockchain.transactioners.findIndex(transactioner => transactioner.ID === req.body.transactionUpdateData.recipient);

    blockchain.transactioners[senderIndex].money -= req.body.transactionUpdateData.amount;
    blockchain.transactioners[recipientIndex].money += req.body.transactionUpdateData.amount;

    res.json("Transactioners' registered amount updated successfully");
});


app.post('/update-chain', function(req, res) {
    blockchain.chain = req.body.newChain;
    res.json("chain on the node updated.");
    
});


app.listen(port, function() {
  console.log(`Listening on port ${port}...`);
});
