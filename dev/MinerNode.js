var express = require("express");
var app = express();
const port = process.argv[2];
const uuid = require('uuid').v1;
const rp = require('request-promise');
const bodyParser = require('body-parser');
const MinerBlockchain = require('./MinerNodeBlockchain');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:false}));

const blockchain = new MinerBlockchain();


app.get("/", (req, res) => {

});


app.get('/blockchain', function(req, res) { 
    res.send(blockchain); 
});


//registering new transaction-node to this miner node.
app.post('/register-transaction-node', (req, res) =>{
    blockchain.networkNodes.push(req.body.newtTansactionNodeUrl);
    res.json("Node registered successfully."); 

});


//registering and broadcasting incoming miner-node with the other miner-nodes on the network
app.post('/register-and-broadcast-miner-node', function(req, res) {
    const newMinerNode = req.body.newMinerNodeUrl;  
    if (blockchain.minerNodes.indexOf(newMinerNode) == -1) blockchain.minerNodes.push(newMinerNode);

    const regNodesPromises = [];
    blockchain.minerNodes.forEach(minerNode => {
        const requestOptions = {
            uri: minerNode + '/register-miner-node', 
            method: 'POST',
            body: { newMinerNodeUrl: newMinerNode },
            json: true
        };

    regNodesPromises.push(rp(requestOptions));
    });

    Promise.all(regNodesPromises).then(data => {
        const bulkRegisterOptions = {
            uri: newMinerNode + '/register-miner-nodes-bulk',
            method: 'POST',
            body: { allMinerNodes: [ ...blockchain.minerNodes, req.protocol + '://' + req.get('host') ] },
            json: true
        };

        return rp(bulkRegisterOptions);
    })
    .then(data => {
        res.json({ note: 'New node registered with network successfully.' });
    });
});


// register a node with the network
app.post('/register-miner-node', function(req, res) {
  const newMinerNode = req.body.newMinerNodeUrl;
  const nodeNotAlreadyPresent = blockchain.minerNodes.indexOf(newMinerNode) == -1;
  const notCurrentNode = req.protocol + '://' + req.get('host') !== newMinerNode;
  if (nodeNotAlreadyPresent && notCurrentNode) blockchain.minerNodes.push(newMinerNode);
  res.json({ note: 'New node registered successfully.' });
});


// register multiple nodes at once
app.post('/register-miner-nodes-bulk', function(req, res) {
  const allMinerNodes = req.body.allMinerNodes;
  allMinerNodes.forEach(minerNodeUrl => {
    const nodeNotAlreadyPresent = blockchain.minerNodes.indexOf(minerNodeUrl) == -1;
    const notCurrentNode = req.protocol + '://' + req.get('host') !== minerNodeUrl;
    if (nodeNotAlreadyPresent && notCurrentNode) blockchain.minerNodes.push(minerNodeUrl);
  });

  res.json({ note: 'Bulk registration successful.' });
});


//registering new transactioner, broadcasting it to this niner-node's subnetwork 
//and broadcasting to all other miner-nodes for this transactioner to be registered on all network.
app.post('/register-transactioner-and-send-nodes', function(req, res){

    const transactioner = {
        ID: req.body.newTransactionerID,
        money: 100 //default
    };
    blockchain.transactioners.push(transactioner);  

    const requestPromises = [];
    blockchain.networkNodes.forEach(nodeUrl => {
        const requestOptions = {
            uri: nodeUrl + '/register-new-transactioner',  
            method: 'POST', 
            body: {newTransactioner : transactioner}, 
            json: true 
        };
    requestPromises.push(rp(requestOptions));
    });

    Promise.all(requestPromises).then(data => { 

        const requestPromises = [];
        blockchain.minerNodes.forEach(nodeUrl => {
            const requestOptions = {
                uri: nodeUrl + '/register-and-broadcast-new-transactioner-from-other-subnetwork',  
                method: 'POST', 
                body: { newTransactioner : transactioner}, 
                json: true 
            };
        requestPromises.push(rp(requestOptions));
        });

        Promise.all(requestPromises).then(data => { 
        

            const requestPromises = [];
            const requestOptions = {
                uri: req.body.newTransactionerID + '/get-nodes-bulk',
                method: 'POST',
                body:{ nodeUrls: [...blockchain.networkNodes] }, 
                json: true
            };
        
            requestPromises.push(rp(requestOptions));
    
            Promise.all(requestPromises).then(data => {
                res.json("its ok");
            });
        });
    });
});


