const paymentModule = require('iota-payment')
const express = require('express')
const app = express()
const fs = require('fs');
const cors = require('cors');
app.use(cors());
//IOTA value for every pdf
let pdfvalue = 10
//object to store IPs in it
let allowedIPs = {}
//find all pdfs from the pdfs folder
let files = fs.readdirSync(__dirname + '/pdfs');
for (file of files) {
    allowedIPs[file] = []
}

//check if ip is allowed for requested pdf
function ensureAuthenticated(req, res, next) {
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    let pdfName = req.params.id
    if (typeof allowedIPs[pdfName] == 'undefined') {
        return res.redirect('/')
    }
    if (allowedIPs[pdfName].indexOf(ip) != -1) {
        return next();
    } else {
        //redirect to main page if the IP isn't allowed to access it
        res.redirect('/')
    }
}

//allow access for IP to pdf if paid
app.post('/authenticate', async (req, res) => {
    var jsonString = '';
    req.on('data', (data) => {
        jsonString += data;
    });
    req.on('end', async () => {
        try {
            let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            let payments = JSON.parse(jsonString)
            let results = []
            for (id of payments.paymentIds) {
                try {
                    let payment = await paymentModule.getPayment({ id: id })
                    if (typeof payment != 'undefined') {
                        if (payment.paid == true) {
                            //only push if not there already
                            if (allowedIPs[payment.data.pdfName].indexOf(ip) == -1) {
                                allowedIPs[payment.data.pdfName].push(ip)
                            }
                            // console.log("Allowed IPs:", allowedIPs);
                            results.push({ [payment.data.pdfName]: 'Authenticated!' })
                        } else {
                            results.push({ [payment.data.pdfName]: 'Waiting for payment' })
                        }
                    } else {
                        results.push({ error: "Payment not found" })
                    }
                } catch (err) {
                    console.log(err);
                }
            }
            res.send(results)
        } catch (err) {
            console.log(err);
        }
    })
});

//download pdf but check before if the IP is allowed (payment confirmed)
app.get('/download/:id', ensureAuthenticated, (req, res) => {
    res.sendFile(__dirname + '/pdfs/' + req.params.id, (err) => {
        if (err) console.log(err);
    });
    console.log(req.params.id + ' has been downloaded!')
});

//get all pdf names
app.get('/pdfs', (req, res) => {
    let files = fs.readdirSync(__dirname + '/pdfs');
    res.json({ pdfs: files })
});

//create a payment for a pdf
app.post('/payment', (req, res) => {
    var jsonString = '';
    req.on('data', (data) => {
        jsonString += data;
    });
    req.on('end', async () => {
        try {
            //create payment
            let payment = await paymentModule.createPaymentRequest({ value: pdfvalue, data: JSON.parse(jsonString) })
            console.log("payment", payment.address);
            res.send(payment)
        } catch (err) {
            res.send(err)
            console.log(err)
        }
    });
})

//use the files from the public folder for the main page
app.use(express.static('public/'));

let options = {
    api: true,
    //should be disabled later
    dashboard: true,
    websockets: true
    // ...
}

let server = paymentModule.createServer(app, options)

// Start server with iota-payment dashboard on '/iotapay' and api on '/iotapay/api'
server.listen(5000, () => {
    console.log(`Server started on http://localhost:5000 `)
    console.info(`Please visit http://localhost:5000/iotapay in your browser`)
})

//Create an event handler which is called, when a payment was created
var onPaymentCreated = function (payment) {
    console.log('payment created!', payment);
}

//Create an event handler which is called, when a payment was created
var onPaymentIncoming = function (payment) {
    console.log('payment incoming!', payment);
}

//Create an event handler which is called, when a payment was successfull
var onPaymentSuccess = function (payment) {
    console.log('payment success!', payment);
}

//Assign the event handler to the events:
paymentModule.onEvent('paymentCreated', onPaymentCreated);
paymentModule.onEvent('paymentIncoming', onPaymentIncoming);
paymentModule.onEvent('paymentSuccess', onPaymentSuccess);