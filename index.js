const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.port || 5001;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.use(cors({ origin: true }));
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.dxoja8w.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    app.get('/', (req, res) => {
      res.send('Server is running!');
    });

    const userCollection = client.db("vibe").collection("users");
    const workCollection = client.db("vibe").collection("works");
    const paymentCollection = client.db("vibe").collection("payments");


    // jwt related apis
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h'
      })
      res.send({ token });
    })

    // middlewares
    const verifyToken = (req, res, next) => {
      console.log("Authorization Header:", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'Unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: 'Forbidden access' });
        }
        req.decoded = decoded;
        next();
      })
    }
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const filter = { email: email };
      const user = await userCollection.findOne(filter);
      const admin = user?.role === 'admin';
      if (!admin) {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      next();
    }
    const verifyHR = async (req, res, next) => {
      const email = req.decoded.email;
      const filter = { email: email };
      const user = await userCollection.findOne(filter);
      const hr = user?.role === 'HR';
      if (!hr) {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      next();
    }
    const verifyAdminOrHR = async (req, res, next) => {
      const email = req.decoded.email;
      const filter = { email: email };
      const user = await userCollection.findOne(filter);
      if (user?.role === 'admin' || user?.role === 'HR') {
        return next();
      }
      return res.status(403).send({ message: 'Forbidden access' });
    }


    // user related api
    app.get('/users', verifyToken, verifyAdminOrHR, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      if (result && email) {
        res.send(result);
      }
      else {
        const allUser = await userCollection.find().toArray();
        res.send(allUser);
      }
    })
    app.get('/users/hr',async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const user = await userCollection.findOne(filter);
      let hr = false;
      if (user) {
        hr = user?.role === 'HR';
      }
      res.send({ hr });
    })
    app.get('/users/admin',async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const user = await userCollection.findOne(filter);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'User already exists', insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    app.patch('/users', verifyToken, async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const updateData = req.body;
      const updatedDoc = {
        // $set: {
        //   role: user.role,
        //   bankAccountNo:user.bankAccountNo,
        //   designation:user.designation,
        //   salary:user.salary,
        //   isVarified:user.isVarified,
        //   isFired:user.isFired,
        // }
        $set: updateData
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })


    // work-sheet related apis
    app.get('/works', verifyToken, async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const filtered = await workCollection.find(filter).toArray();
      if (filtered) {
        res.send(filtered);
      }
      else {
        const allWorks = await workCollection.find().toArray();
        res.send(allWorks);
      }
    })
    app.post('/works', verifyToken, async (req, res) => {
      const work = req.body;
      const result = await workCollection.insertOne(work);
      res.send(result);
    })

    // hr-related apis
    app.get('/payroll', verifyToken, verifyAdminOrHR, async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const filterdPayments = await paymentCollection.find(filter).toArray();
      if (filterdPayments && email) {
        res.send(filterdPayments);
      }
      else {
        const allPayments = await paymentCollection.find().toArray();
        res.send(allPayments);
      }
    })
    app.post('/payroll', verifyToken, verifyAdminOrHR, async (req, res) => {
      const payment = req.body;
      const result = paymentCollection.insertOne(payment);
      res.send(result);
    })


    // admin-payment-related
    app.post('/create-checkout-session', async (req, res) => {
      const { id, name, email, salary, month, year } = req.body;
      // console.log(id);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Salary for ${name}`,
                description: `Payment for ${month} , ${year}`,
              },
              unit_amount: Math.round(salary * 100)
            },
            quantity: 1,
          },
        ],
        metadata: {
          id: id,
          email: email,
          month: month,
          year: year
        },
        success_url: `http://localhost:5173/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}&userId=${id}`,
        cancel_url: "http://localhost:5173/dashboard/payment-cancel",
      });
      // console.log(session.id);
      // console.log(CHECKOUT_SESSION_ID);
      res.json({
        id: session.id,
        url: session.url
      })
    })

    app.get('/payment-info/:sessionId', async (req, res) => {
      try {
        const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
        res.send({
          transactionId: session.payment_intent, // This is the 'pi_...' ID
          paymentStatus: session.payment_status,
          customerEmail: session.metadata.id,
          customerEmail: session.metadata.email
        });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    })

    app.get('/userSalary/:id', verifyToken, verifyAdminOrHR, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await paymentCollection.findOne(filter);
      res.send(result);
    })
    app.patch('/userSalary/:id', verifyToken, verifyAdminOrHR, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const info = req.body;
      const updatedDoc = {
        $set: info
      }
      const result = await paymentCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