//registering and broadcasting new transactioner from other subnetwork
app.post('/register-and-broadcast-new-transactioner-from-other-subnetwork', (req, res) => {
    blockchain.transactioners.push(req.body.newTransactioner);     
    const requestPromises = [];
    blockchain.networkNodes.forEach(nodeUrl => {
        const requestOptions = {
            uri: nodeUrl + '/register-new-transactioner',  
            method: 'POST', 
            body: {newTransactioner : req.body.newTransactioner}, 
            json: true 
        };
    requestPromises.push(rp(requestOptions));
    });

    Promise.all(requestPromises).then(data => { 
        res.json("new transactioner registered to other subnetwork successfully");
    });
});



//mining the first block and sending it to it's subnetwork
//this request will be called only once
app.get('/mine-the-first-block-and-send-to-transactionNodes', (req, res) => {
    if(blockchain.chain.length === 0){
        const firstBlock = blockchain.createNewBlock(100, '0', '0');

        const requestPromises = [];
        blockchain.networkNodes.forEach(nodeUrl => {
            const requestOptions = {
                uri: nodeUrl + '/receive-first-block',
                method: 'POST',
                body: { firstBlock: firstBlock},
                json: true
            };
        requestPromises.push(rp(requestOptions));
        });
        Promise.all(requestPromises).then(data => { 
            res.json("First Block created and sent to nodes successfully");
        });
    } else {
        res.json("First block is aldready created.")
    }
}); 


