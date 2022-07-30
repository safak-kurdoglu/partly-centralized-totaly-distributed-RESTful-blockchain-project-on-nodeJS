const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const uuid = require('uuid').v1;
const port = process.argv[2];
const rp = require('request-promise');


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


const nodeUrls = [];


app.get('/', function(req, res){ });

app.get('/nodeUrls', function(req, res){ 
res.send(nodeUrls)
});


app.post('/register-transactioner-and-get-nodes', function(req, res){ 
    
    requestPromises = [];
    const requestOptions = {     //register transactioner.
        uri: req.body.minerNodeUrl + '/register-transactioner-and-send-nodes',
        method: 'POST',
        body: {newTransactionerID : req.protocol + '://' + req.get('host')},
        json: true
    }; 

    requestPromises.push(rp(requestOptions));

    Promise.all(requestPromises).then(data => {

        res.json({ note: 'new transactioner registered successfully.' });
    });

});


app.post('/get-nodes-bulk', function(req, res) {
  const allNetworkNodes = req.body.nodeUrls;
  allNetworkNodes.forEach(nodeUrl => {
    nodeUrls.push(nodeUrl);
  });

  res.json({ note: 'Bulk registration successful.' });
});


app.post('/send-money', function(req, res){ 
    const requestPromises = [];
    const transactionID = uuid().split('-').join('');
    nodeUrls.forEach(nodeUrl => {
        const requestOptions = {
            uri: nodeUrl + '/transaction-broadcast', 
            method: 'POST', 
          body: {sender: req.protocol + '://' + req.get('host'),
                recipient: req.body.recipientUrl,  
                amountToSend: req.body.amount,
                transactionID: transactionID  
                 },
            json: true    
        };
    requestPromises.push(rp(requestOptions));
    });

    Promise.all(requestPromises).then(notes => {
        res.json(notes); });


});
   
 
app.listen(port, function() {
  console.log(`Listening on port ${port}...`);
});