//start mining operation and continue recursively
app.get('/mine', function(req, res){
    //assign pending transactions for every transaction on reducedPendingTransactions array to be unique and empty pending transactions for new transactions.
    blockchain.reducedPendingTransactions = blockchain.pendingTransactions;
    blockchain.pendingTransactions = [];

    const requestPromises = [];
    //emptying pending transaction on subnetwork
    blockchain.networkNodes.forEach(nodeUrl => {
        const requestOptions = {
           uri: nodeUrl + '/empty-pending-transactions',
           method: 'GET',
           json: true
        };

        requestPromises.push(rp(requestOptions));
    });

    Promise.all(requestPromises).then(data => {
        
        for(var i=0; i<blockchain.reducedPendingTransactions.length-1; i++){
            repeat = 0;
            while(i < blockchain.reducedPendingTransactions.length-1 && blockchain.reducedPendingTransactions[i].transactionID === blockchain.reducedPendingTransactions[i+1].transactionID){
                repeat++;
                i++;
            }
            blockchain.reducedPendingTransactions.splice(i+1-repeat, repeat);   
            i -= repeat;
        }

        const lastBlock = blockchain.getLastBlock();
        const previousBlockHash = lastBlock['hash'];
        const currentBlockData = {
            transactions: blockchain.reducedPendingTransactions,
            index: lastBlock['index'] + 1 
        };

        const nonce = blockchain.proofOfWork(previousBlockHash, currentBlockData);
        const blockHash = blockchain.hashBlock(previousBlockHash, currentBlockData, nonce);
        const newBlock = blockchain.createNewBlock(nonce, previousBlockHash, blockHash);

        const requestPromises = [];
        //new block minted at subnetwork, so send it to the other subnetworks
        blockchain.minerNodes.forEach(nodeUrl => {
            const requestOptions = {
                uri: nodeUrl + '/receive-new-block-from-other-miner-nodes-and-broadcast-to-your-network',
                method: 'POST',
                body: { newBlock: newBlock},
                json: true
            };
            requestPromises.push(rp(requestOptions));
        });
        Promise.all(requestPromises).then(data => { 

            const requestPromises = [];
            blockchain.networkNodes.forEach(nodeUrl => {
                const requestOptions = {
                    uri: nodeUrl + '/receive-new-block',
                    method: 'POST', 
                    body: { newBlock: newBlock},
                    json: true
                };
                requestPromises.push(rp(requestOptions));
            });

            Promise.all(requestPromises).then(data => {
                const rewardingTransactions = [];
                const len = blockchain.reducedPendingTransactions.length;

                const transactionsUpdateData = [];

                //after mining a block, total 10 coins divided by transaction number and send the nodes which made transaction.

                blockchain.reducedPendingTransactions.forEach(transaction => {
                    if(transaction.nodeUrl){ 
                    // if the transaction node url's exits which means the transaction is not mining reward,
                    //then register the reward transaction to controller and push to array to send every node.      
                        const rewardingTransaction = blockchain.createNewTransaction(10/len, "00", transaction.nodeUrl, "", uuid().split('-').join(''));
                        blockchain.addTransactionToPendingTransactions(rewardingTransaction);
                        rewardingTransactions.push(rewardingTransaction);
 
                        //And also for the transaction that is not mining reward, take the datas to update transactioners' registered money.
                        transactionsUpdateData.push({
                            sender: transaction.sender,
                            recipient: transaction.recipient,
                            amount: transaction.amount 
                        }); 
 
                        //Updating the registered transactioners' money amount on controller.
                        const senderIndex = blockchain.transactioners.findIndex(transactioner => transactioner.ID === transaction.sender);
                        const recipientIndex = blockchain.transactioners.findIndex(transactioner => transactioner.ID === transaction.recipient);
                
                        blockchain.transactioners[senderIndex].money -= transaction.amount;
                        blockchain.transactioners[recipientIndex].money += transaction.amount;
                    }

                });

                //Updating the registered transactioners' money amount on every node.
                transactionsUpdateData.forEach(transactionUpdateData => {
                    const requestPromises = [];
                    blockchain.networkNodes.forEach(nodeUrl => { 
                        const requestOptions = {
                            uri: nodeUrl + '/update-transactioners-data',
                            method: 'POST',
                            body: { transactionUpdateData: transactionUpdateData},
                            json: true
                        }
                        requestPromises.push(rp(requestOptions));
                    });
                    Promise.all(requestPromises).then(data => { });

                    const requestPromises2 = []
                    blockchain.minerNodes.forEach(nodeUrl => { 
                        const requestOptions2 = {
                            uri: nodeUrl + '/update-and-broadcast-transactioners-data-from-other-subnetwork',
                            method: 'POST',
                            body: { transactionUpdateData: transactionUpdateData},
                            json: true
                        }
                        requestPromises2.push(rp(requestOptions2));
                    });
                    Promise.all(requestPromises2).then(data => { });
                });

                //
                rewardingTransactions.forEach(rewardingTransaction => {
                    const requestPromises = [];
                    blockchain.networkNodes.forEach(nodeUrl => { 
                        const requestOptions = {
                            uri: nodeUrl + '/register-mining-reward-transaction',
                            method: 'POST',
                            body: { rewardingTransaction: rewardingTransaction},
                            json: true
                        }
                        requestPromises.push(rp(requestOptions));

                    });
                Promise.all(requestPromises).then(data => { });
                });
            
            res.json("minining operation started successfully");

            waitFunc();

            });
        });
    });
 
    function delay(milliseconds){
        return new Promise(resolve => {
            setTimeout(resolve, milliseconds);
       });
    }

    //this function is for minerNodes to wait before starting new mining operation.
    //only for my pc to not slow down.
    async function waitFunc(){
        await delay(30000);
        const requestPromises = [];
        const requestOptions = {
            uri: req.protocol + '://' + req.get('host') + '/mine',
            method: 'GET',
            json: true
        };

    requestPromises.push(rp(requestOptions));
    Promise.all(requestPromises);
    }
  
});


//registering transaction that comes from every transaction node for every transaction (to be reduced at mining time)
app.post("/register-transaction-to-miner-node", (req, res) => {
    blockchain.addTransactionToPendingTransactions(req.body.newTransaction);
    res.json("New transaction registered successfully.");
});



app.post('/update-and-broadcast-transactioners-data-from-other-subnetwork', function(req, res) {
    const senderIndex = blockchain.transactioners.findIndex(transactioner => transactioner.ID === req.body.transactionUpdateData.sender);
    const recipientIndex = blockchain.transactioners.findIndex(transactioner => transactioner.ID === req.body.transactionUpdateData.recipient);

    blockchain.transactioners[senderIndex].money -= req.body.transactionUpdateData.amount;
    blockchain.transactioners[recipientIndex].money += req.body.transactionUpdateData.amount;

    const requestPromises = [];
            blockchain.networkNodes.forEach(nodeUrl => { 
                const requestOptions = {
                        uri: nodeUrl + '/update-transactioners-data',
                        method: 'POST',
                        body: { transactionUpdateData: req.body.transactionUpdateData},
                        json: true
                    };
                requestPromises.push(rp(requestOptions));
            });
            Promise.all(requestPromises).then(data => { });

    res.json("Transactioners' registered amount updated successfully");
});


//consensus algorithm between miner nodes
//if chain changes on the miner node, then all the chain on this subnetwork is updated
app.get('/consensus', function(req, res) {
    const requestPromises = [];
    blockchain.minerNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/blockchain',
            method: 'GET',
            json: true
        };

        requestPromises.push(rp(requestOptions));
    });

    Promise.all(requestPromises)
    .then(blockchains => {
        const currentChainLength = blockchain.chain.length;
        let maxChainLength = currentChainLength;
        let newLongestChain = null;


        blockchains.forEach(blockchain => {
            if (blockchain.chain.length > maxChainLength) {
                maxChainLength = blockchain.chain.length;
                newLongestChain = blockchain.chain;

            };
        });

        if (!newLongestChain || (newLongestChain && !blockchain.chainIsValid(newLongestChain))) {
            res.json({
                note: 'Current chain has not been replaced.',
                chain: blockchain.chain
            });
        }
        else {
            blockchain.chain = newLongestChain;
            
            const requestPromises = [];
            blockchain.networkNodes.forEach(nodeUrl => {
                const requestOptions = {
                    uri: nodeUrl + '/update-chain',
                    method: 'POST', 
                    body: { newChain: newLongestChain},
                    json: true
                };
               requestPromises.push(rp(requestOptions));
            });

            Promise.all(requestPromises).then(data => { 
                res.json({
                note: 'This chain on the subnetwork has been replaced.',
                chain: blockchain.chain
                });
            });

           
        }
    });

    function delay(milliseconds){
        return new Promise(resolve => {
            setTimeout(resolve, milliseconds);
       });
    }

    async function waitFunc(){
        await delay(50000);
        const requestPromises = [];
        const requestOptions = {
            uri: req.protocol + '://' + req.get('host') + '/consensus',
            method: 'GET',
            json: true
        };

    requestPromises.push(rp(requestOptions));
    Promise.all(requestPromises);
    } 
  
  waitFunc();

});


app.post('/receive-new-block-from-other-miner-nodes-and-broadcast-to-your-network', function(req, res) {

    const newBlock = req.body.newBlock;
    const lastBlock = blockchain.getLastBlock();
    const correctHash = lastBlock.hash === newBlock.previousBlockHash; 
    const correctIndex = lastBlock['index'] + 1 === newBlock['index']; 
 

    if (correctHash && correctIndex) {
        blockchain.chain.push(newBlock);
  
    const requestPromises = [];
    blockchain.networkNodes.forEach(nodeUrl => {
        const requestOptions = {
            uri: nodeUrl + '/receive-new-block',
            method: 'POST',
            body: { newBlock: newBlock},
            json: true
        };
    requestPromises.push(rp(requestOptions));
    });

    Promise.all(requestPromises);

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


app.listen(port, function() {
  console.log(`Listening on port ${port}...`);
});
